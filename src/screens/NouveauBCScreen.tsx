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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ImagePicker } from '../components'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { useOffline } from '../contexts/OfflineContext'
import { useOfflineQueue } from '../lib/offlineQueue'

interface ItemLine {
  id: string
  description: string
  quantity: string
  price: string
}

interface FromRequisition {
  id: string
  clientName: string
  servicentreNumber: string
  items?: Array<{ description: string; quantity: number }>
}

export default function NouveauBCScreen() {
  const navigation = useNavigation()
  const route = useRoute<any>()
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const { addMutation } = useOfflineQueue()
  const [loading, setLoading] = useState(false)

  // Récupérer les données depuis la réquisition si disponibles
  const fromRequisition: FromRequisition | undefined = route.params?.fromRequisition

  const [supplierName, setSupplierName] = useState('')
  const [isBillable, setIsBillable] = useState(fromRequisition ? true : false)
  const [servicentreNumber, setServicentreNumber] = useState(fromRequisition?.servicentreNumber || '')
  const [clientName, setClientName] = useState(fromRequisition?.clientName || '')

  // Préremplir les items depuis la réquisition si disponibles
  const initialItems: ItemLine[] = fromRequisition?.items?.length
    ? fromRequisition.items.map((item, index) => ({
        id: String(index + 1),
        description: item.description,
        quantity: String(item.quantity),
        price: '',
      }))
    : [{ id: '1', description: '', quantity: '1', price: '' }]

  const [items, setItems] = useState<ItemLine[]>(initialItems)
  const [images, setImages] = useState<string[]>([])

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: '1', price: '' },
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
    if (!supplierName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom du fournisseur')
      return
    }

    if (isBillable && (!servicentreNumber.trim() || !clientName.trim())) {
      Alert.alert('Erreur', 'Veuillez remplir les champs pour la facturation')
      return
    }

    const validItems = items.filter((item) => item.description.trim())
    if (validItems.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins un item')
      return
    }

    setLoading(true)

    if (isOnline) {
      try {
        // Générer le numéro de BC
        const { data: lastPO } = await supabase
          .from('purchase_orders')
          .select('po_number')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let nextNumber = 1
        if (lastPO?.po_number) {
          const match = lastPO.po_number.match(/BC-(\d+)/)
          if (match) nextNumber = parseInt(match[1]) + 1
        }
        const poNumber = `BC-${String(nextNumber).padStart(4, '0')}`

        // Créer le BC
        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            requester_id: user?.id,
            supplier_name: supplierName.trim(),
            is_billable: isBillable,
            servicentre_call_number: isBillable ? servicentreNumber.trim() : null,
            client_name: isBillable ? clientName.trim() : null,
            status: 'en_attente',
            material_request_id: fromRequisition?.id || null,
          })
          .select()
          .single()

        if (poError) throw poError

        // Si créé depuis une réquisition, marquer la réquisition comme traitée
        if (fromRequisition?.id) {
          await supabase
            .from('material_requests')
            .update({ status: 'traite', updated_at: new Date().toISOString() })
            .eq('id', fromRequisition.id)
        }

        // Ajouter les items
        const itemsToInsert = validItems.map((item) => ({
          purchase_order_id: po.id,
          description: item.description.trim(),
          quantity: parseInt(item.quantity) || 1,
          price: item.price ? parseFloat(item.price) : null,
        }))

        await supabase.from('purchase_order_items').insert(itemsToInsert)

        // Upload des images si présentes
        if (images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const uri = images[i]
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            })
            const fileName = `${po.id}/${Date.now()}_${i}.jpg`

            await supabase.storage
              .from('purchase-order-attachments')
              .upload(fileName, decode(base64), {
                contentType: 'image/jpeg',
              })
          }
        }

        Alert.alert('Succès', `Bon de commande ${poNumber} créé!`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ])
      } catch (error) {
        console.error('Erreur:', error)
        Alert.alert('Erreur', 'Impossible de créer le bon de commande')
      }
    } else {
      // Mode hors ligne - Ajouter à la queue
      const tempPONumber = `BC-OFFLINE-${Date.now()}`

      addMutation({
        type: 'insert',
        table: 'purchase_orders',
        data: {
          po_number: tempPONumber, // Sera remplacé côté serveur
          requester_id: user?.id,
          supplier_name: supplierName.trim(),
          is_billable: isBillable,
          servicentre_call_number: isBillable ? servicentreNumber.trim() : null,
          client_name: isBillable ? clientName.trim() : null,
          status: 'en_attente',
          material_request_id: fromRequisition?.id || null,
          _items: validItems.map((item) => ({
            description: item.description.trim(),
            quantity: parseInt(item.quantity) || 1,
            price: item.price ? parseFloat(item.price) : null,
          })),
        },
        maxRetries: 5,
      })

      if (images.length > 0) {
        Alert.alert(
          'Mode hors ligne',
          'Le bon de commande sera créé quand vous serez connecté. Les images ne seront pas envoyées (non supporté hors ligne).',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        )
      } else {
        Alert.alert(
          'Mode hors ligne',
          'Le bon de commande sera créé quand vous serez connecté.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        )
      }
    }

    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Indicateur mode hors ligne */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 Mode hors ligne - Le BC sera créé lors de la reconnexion
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Fournisseur */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <Text style={styles.label}>Fournisseur *</Text>
          <TextInput
            style={styles.input}
            value={supplierName}
            onChangeText={setSupplierName}
            placeholder="Nom du fournisseur"
          />
        </View>

        {/* Facturable */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Facturable au client?</Text>
            <Switch
              value={isBillable}
              onValueChange={setIsBillable}
              trackColor={{ false: '#ddd', true: '#64191E' }}
              thumbColor="#fff"
            />
          </View>

          {isBillable && (
            <>
              <Text style={styles.label}>N° Servicentre *</Text>
              <TextInput
                style={styles.input}
                value={servicentreNumber}
                onChangeText={setServicentreNumber}
                placeholder="Ex: SC-12345"
              />

              <Text style={styles.label}>Client à facturer *</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Nom du client"
              />
            </>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produits</Text>
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
                style={styles.input}
                value={item.description}
                onChangeText={(v) => updateItem(item.id, 'description', v)}
                placeholder="Description"
                multiline
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.smallLabel}>Quantité</Text>
                  <TextInput
                    style={styles.input}
                    value={item.quantity}
                    onChangeText={(v) => updateItem(item.id, 'quantity', v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.smallLabel}>Prix ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={item.price}
                    onChangeText={(v) => updateItem(item.id, 'price', v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>+ Ajouter un item</Text>
          </TouchableOpacity>
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
            <Text style={styles.submitButtonText}>Créer le bon de commande</Text>
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
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  offlineBannerText: {
    fontSize: 12,
    color: '#DC2626',
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
    marginBottom: 4,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
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
