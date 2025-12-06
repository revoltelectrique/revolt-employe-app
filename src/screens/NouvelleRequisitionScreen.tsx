import React, { useState } from 'react'
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
import { useAuth } from '../contexts/AuthContext'
import { ImagePicker } from '../components'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'

interface ItemLine {
  id: string
  description: string
  quantity: string
}

interface PrefillData {
  clientName?: string
  servicentreNumber?: string
  deliveryLocation?: string
}

export default function NouvelleRequisitionScreen() {
  const navigation = useNavigation()
  const route = useRoute<any>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Récupérer les données pré-remplies si disponibles
  const prefill: PrefillData = route.params?.prefill || {}

  const [clientName, setClientName] = useState(prefill.clientName || '')
  const [servicentreNumber, setServicentreNumber] = useState(prefill.servicentreNumber || '')
  const [deliveryLocation, setDeliveryLocation] = useState(prefill.deliveryLocation || '')
  const [specialNotes, setSpecialNotes] = useState('')
  const [items, setItems] = useState<ItemLine[]>([
    { id: '1', description: '', quantity: '1' },
  ])
  const [images, setImages] = useState<string[]>([])

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: '1' },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof ItemLine, value: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async () => {
    if (!clientName.trim() || !servicentreNumber.trim() || !deliveryLocation.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires')
      return
    }

    const validItems = items.filter((item) => item.description.trim())
    if (validItems.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins un item')
      return
    }

    setLoading(true)

    try {
      // Générer le numéro de réquisition
      const { data: lastReq } = await supabase
        .from('material_requests')
        .select('request_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let nextNumber = 100
      if (lastReq?.request_number) {
        const match = lastReq.request_number.match(/REQ-(\d+)/)
        if (match) nextNumber = parseInt(match[1]) + 1
      }
      const requestNumber = `REQ-${nextNumber}`

      // Créer la réquisition
      const { data: req, error: reqError } = await supabase
        .from('material_requests')
        .insert({
          request_number: requestNumber,
          requester_id: user?.id,
          client_name: clientName.trim(),
          servicentre_call_number: servicentreNumber.trim(),
          delivery_location: deliveryLocation.trim(),
          special_notes: specialNotes.trim() || null,
          status: 'en_attente',
        })
        .select()
        .single()

      if (reqError) throw reqError

      // Ajouter les items
      const itemsToInsert = validItems.map((item) => ({
        material_request_id: req.id,
        description: item.description.trim(),
        quantity: parseInt(item.quantity) || 1,
      }))

      await supabase.from('material_request_items').insert(itemsToInsert)

      // Upload des images si présentes
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const uri = images[i]
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          })
          const fileName = `${req.id}/${Date.now()}_${i}.jpg`

          await supabase.storage
            .from('material-request-attachments')
            .upload(fileName, decode(base64), {
              contentType: 'image/jpeg',
            })
        }
      }

      Alert.alert('Succès', `Réquisition ${requestNumber} créée!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de créer la réquisition')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Informations générales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>

          <Text style={styles.label}>Nom du client *</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Ex: Ville de Baie-Comeau"
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
            placeholder="Ex: 123 rue Principale"
          />
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items à commander</Text>
          {items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Text style={styles.removeText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                value={item.description}
                onChangeText={(v) => updateItem(item.id, 'description', v)}
                placeholder="Description du matériel"
                multiline
                numberOfLines={3}
              />

              <View style={styles.quantityRow}>
                <Text style={styles.smallLabel}>Quantité</Text>
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
          <Text style={styles.sectionTitle}>Notes spéciales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={specialNotes}
            onChangeText={setSpecialNotes}
            placeholder="Instructions particulières, urgence, etc..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pièces jointes</Text>
          <ImagePicker
            images={images}
            onImagesChange={setImages}
            maxImages={5}
            label="Photos (optionnel)"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Créer la réquisition</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  submitButton: {
    backgroundColor: '#2563EB',
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
