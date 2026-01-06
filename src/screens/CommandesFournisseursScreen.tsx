import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { SupplierOrder, SupplierOrderStatus } from '../types'

const VERIFICATION_DELAY_DAYS = 7 // Delai par defaut en jours

const statusLabels: Record<SupplierOrderStatus, { label: string; bg: string; text: string }> = {
  en_attente: { label: 'En attente', bg: '#FEF3C7', text: '#D97706' },
  expediee: { label: 'Expédiée', bg: '#DBEAFE', text: '#2563EB' },
  partiel: { label: 'Partiel', bg: '#FED7AA', text: '#EA580C' },
  recu: { label: 'Reçu', bg: '#D1FAE5', text: '#059669' },
  annule: { label: 'Annulé', bg: '#F3F4F6', text: '#6B7280' },
}

type SupplierOrderWithRelations = SupplierOrder & {
  supplier?: { display_name: string; name: string } | null
  purchase_order?: { po_number: string } | null
  items?: { id: string }[]
}

export default function CommandesFournisseursScreen() {
  const navigation = useNavigation<any>()
  const [orders, setOrders] = useState<SupplierOrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'en_attente' | 'recu'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Verification states
  const [ordersToVerify, setOrdersToVerify] = useState<SupplierOrderWithRelations[]>([])
  const [showVerificationAlert, setShowVerificationAlert] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [selectedOrderForVerification, setSelectedOrderForVerification] = useState<SupplierOrderWithRelations | null>(null)
  const [snoozedays, setSnoozedays] = useState('7')
  const [contactNotes, setContactNotes] = useState('')
  const [verificationAction, setVerificationAction] = useState<'verify' | 'contact' | 'snooze' | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(display_name, name),
          purchase_order:purchase_orders(po_number),
          items:supplier_order_items(id)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'en_attente') {
        query = query.in('status', ['en_attente', 'partiel', 'expediee'])
      } else if (filter === 'recu') {
        query = query.eq('status', 'recu')
      }

      const { data, error } = await query

      if (error) throw error
      setOrders(data || [])

      // Calculer les commandes a verifier
      const toVerify = (data || []).filter(order => needsVerification(order))
      setOrdersToVerify(toVerify)

      // Afficher le pop-up seulement au premier chargement si des commandes sont a verifier
      if (isFirstLoad && toVerify.length > 0) {
        setShowVerificationAlert(true)
        setIsFirstLoad(false)
      }
    } catch (error) {
      console.error('Erreur fetch commandes:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Determine si une commande necessite une verification
  const needsVerification = (order: SupplierOrderWithRelations): boolean => {
    // Seulement les commandes non recues
    if (order.status === 'recu' || order.status === 'annule') return false

    const now = new Date()
    const createdAt = new Date(order.created_at)
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    // Si moins de X jours depuis la creation, pas besoin de verifier
    if (daysSinceCreation < VERIFICATION_DELAY_DAYS) return false

    // Si snooze actif, verifier si expire
    if (order.verification_snoozed_until) {
      const snoozedUntil = new Date(order.verification_snoozed_until)
      if (snoozedUntil > now) return false
    }

    // Si verifie recemment (moins de X jours), pas besoin
    if (order.last_verified_at) {
      const lastVerified = new Date(order.last_verified_at)
      const daysSinceVerification = Math.floor((now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceVerification < VERIFICATION_DELAY_DAYS) return false
    }

    return true
  }

  useFocusEffect(
    useCallback(() => {
      fetchOrders()
    }, [filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      order.supplier?.display_name?.toLowerCase().includes(search) ||
      order.po_reference?.toLowerCase().includes(search) ||
      order.client_name?.toLowerCase().includes(search) ||
      order.supplier_order_number?.toLowerCase().includes(search) ||
      order.purchase_order?.po_number?.toLowerCase().includes(search)
    )
  })

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
    })
  }

  const getDaysSince = (date: string) => {
    const now = new Date()
    const created = new Date(date)
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Actions de verification
  const handleVerificationAction = async () => {
    if (!selectedOrderForVerification || !verificationAction) return

    try {
      const updates: any = {}
      const now = new Date().toISOString()

      if (verificationAction === 'verify') {
        updates.last_verified_at = now
        updates.verification_snoozed_until = null
      } else if (verificationAction === 'contact') {
        updates.supplier_contacted_at = now
        updates.supplier_contact_notes = contactNotes || null
        updates.last_verified_at = now
        updates.verification_snoozed_until = null
      } else if (verificationAction === 'snooze') {
        const snoozeDays = parseInt(snoozedays) || 7
        const snoozeDate = new Date()
        snoozeDate.setDate(snoozeDate.getDate() + snoozeDays)
        updates.verification_snoozed_until = snoozeDate.toISOString()
      }

      const { error } = await supabase
        .from('supplier_orders')
        .update(updates)
        .eq('id', selectedOrderForVerification.id)

      if (error) throw error

      Alert.alert('Succes', 'Action enregistree')
      setShowVerificationModal(false)
      setSelectedOrderForVerification(null)
      setVerificationAction(null)
      setContactNotes('')
      setSnoozedays('7')
      fetchOrders()
    } catch (error) {
      console.error('Erreur verification:', error)
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'action')
    }
  }

  const openVerificationModal = (order: SupplierOrderWithRelations) => {
    setSelectedOrderForVerification(order)
    setShowVerificationModal(true)
    setVerificationAction(null)
    setContactNotes('')
    setSnoozedays('7')
  }

  const renderOrder = ({ item }: { item: SupplierOrderWithRelations }) => {
    const status = statusLabels[item.status] || statusLabels.en_attente
    const needsVerify = needsVerification(item)

    return (
      <TouchableOpacity
        style={[styles.orderCard, needsVerify && styles.orderCardNeedsVerification]}
        onPress={() => navigation.navigate('DetailsCommandeSupplier', { orderId: item.id })}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {item.supplier?.display_name || 'Fournisseur inconnu'}
          </Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.poNumber}>
            {item.purchase_order?.po_number || item.po_reference || 'Sans P.O.'}
          </Text>
          {item.supplier_order_number && (
            <Text style={styles.orderNumber}>#{item.supplier_order_number}</Text>
          )}
        </View>

        <View style={styles.orderMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.client_name || '-'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Items</Text>
            <Text style={styles.metaValue}>{item.items?.length || 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderVerificationItem = ({ item }: { item: SupplierOrderWithRelations }) => {
    const daysSince = getDaysSince(item.created_at)

    return (
      <TouchableOpacity
        style={styles.verifyCard}
        onPress={() => openVerificationModal(item)}
      >
        <View style={styles.verifyCardLeft}>
          <Text style={styles.verifySupplier} numberOfLines={1}>
            {item.supplier?.display_name || 'Fournisseur'}
          </Text>
          <Text style={styles.verifyPO} numberOfLines={1}>
            {item.purchase_order?.po_number || item.po_reference || 'Sans P.O.'}
          </Text>
        </View>
        <View style={styles.verifyCardRight}>
          <View style={styles.daysAgoBadge}>
            <Text style={styles.daysAgoText}>{daysSince}j</Text>
          </View>
          <Text style={styles.verifyAction}>Verifier</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Pop-up d'alerte verification */}
      <Modal
        visible={showVerificationAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerificationAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertTitle}>Commandes a verifier</Text>
            <Text style={styles.alertMessage}>
              {ordersToVerify.length} commande{ordersToVerify.length > 1 ? 's' : ''} en attente depuis plus de {VERIFICATION_DELAY_DAYS} jours
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.alertButtonSecondary}
                onPress={() => setShowVerificationAlert(false)}
              >
                <Text style={styles.alertButtonSecondaryText}>Plus tard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButtonPrimary}
                onPress={() => {
                  setShowVerificationAlert(false)
                  // Scroll vers la section verification
                }}
              >
                <Text style={styles.alertButtonPrimaryText}>Voir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal actions de verification */}
      <Modal
        visible={showVerificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verification de commande</Text>

            {selectedOrderForVerification && (
              <View style={styles.modalOrderInfo}>
                <Text style={styles.modalSupplier}>
                  {selectedOrderForVerification.supplier?.display_name}
                </Text>
                <Text style={styles.modalPO}>
                  {selectedOrderForVerification.purchase_order?.po_number || selectedOrderForVerification.po_reference}
                </Text>
                <Text style={styles.modalDays}>
                  Creee il y a {getDaysSince(selectedOrderForVerification.created_at)} jours
                </Text>
              </View>
            )}

            <Text style={styles.modalSectionTitle}>Choisir une action:</Text>

            <TouchableOpacity
              style={[styles.actionButton, verificationAction === 'verify' && styles.actionButtonSelected]}
              onPress={() => setVerificationAction('verify')}
            >
              <Text style={styles.actionButtonIcon}>✓</Text>
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonTitle}>Marquer comme verifie</Text>
                <Text style={styles.actionButtonDesc}>La commande est en cours, tout est normal</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, verificationAction === 'contact' && styles.actionButtonSelected]}
              onPress={() => setVerificationAction('contact')}
            >
              <Text style={styles.actionButtonIcon}>📞</Text>
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonTitle}>Relance fournisseur</Text>
                <Text style={styles.actionButtonDesc}>J'ai contacte le fournisseur</Text>
              </View>
            </TouchableOpacity>

            {verificationAction === 'contact' && (
              <TextInput
                style={styles.notesInput}
                placeholder="Notes de la relance (optionnel)"
                value={contactNotes}
                onChangeText={setContactNotes}
                multiline
                placeholderTextColor="#999"
              />
            )}

            <TouchableOpacity
              style={[styles.actionButton, verificationAction === 'snooze' && styles.actionButtonSelected]}
              onPress={() => setVerificationAction('snooze')}
            >
              <Text style={styles.actionButtonIcon}>⏰</Text>
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonTitle}>Reporter le rappel</Text>
                <Text style={styles.actionButtonDesc}>Me rappeler plus tard</Text>
              </View>
            </TouchableOpacity>

            {verificationAction === 'snooze' && (
              <View style={styles.snoozeOptions}>
                {['3', '7', '14'].map(days => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.snoozeButton, snoozedays === days && styles.snoozeButtonSelected]}
                    onPress={() => setSnoozedays(days)}
                  >
                    <Text style={[styles.snoozeButtonText, snoozedays === days && styles.snoozeButtonTextSelected]}>
                      {days} jours
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowVerificationModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonConfirm, !verificationAction && styles.modalButtonDisabled]}
                onPress={handleVerificationAction}
                disabled={!verificationAction}
              >
                <Text style={styles.modalButtonConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Section A verifier */}
      {ordersToVerify.length > 0 && (
        <View style={styles.verificationSection}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationTitle}>⚠️ A verifier</Text>
            <View style={styles.verificationBadge}>
              <Text style={styles.verificationBadgeText}>{ordersToVerify.length}</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={ordersToVerify}
            keyExtractor={(item) => `verify-${item.id}`}
            renderItem={renderVerificationItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.verificationList}
          />
        </View>
      )}

      {/* Recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par P.O., fournisseur, client..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButtonText}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <FilterButton value="all" label="Toutes" />
        <FilterButton value="en_attente" label="En attente" />
        <FilterButton value="recu" label="Recues" />
      </View>

      {/* Bouton Scan QR */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => navigation.navigate('ScanQR')}
      >
        <Text style={styles.scanButtonIcon}>📷</Text>
        <Text style={styles.scanButtonText}>Scanner un QR code</Text>
      </TouchableOpacity>

      {/* Liste */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D97706']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande trouvee</Text>
            <Text style={styles.emptySubtext}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  // Section verification
  verificationSection: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  verificationBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  verificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  verificationList: {
    paddingHorizontal: 12,
  },
  verifyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    width: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  verifyCardLeft: {
    flex: 1,
  },
  verifySupplier: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  verifyPO: {
    fontSize: 12,
    color: '#666',
  },
  verifyCardRight: {
    alignItems: 'center',
  },
  daysAgoBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  daysAgoText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyAction: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
  },
  // Alert popup
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButtonSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  alertButtonSecondaryText: {
    color: '#666',
    fontWeight: '600',
  },
  alertButtonPrimary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  alertButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Modal verification
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOrderInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalSupplier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalPO: {
    fontSize: 14,
    color: '#64191E',
    marginTop: 4,
  },
  modalDays: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionButtonSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#333',
  },
  snoozeOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  snoozeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  snoozeButtonSelected: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  snoozeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  snoozeButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#D97706',
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Recherche et filtres
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  filterButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#D97706',
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  scanButtonIcon: {
    fontSize: 20,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderCardNeedsVerification: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  poNumber: {
    fontSize: 14,
    color: '#64191E',
    fontWeight: '500',
  },
  orderNumber: {
    fontSize: 13,
    color: '#999',
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
})
