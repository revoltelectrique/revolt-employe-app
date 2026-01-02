import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { PurchaseOrder } from '../types'
import { Button, Card, Badge, ConfirmDialog, CommentsSection } from '../components'
import { useOfflineDetail } from '../hooks/useOfflineData'
import { CacheKeys, CacheTTL } from '../lib/storage'
import { useOffline } from '../contexts/OfflineContext'
import { useOfflineQueue } from '../lib/offlineQueue'

interface LinkedRequisition {
  id: string
  request_number: string
}

export default function DetailsBCScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { orderId } = route.params

  const { isOnline } = useOffline()
  const { addMutation } = useOfflineQueue()

  const [showConfirm, setShowConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [linkedRequisition, setLinkedRequisition] = useState<LinkedRequisition | null>(null)
  const [localOrder, setLocalOrder] = useState<PurchaseOrder | null>(null)

  // Fetch avec cache offline
  const fetchOrder = useCallback(async (): Promise<PurchaseOrder | null> => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        requester:users!requester_id(email, first_name, last_name),
        items:purchase_order_items(*)
      `)
      .eq('id', orderId)
      .single()

    if (error) throw error

    // Récupérer la réquisition liée si elle existe
    if (data?.material_request_id) {
      const { data: reqData } = await supabase
        .from('material_requests')
        .select('id, request_number')
        .eq('id', data.material_request_id)
        .single()

      if (reqData) {
        setLinkedRequisition(reqData)
      }
    }

    return data
  }, [orderId])

  const {
    data: order,
    loading,
    isFromCache,
    isStale,
    refetch,
  } = useOfflineDetail<PurchaseOrder>(
    fetchOrder,
    CacheKeys.purchaseOrderDetail(orderId),
    !!orderId
  )

  // Sync local state with fetched data
  useEffect(() => {
    if (order) {
      setLocalOrder(order)
    }
  }, [order])

  useEffect(() => {
    fetchUserRole()
  }, [orderId])

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(data?.role || '')
    }
  }

  const canEdit = ['admin', 'contremaitre', 'contremaître'].includes(userRole)

  // Utiliser localOrder pour les mises à jour optimistes
  const displayOrder = localOrder || order

  const handleToggleStatus = async () => {
    if (!displayOrder) return

    const previousStatus = displayOrder.status
    const newStatus = previousStatus === 'en_attente' ? 'traite' : 'en_attente'

    // Mise à jour optimiste
    setLocalOrder({ ...displayOrder, status: newStatus })
    setUpdating(true)

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', displayOrder.id)

        if (error) throw error

        setShowConfirm(false)
        Alert.alert('Succès', `Statut changé à "${newStatus === 'traite' ? 'Traité' : 'En attente'}"`)
        refetch() // Rafraîchir le cache
      } catch (error) {
        console.error('Erreur:', error)
        // Rollback
        setLocalOrder({ ...displayOrder, status: previousStatus })
        Alert.alert('Erreur', 'Impossible de changer le statut')
      } finally {
        setUpdating(false)
      }
    } else {
      // Mode hors ligne - ajouter à la queue
      addMutation({
        type: 'update',
        table: 'purchase_orders',
        data: {
          id: displayOrder.id,
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        maxRetries: 3,
      })
      setUpdating(false)
      setShowConfirm(false)
      Alert.alert(
        'Hors ligne',
        'Le changement de statut sera synchronisé quand vous serez en ligne.'
      )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRequesterName = () => {
    if (displayOrder?.requester?.first_name) {
      return `${displayOrder.requester.first_name} ${displayOrder.requester.last_name || ''}`
    }
    return displayOrder?.requester?.email || '-'
  }

  const calculateTotal = () => {
    if (!displayOrder?.items || displayOrder.items.length === 0) return null
    const total = displayOrder.items.reduce((sum, item) => {
      return sum + (item.price ? item.price * item.quantity : 0)
    }, 0)
    return total > 0 ? total : null
  }

  if (loading && !displayOrder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  if (!displayOrder) return null

  const total = calculateTotal()

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading && !!displayOrder}
          onRefresh={refetch}
          colors={['#64191E']}
        />
      }
    >
      {/* Indicateur offline/cache */}
      {(!isOnline || isFromCache) && (
        <View style={[styles.cacheIndicator, !isOnline && styles.offlineIndicator]}>
          <Text style={styles.cacheIndicatorText}>
            {!isOnline ? '📡 Mode hors ligne' : isStale ? '⏳ Données en cache' : '✓ Cache récent'}
          </Text>
        </View>
      )}

      {/* Header */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.poNumber}>{displayOrder.po_number}</Text>
          <Badge
            label={displayOrder.status === 'en_attente' ? 'En attente' : 'Traité'}
            variant={displayOrder.status === 'en_attente' ? 'pending' : 'success'}
          />
        </View>
        <Text style={styles.date}>Créé le {formatDate(displayOrder.created_at)}</Text>
      </Card>

      {/* Informations */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Fournisseur</Text>
          <Text style={styles.value}>{displayOrder.supplier_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Demandeur</Text>
          <Text style={styles.value}>{getRequesterName()}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Facturable</Text>
          <Text style={styles.value}>{displayOrder.is_billable ? 'Oui' : 'Non'}</Text>
        </View>

        {displayOrder.is_billable && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.label}>N° Servicentre</Text>
              <Text style={styles.value}>{displayOrder.servicentre_call_number || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Client</Text>
              <Text style={styles.value}>{displayOrder.client_name || '-'}</Text>
            </View>
          </>
        )}

        {linkedRequisition && (
          <TouchableOpacity
            style={styles.linkedCard}
            onPress={() => (navigation as any).navigate('DetailsRequisition', { requestId: linkedRequisition.id })}
          >
            <Text style={styles.linkedLabel}>Réquisition associée</Text>
            <View style={styles.linkedRow}>
              <Text style={styles.linkedIcon}>📦</Text>
              <Text style={styles.linkedNumber}>{linkedRequisition.request_number}</Text>
              <Text style={styles.linkedArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}
      </Card>

      {/* Items */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>
          Produits ({displayOrder.items?.length || 0})
        </Text>

        {displayOrder.items?.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIndex}>#{index + 1}</Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
            </View>
            <Text style={styles.itemDescription}>{item.description}</Text>
            {item.price && (
              <Text style={styles.itemPrice}>
                {item.price.toFixed(2)} $ / unité
              </Text>
            )}
          </View>
        ))}

        {total && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total estimé</Text>
            <Text style={styles.totalValue}>{total.toFixed(2)} $</Text>
          </View>
        )}
      </Card>

      {/* Commentaires */}
      {currentUserId && (
        <CommentsSection
          documentType="purchase_order"
          documentId={displayOrder.id}
          currentUserId={currentUserId}
        />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {canEdit && (
          <Button
            title="Modifier le bon de commande"
            onPress={() => {
              (navigation as any).navigate('ModifierBC', {
                orderId: displayOrder.id,
              })
            }}
            variant="outline"
            style={{ marginBottom: 12 }}
          />
        )}
        <Button
          title={displayOrder.status === 'en_attente' ? 'Marquer comme traité' : 'Réouvrir'}
          onPress={() => setShowConfirm(true)}
          variant={displayOrder.status === 'en_attente' ? 'primary' : 'outline'}
        />
      </View>

      <View style={{ height: 40 }} />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={showConfirm}
        title="Changer le statut"
        message={
          displayOrder.status === 'en_attente'
            ? 'Voulez-vous marquer ce bon de commande comme traité?'
            : 'Voulez-vous réouvrir ce bon de commande?'
        }
        confirmLabel={displayOrder.status === 'en_attente' ? 'Traiter' : 'Réouvrir'}
        onConfirm={handleToggleStatus}
        onCancel={() => setShowConfirm(false)}
        loading={updating}
      />
    </ScrollView>
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
  },
  cacheIndicator: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  offlineIndicator: {
    backgroundColor: '#FEE2E2',
  },
  cacheIndicatorText: {
    fontSize: 12,
    color: '#92400E',
  },
  headerCard: {
    margin: 16,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#64191E',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    margin: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64191E',
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  itemDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  actions: {
    padding: 16,
  },
  linkedCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  linkedLabel: {
    fontSize: 12,
    color: '#6366F1',
    marginBottom: 8,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedIcon: {
    fontSize: 18,
  },
  linkedNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338CA',
    flex: 1,
  },
  linkedArrow: {
    fontSize: 18,
    color: '#6366F1',
  },
})
