import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ErpClient,
  ErpServiceCallPriority,
  ErpRateType,
  ERP_LOCATIONS,
  ERP_RATES,
} from '../types'

type RootStackParamList = {
  ErpDetailsAppel: { id: string }
}

const PRIORITIES: { value: ErpServiceCallPriority; label: string }[] = [
  { value: 'normale', label: 'Normale' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'planifiee', label: 'Planifiée' },
]

export default function ErpNouvelAppelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<ErpClient[]>([])
  const [loadingClients, setLoadingClients] = useState(true)

  // Form state
  const [clientFactureAId, setClientFactureAId] = useState('')
  const [clientEffectuePourId, setClientEffectuePourId] = useState('')
  const [localisation, setLocalisation] = useState('')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState<ErpServiceCallPriority>('normale')
  const [tauxApplicable, setTauxApplicable] = useState<ErpRateType>('regulier')
  const [poClient, setPoClient] = useState('')

  // Modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientModalType, setClientModalType] = useState<'facture' | 'effectue'>('facture')
  const [clientSearch, setClientSearch] = useState('')

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('erp_clients')
        .select('*')
        .order('nom')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Erreur chargement clients:', error)
    } finally {
      setLoadingClients(false)
    }
  }

  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true
    const searchLower = clientSearch.toLowerCase()
    return (
      client.nom.toLowerCase().includes(searchLower) ||
      client.numero.toLowerCase().includes(searchLower)
    )
  })

  const getClientName = (id: string) => {
    const client = clients.find((c) => c.id === id)
    return client ? client.nom : 'Sélectionner...'
  }

  const openClientModal = (type: 'facture' | 'effectue') => {
    setClientModalType(type)
    setClientSearch('')
    setShowClientModal(true)
  }

  const selectClient = (client: ErpClient) => {
    if (clientModalType === 'facture') {
      setClientFactureAId(client.id)
      if (!clientEffectuePourId) {
        setClientEffectuePourId(client.id)
      }
    } else {
      setClientEffectuePourId(client.id)
    }
    setShowClientModal(false)
  }

  const handleSubmit = async () => {
    if (!clientFactureAId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un client à facturer')
      return
    }
    if (!localisation) {
      Alert.alert('Erreur', 'Veuillez sélectionner une localisation')
      return
    }
    if (!description.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une description')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('erp_service_calls')
        .insert({
          client_facture_a_id: clientFactureAId,
          client_effectue_pour_id: clientEffectuePourId || clientFactureAId,
          localisation,
          description: description.trim(),
          priorite,
          taux_applicable: tauxApplicable,
          po_client: poClient.trim() || null,
          statut: 'ouvert',
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      Alert.alert('Succès', `Appel #${data.numero} créé`, [
        {
          text: 'OK',
          onPress: () => navigation.replace('ErpDetailsAppel', { id: data.id }),
        },
      ])
    } catch (error: any) {
      console.error('Erreur création appel:', error)
      Alert.alert('Erreur', error.message || 'Impossible de créer l\'appel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvel appel</Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveText}>Créer</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Client Facturé */}
        <Text style={styles.sectionTitle}>CLIENT FACTURÉ À *</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => openClientModal('facture')}
          disabled={loadingClients}
        >
          <Text style={[styles.selectText, !clientFactureAId && styles.selectPlaceholder]}>
            {loadingClients ? 'Chargement...' : getClientName(clientFactureAId)}
          </Text>
          <Text style={styles.selectArrow}>›</Text>
        </TouchableOpacity>

        {/* Client Effectué Pour */}
        <Text style={styles.sectionTitle}>CLIENT EFFECTUÉ POUR</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => openClientModal('effectue')}
          disabled={loadingClients}
        >
          <Text style={[styles.selectText, !clientEffectuePourId && styles.selectPlaceholder]}>
            {loadingClients ? 'Chargement...' : getClientName(clientEffectuePourId)}
          </Text>
          <Text style={styles.selectArrow}>›</Text>
        </TouchableOpacity>

        {/* Localisation */}
        <Text style={styles.sectionTitle}>LOCALISATION *</Text>
        <View style={styles.optionsRow}>
          {ERP_LOCATIONS.map((loc) => (
            <TouchableOpacity
              key={loc}
              style={[styles.optionChip, localisation === loc && styles.optionChipActive]}
              onPress={() => setLocalisation(loc)}
            >
              <Text
                style={[styles.optionChipText, localisation === loc && styles.optionChipTextActive]}
              >
                {loc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Priorité */}
        <Text style={styles.sectionTitle}>PRIORITÉ</Text>
        <View style={styles.optionsRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.optionChip, priorite === p.value && styles.optionChipActive]}
              onPress={() => setPriorite(p.value)}
            >
              <Text
                style={[styles.optionChipText, priorite === p.value && styles.optionChipTextActive]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Taux Applicable */}
        <Text style={styles.sectionTitle}>TAUX APPLICABLE</Text>
        <View style={styles.optionsRow}>
          {ERP_RATES.map((rate) => (
            <TouchableOpacity
              key={rate.value}
              style={[styles.optionChip, tauxApplicable === rate.value && styles.optionChipActive]}
              onPress={() => setTauxApplicable(rate.value)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  tauxApplicable === rate.value && styles.optionChipTextActive,
                ]}
              >
                {rate.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* P.O. Client */}
        <Text style={styles.sectionTitle}>P.O. CLIENT</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Numéro de P.O. (optionnel)"
          placeholderTextColor="#999"
          value={poClient}
          onChangeText={setPoClient}
        />

        {/* Description */}
        <Text style={styles.sectionTitle}>DESCRIPTION *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Description des travaux à effectuer..."
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.bottomPadding} />
      </KeyboardAwareScrollView>

      {/* Client Selection Modal */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClientModal(false)}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {clientModalType === 'facture' ? 'Facturer à' : 'Effectué pour'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.modalSearch}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Rechercher un client..."
              placeholderTextColor="#999"
              value={clientSearch}
              onChangeText={setClientSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.clientItem}
                onPress={() => selectClient(item)}
              >
                <Text style={styles.clientNumber}>{item.numero}</Text>
                <Text style={styles.clientName}>{item.nom}</Text>
                {item.ville && (
                  <Text style={styles.clientCity}>{item.ville}</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>Aucun client trouvé</Text>
              </View>
            }
          />
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
  header: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
  },
  selectPlaceholder: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 20,
    color: '#999',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  optionChipText: {
    fontSize: 14,
    color: '#333',
  },
  optionChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
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
    color: '#8B5CF6',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  modalSearch: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalSearchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  clientItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  clientNumber: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
    marginBottom: 2,
  },
  clientName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  clientCity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
})
