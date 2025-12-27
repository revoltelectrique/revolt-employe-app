import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ErpServiceCall,
  ErpTimeEntry,
  ErpMaterial,
  ErpServiceCallStatus,
  ErpRateType,
  ERP_RATES,
} from '../types'

type RouteParams = {
  ErpDetailsAppel: { id: string }
}

const STATUS_LABELS: Record<ErpServiceCallStatus, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  termine: 'Terminé',
  facture: 'Facturé',
  annule: 'Annulé',
}

const STATUS_COLORS: Record<ErpServiceCallStatus, { bg: string; text: string }> = {
  ouvert: { bg: '#DBEAFE', text: '#1D4ED8' },
  en_cours: { bg: '#FEF3C7', text: '#D97706' },
  termine: { bg: '#D1FAE5', text: '#059669' },
  facture: { bg: '#E5E7EB', text: '#374151' },
  annule: { bg: '#FEE2E2', text: '#DC2626' },
}

export default function ErpDetailsAppelScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<RouteParams, 'ErpDetailsAppel'>>()
  const { user, profile } = useAuth()

  const [call, setCall] = useState<ErpServiceCall | null>(null)
  const [timeEntries, setTimeEntries] = useState<ErpTimeEntry[]>([])
  const [materials, setMaterials] = useState<ErpMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Time entry modal
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeHours, setTimeHours] = useState('')
  const [timeRate, setTimeRate] = useState<ErpRateType>('regulier')
  const [timeDescription, setTimeDescription] = useState('')
  const [savingTime, setSavingTime] = useState(false)

  // Material modal
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [materialCode, setMaterialCode] = useState('')
  const [materialDesc, setMaterialDesc] = useState('')
  const [materialQty, setMaterialQty] = useState('')
  const [materialPrice, setMaterialPrice] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)

  const loadData = useCallback(async () => {
    try {
      // Load service call
      const { data: callData, error: callError } = await supabase
        .from('erp_service_calls')
        .select(`
          *,
          client_facture_a:erp_clients!erp_service_calls_client_facture_a_id_fkey(id, numero, nom, telephone),
          client_effectue_pour:erp_clients!erp_service_calls_client_effectue_pour_id_fkey(id, numero, nom),
          creator:users!erp_service_calls_created_by_fkey(id, email, first_name, last_name)
        `)
        .eq('id', route.params.id)
        .single()

      if (callError) throw callError
      setCall(callData)

      // Load time entries
      const { data: timeData } = await supabase
        .from('erp_time_entries')
        .select(`
          *,
          employee:users!erp_time_entries_employee_id_fkey(id, email, first_name, last_name)
        `)
        .eq('service_call_id', route.params.id)
        .order('work_date', { ascending: false })

      setTimeEntries(timeData || [])

      // Load materials
      const { data: matData } = await supabase
        .from('erp_materials')
        .select('*')
        .eq('service_call_id', route.params.id)
        .order('created_at', { ascending: false })

      setMaterials(matData || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
      Alert.alert('Erreur', 'Impossible de charger les données')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [route.params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const getRateLabel = (rate: ErpRateType) => {
    return ERP_RATES.find((r) => r.value === rate)?.label || rate
  }

  const addTimeEntry = async () => {
    const hours = parseFloat(timeHours)
    if (isNaN(hours) || hours <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre d\'heures valide')
      return
    }

    setSavingTime(true)

    try {
      const rateMultiplier = ERP_RATES.find((r) => r.value === timeRate)?.multiplier || 1

      const { error } = await supabase.from('erp_time_entries').insert({
        service_call_id: route.params.id,
        employee_id: user?.id,
        work_date: new Date().toISOString().split('T')[0],
        hours,
        rate_type: timeRate,
        rate_multiplier: rateMultiplier,
        description: timeDescription.trim() || null,
      })

      if (error) throw error

      // Update status to en_cours if currently ouvert
      if (call?.statut === 'ouvert') {
        await supabase
          .from('erp_service_calls')
          .update({ statut: 'en_cours' })
          .eq('id', route.params.id)
      }

      setShowTimeModal(false)
      setTimeHours('')
      setTimeRate('regulier')
      setTimeDescription('')
      loadData()
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le temps')
    } finally {
      setSavingTime(false)
    }
  }

  const addMaterial = async () => {
    const qty = parseFloat(materialQty)
    const price = parseFloat(materialPrice)

    if (!materialCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code produit')
      return
    }
    if (!materialDesc.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une description')
      return
    }
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide')
      return
    }
    if (isNaN(price) || price < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide')
      return
    }

    setSavingMaterial(true)

    try {
      const { error } = await supabase.from('erp_materials').insert({
        service_call_id: route.params.id,
        product_code: materialCode.trim().toUpperCase(),
        description: materialDesc.trim(),
        quantity: qty,
        unit_price: price,
      })

      if (error) throw error

      setShowMaterialModal(false)
      setMaterialCode('')
      setMaterialDesc('')
      setMaterialQty('')
      setMaterialPrice('')
      loadData()
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le matériel')
    } finally {
      setSavingMaterial(false)
    }
  }

  const calculateTotals = () => {
    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0)
    const totalMaterial = materials.reduce((sum, m) => sum + m.quantity * m.unit_price, 0)
    return { totalHours, totalMaterial }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    )
  }

  if (!call) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Appel non trouvé</Text>
        </View>
      </SafeAreaView>
    )
  }

  const statusColor = STATUS_COLORS[call.statut]
  const totals = calculateTotals()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Appel #{call.numero}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {STATUS_LABELS[call.statut]}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLIENT</Text>
          <View style={styles.card}>
            <Text style={styles.clientName}>{call.client_facture_a?.nom}</Text>
            {call.client_facture_a?.telephone && (
              <Text style={styles.clientPhone}>📞 {call.client_facture_a.telephone}</Text>
            )}
            {call.client_effectue_pour &&
              call.client_effectue_pour.id !== call.client_facture_a?.id && (
                <Text style={styles.clientSecondary}>
                  Effectué pour: {call.client_effectue_pour.nom}
                </Text>
              )}
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DÉTAILS</Text>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Localisation</Text>
              <Text style={styles.detailValue}>{call.localisation || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Taux</Text>
              <Text style={styles.detailValue}>{getRateLabel(call.taux_applicable)}</Text>
            </View>
            {call.po_client && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>P.O. Client</Text>
                <Text style={styles.detailValue}>{call.po_client}</Text>
              </View>
            )}
            {call.description && (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{call.description}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Time Entries */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TEMPS ({totals.totalHours}h)</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowTimeModal(true)}
            >
              <Text style={styles.addButtonText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>

          {timeEntries.length > 0 ? (
            <View style={styles.card}>
              {timeEntries.map((entry) => (
                <View key={entry.id} style={styles.timeRow}>
                  <View style={styles.timeInfo}>
                    <Text style={styles.timeName}>
                      {entry.employee?.first_name} {entry.employee?.last_name}
                    </Text>
                    <Text style={styles.timeDate}>{entry.work_date}</Text>
                    {entry.description && (
                      <Text style={styles.timeDesc}>{entry.description}</Text>
                    )}
                  </View>
                  <View style={styles.timeRight}>
                    <Text style={styles.timeHours}>{entry.hours}h</Text>
                    <Text style={styles.timeRate}>{getRateLabel(entry.rate_type)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucun temps enregistré</Text>
            </View>
          )}
        </View>

        {/* Materials */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              MATÉRIEL ({totals.totalMaterial.toFixed(2)} $)
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowMaterialModal(true)}
            >
              <Text style={styles.addButtonText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>

          {materials.length > 0 ? (
            <View style={styles.card}>
              {materials.map((mat) => (
                <View key={mat.id} style={styles.materialRow}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialCode}>{mat.product_code}</Text>
                    <Text style={styles.materialDesc}>{mat.description}</Text>
                  </View>
                  <View style={styles.materialRight}>
                    <Text style={styles.materialQty}>{mat.quantity} x</Text>
                    <Text style={styles.materialPrice}>{mat.unit_price.toFixed(2)} $</Text>
                    <Text style={styles.materialTotal}>
                      {(mat.quantity * mat.unit_price).toFixed(2)} $
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucun matériel ajouté</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Time Entry Modal */}
      <Modal visible={showTimeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTimeModal(false)}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajouter du temps</Text>
            <TouchableOpacity onPress={addTimeEntry} disabled={savingTime}>
              {savingTime ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Text style={styles.modalSave}>Ajouter</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>HEURES *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 2.5"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              value={timeHours}
              onChangeText={setTimeHours}
            />

            <Text style={styles.modalLabel}>TAUX</Text>
            <View style={styles.rateOptions}>
              {ERP_RATES.map((rate) => (
                <TouchableOpacity
                  key={rate.value}
                  style={[styles.rateOption, timeRate === rate.value && styles.rateOptionActive]}
                  onPress={() => setTimeRate(rate.value)}
                >
                  <Text
                    style={[
                      styles.rateOptionText,
                      timeRate === rate.value && styles.rateOptionTextActive,
                    ]}
                  >
                    {rate.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>DESCRIPTION (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Description du travail effectué..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              value={timeDescription}
              onChangeText={setTimeDescription}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Le temps sera enregistré pour aujourd'hui au nom de {profile?.first_name}{' '}
                {profile?.last_name}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Material Modal */}
      <Modal visible={showMaterialModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMaterialModal(false)}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ajouter du matériel</Text>
            <TouchableOpacity onPress={addMaterial} disabled={savingMaterial}>
              {savingMaterial ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Text style={styles.modalSave}>Ajouter</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>CODE PRODUIT *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: CABLE-14-2"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              value={materialCode}
              onChangeText={setMaterialCode}
            />

            <Text style={styles.modalLabel}>DESCRIPTION *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Description du produit"
              placeholderTextColor="#999"
              value={materialDesc}
              onChangeText={setMaterialDesc}
            />

            <View style={styles.modalRow}>
              <View style={styles.modalHalf}>
                <Text style={styles.modalLabel}>QUANTITÉ *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="1"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={materialQty}
                  onChangeText={setMaterialQty}
                />
              </View>
              <View style={styles.modalHalf}>
                <Text style={styles.modalLabel}>PRIX UNITAIRE *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={materialPrice}
                  onChangeText={setMaterialPrice}
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  clientPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  clientSecondary: {
    fontSize: 14,
    color: '#8B5CF6',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  descriptionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeInfo: {
    flex: 1,
  },
  timeName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  timeDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  timeDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  timeRight: {
    alignItems: 'flex-end',
  },
  timeHours: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  timeRate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  materialInfo: {
    flex: 1,
  },
  materialCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  materialDesc: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  materialRight: {
    alignItems: 'flex-end',
  },
  materialQty: {
    fontSize: 13,
    color: '#666',
  },
  materialPrice: {
    fontSize: 13,
    color: '#666',
  },
  materialTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancel: {
    color: '#999',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  modalSave: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalHalf: {
    flex: 1,
  },
  rateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rateOption: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rateOptionActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  rateOptionText: {
    fontSize: 14,
    color: '#333',
  },
  rateOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
})
