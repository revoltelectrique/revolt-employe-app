import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

interface ItemLine {
  id: string
  description: string
  quantity: string
  isNew?: boolean
  toDelete?: boolean
}

export default function ModifierRequisitionScreen() {
  const navigation = useNavigation()
  const route = useRoute<any>()
  const { requestId } = route.params

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientName, setClientName] = useState('')
  const [servicentreNumber, setServicentreNumber] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [status, setStatus] = useState('en_attente')
  const [items, setItems] = useState<ItemLine[]>([])

  useEffect(() => {
    loadRequisition()
  }, [requestId])

  const loadRequisition = async () => {
    try {
      // Verifier le role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigation.goBack()
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!['admin', 'contremaitre', 'contremaître'].includes(userData?.role || '')) {
        Alert.alert('Erreur', 'Acces refuse')
        navigation.goBack()
        return
      }

      // Charger la requisition
      const { data, error } = await supabase
        .from('material_requests')
        .select(`
          *,
          items:material_request_items(*)
        `)
        .eq('id', requestId)
        .single()

      if (error || !data) {
        Alert.alert('Erreur', 'Requisition introuvable')
        navigation.goBack()
        return
      }

      setClientName(data.client_name || '')
      setServicentreNumber(data.servicentre_call_number || '')
      setDeliveryLocation(data.delivery_location || '')
      setSpecialNotes(data.special_notes || '')
      setStatus(data.status || 'en_attente')
      setItems(
        data.items?.map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: String(item.quantity),
        })) || []
      )
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de charger la requisition')
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: `new-${Date.now()}`, description: '', quantity: '1', isNew: true }
    ])
  }

  const removeItem = (id: string) => {
    if (id.startsWith('new-')) {
      setItems(items.filter(item => item.id !== id))
    } else {
      setItems(items.map(item =>
        item.id === id ? { ...item, toDelete: true } : item
      ))
    }
  }

  const updateItem = (id: string, field: keyof ItemLine, value: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = async () => {
    if (!clientName.trim() || !servicentreNumber.trim() || !deliveryLocation.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires')
      return
    }

    const validItems = items.filter(item => !item.toDelete && item.description.trim())
    if (validItems.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins un item')
      return
    }

    setSaving(true)

    try {
      // Mettre a jour la requisition
      const { error: updateError } = await supabase
        .from('material_requests')
        .update({
          client_name: clientName.trim(),
          servicentre_call_number: servicentreNumber.trim(),
          delivery_location: deliveryLocation.trim(),
          special_notes: specialNotes.trim() || null,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      // Supprimer les items marques pour suppression
      const itemsToDelete = items.filter(item => item.toDelete && !item.isNew)
      for (const item of itemsToDelete) {
        await supabase
          .from('material_request_items')
          .delete()
          .eq('id', item.id)
      }

      // Mettre a jour les items existants
      const itemsToUpdate = items.filter(item => !item.isNew && !item.toDelete)
      for (const item of itemsToUpdate) {
        await supabase
          .from('material_request_items')
          .update({
            description: item.description.trim(),
            quantity: parseInt(item.quantity) || 1,
          })
          .eq('id', item.id)
      }

      // Ajouter les nouveaux items
      const newItems = items.filter(item => item.isNew && !item.toDelete && item.description.trim())
      if (newItems.length > 0) {
        await supabase
          .from('material_request_items')
          .insert(
            newItems.map(item => ({
              material_request_id: requestId,
              description: item.description.trim(),
              quantity: parseInt(item.quantity) || 1,
            }))
          )
      }

      Alert.alert('Succes', 'Requisition modifiee!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de modifier la requisition')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Informations generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations generales</Text>

          <Text style={styles.label}>Nom du client *</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Nom du client"
          />

          <Text style={styles.label}>N° Servicentre *</Text>
          <TextInput
            style={styles.input}
            value={servicentreNumber}
            onChangeText={setServicentreNumber}
            placeholder="Ex: SC-12345"
          />

          <Text style={styles.label}>Lieu de livraison *</Text>
          <TextInput
            style={styles.input}
            value={deliveryLocation}
            onChangeText={setDeliveryLocation}
            placeholder="Adresse de livraison"
          />

          <Text style={styles.label}>Statut</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'en_attente' && styles.statusButtonActive
              ]}
              onPress={() => setStatus('en_attente')}
            >
              <Text style={[
                styles.statusButtonText,
                status === 'en_attente' && styles.statusButtonTextActive
              ]}>En attente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'traite' && styles.statusButtonActiveGreen
              ]}
              onPress={() => setStatus('traite')}
            >
              <Text style={[
                styles.statusButtonText,
                status === 'traite' && styles.statusButtonTextActive
              ]}>Traite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.filter(item => !item.toDelete).map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={styles.removeText}>Supprimer</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                value={item.description}
                onChangeText={(v) => updateItem(item.id, 'description', v)}
                placeholder="Description du materiel"
                multiline
                numberOfLines={3}
              />

              <View style={styles.quantityRow}>
                <Text style={styles.smallLabel}>Quantite:</Text>
                <TextInput
                  style={[styles.input, styles.quantityInput]}
                  value={item.quantity}
                  onChangeText={(v) => updateItem(item.id, 'quantity', v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>+ Ajouter un item</Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes speciales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={specialNotes}
            onChangeText={setSpecialNotes}
            placeholder="Instructions particulieres..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  smallLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  statusButtonActiveGreen: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  statusButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#333',
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  removeText: {
    color: '#DC2626',
    fontSize: 14,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#64191E',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
