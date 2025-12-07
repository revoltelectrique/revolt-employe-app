import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Input, Button, Card } from '../components'
import { ReceiptCategory, PaymentMethod, OCRData } from '../types'

// URL de l'API du portail (production)
const PORTAIL_API_URL = 'https://portail.revoltelectrique.com/api'

export default function NouveauRecuScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [categories, setCategories] = useState<ReceiptCategory[]>([])
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  // Formulaire
  const [vendorName, setVendorName] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [receiptReference, setReceiptReference] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('carte_credit')
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('receipt_categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Erreur chargement catégories:', error)
    }
  }

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire pour prendre une photo du reçu.')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setImageUri(asset.uri)
        setImageBase64(asset.base64 || null)

        // Lancer l'OCR automatiquement
        if (asset.base64) {
          runOCR(asset.base64)
        }
      }
    } catch (error) {
      console.error('Erreur prise photo:', error)
      Alert.alert('Erreur', 'Impossible de prendre la photo')
    }
  }

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour sélectionner une photo.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setImageUri(asset.uri)
        setImageBase64(asset.base64 || null)

        // Lancer l'OCR automatiquement
        if (asset.base64) {
          runOCR(asset.base64)
        }
      }
    } catch (error) {
      console.error('Erreur sélection image:', error)
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image')
    }
  }

  const runOCR = async (base64: string) => {
    setOcrLoading(true)
    setIsManualEntry(false)

    try {
      const response = await fetch(`${PORTAIL_API_URL}/receipts/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ imageBase64: base64 })
      })

      // Vérifier que la réponse est du JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Réponse non-JSON reçue:', contentType)
        throw new Error('Le serveur n\'a pas retourné du JSON. Vérifiez l\'URL du portail.')
      }

      const responseText = await response.text()

      // Vérifier que le texte n'est pas vide et ressemble à du JSON
      if (!responseText || (!responseText.startsWith('{') && !responseText.startsWith('['))) {
        console.error('Réponse invalide:', responseText.substring(0, 200))
        throw new Error('Réponse invalide du serveur')
      }

      const result = JSON.parse(responseText)

      if (result.success && result.data) {
        const data: OCRData = result.data

        // Remplir les champs avec les données OCR
        if (data.vendor_name) setVendorName(data.vendor_name)
        if (data.receipt_date) setReceiptDate(data.receipt_date)
        if (data.receipt_reference) setReceiptReference(data.receipt_reference)
        if (data.subtotal !== null && data.subtotal !== undefined) setSubtotal(data.subtotal.toString())
        if (data.tax_amount !== null && data.tax_amount !== undefined) setTaxAmount(data.tax_amount.toString())
        if (data.total_amount !== null && data.total_amount !== undefined) setTotalAmount(data.total_amount.toString())
        setOcrConfidence(data.confidence ?? 0)

        if ((data.confidence ?? 0) < 30) {
          Alert.alert(
            'OCR limité',
            'La reconnaissance automatique n\'a pas pu extraire beaucoup d\'informations. Veuillez vérifier et compléter les champs manuellement.',
            [{ text: 'OK' }]
          )
          setIsManualEntry(true)
        } else {
          Alert.alert(
            'Données extraites',
            `Confiance: ${data.confidence}%\nVeuillez vérifier les informations extraites.`,
            [{ text: 'OK' }]
          )
        }
      } else {
        setIsManualEntry(true)
        Alert.alert(
          'OCR non disponible',
          result.error || 'La reconnaissance automatique n\'est pas disponible. Veuillez saisir les informations manuellement.',
          [{ text: 'OK' }]
        )
      }
    } catch (error: any) {
      console.error('Erreur OCR:', error?.message || error)
      setIsManualEntry(true)
      Alert.alert(
        'Erreur OCR',
        `Impossible d'analyser le reçu automatiquement.\n\n${error?.message || 'Erreur inconnue'}\n\nVeuillez saisir les informations manuellement.`,
        [{ text: 'OK' }]
      )
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!imageUri || !imageBase64) {
      Alert.alert('Erreur', 'Veuillez prendre une photo du reçu')
      return
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer le montant total')
      return
    }

    if (!categoryId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une catégorie')
      return
    }

    setLoading(true)

    try {
      // 1. Upload de l'image vers Supabase Storage
      const fileName = `${user?.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, decode(imageBase64), {
          contentType: 'image/jpeg'
        })

      if (uploadError) throw uploadError

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      const imageUrl = urlData.publicUrl

      // 2. Créer le reçu dans la base de données
      const { data: receipt, error: insertError } = await supabase
        .from('receipts')
        .insert({
          submitted_by: user?.id,
          vendor_name: vendorName || null,
          receipt_date: receiptDate || null,
          receipt_reference: receiptReference || null,
          subtotal: subtotal ? parseFloat(subtotal) : null,
          tax_amount: taxAmount ? parseFloat(taxAmount) : null,
          total_amount: parseFloat(totalAmount),
          category_id: categoryId,
          payment_method: paymentMethod,
          project_name: projectName || null,
          notes: notes || null,
          image_url: imageUrl,
          ocr_confidence: ocrConfidence,
          is_manually_entered: isManualEntry
        })
        .select()
        .single()

      if (insertError) throw insertError

      // 3. Envoyer notification à l'admin
      try {
        const category = categories.find(c => c.id === categoryId)
        await fetch(`${PORTAIL_API_URL}/notifications/receipt-submitted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiptNumber: receipt.receipt_number,
            employeeName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email,
            vendorName: vendorName,
            totalAmount: parseFloat(totalAmount),
            category: category?.name,
            paymentMethod: paymentMethod
          })
        })
      } catch (notifError) {
        console.error('Erreur notification:', notifError)
        // On ne bloque pas si la notification échoue
      }

      Alert.alert(
        'Succès',
        `Reçu ${receipt.receipt_number} soumis avec succès!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    } catch (error) {
      console.error('Erreur soumission:', error)
      Alert.alert('Erreur', 'Impossible de soumettre le reçu. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  // Helper pour décoder base64
  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  const paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'carte_credit', label: 'Carte crédit' },
    { value: 'carte_debit', label: 'Carte débit' },
    { value: 'cash', label: 'Cash (remboursement)' }
  ]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Section Photo */}
          <Card style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Photo du reçu *</Text>

            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                {ocrLoading && (
                  <View style={styles.ocrOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.ocrText}>Analyse en cours...</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.changePhotoBtn}
                  onPress={() => {
                    setImageUri(null)
                    setImageBase64(null)
                  }}
                >
                  <Text style={styles.changePhotoText}>Changer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                  <Text style={styles.photoButtonIcon}>📷</Text>
                  <Text style={styles.photoButtonText}>Prendre une photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                  <Text style={styles.photoButtonIcon}>🖼️</Text>
                  <Text style={styles.photoButtonText}>Galerie</Text>
                </TouchableOpacity>
              </View>
            )}

            {ocrConfidence !== null && (
              <View style={styles.ocrBadge}>
                <Text style={styles.ocrBadgeText}>
                  {isManualEntry ? 'Saisie manuelle' : `OCR: ${ocrConfidence}% confiance`}
                </Text>
              </View>
            )}
          </Card>

          {/* Informations du reçu */}
          <Card style={styles.formSection}>
            <Text style={styles.sectionTitle}>Informations du reçu</Text>

            <Input
              label="Fournisseur"
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="Nom du commerce"
            />

            <Input
              label="Date du reçu"
              value={receiptDate}
              onChangeText={setReceiptDate}
              placeholder="AAAA-MM-JJ"
            />

            <Input
              label="No. référence"
              value={receiptReference}
              onChangeText={setReceiptReference}
              placeholder="Numéro sur le reçu"
            />
          </Card>

          {/* Montants */}
          <Card style={styles.formSection}>
            <Text style={styles.sectionTitle}>Montants</Text>

            <Input
              label="Sous-total"
              value={subtotal}
              onChangeText={setSubtotal}
              placeholder="0.00"
              keyboardType="decimal-pad"
              leftIcon={<Text style={styles.dollarIcon}>$</Text>}
            />

            <Input
              label="Taxes"
              value={taxAmount}
              onChangeText={setTaxAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              leftIcon={<Text style={styles.dollarIcon}>$</Text>}
            />

            <Input
              label="Total *"
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              leftIcon={<Text style={styles.dollarIcon}>$</Text>}
              required
            />
          </Card>

          {/* Classification */}
          <Card style={styles.formSection}>
            <Text style={styles.sectionTitle}>Classification</Text>

            <Text style={styles.label}>Catégorie *</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    categoryId === cat.id && styles.categoryChipActive
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      categoryId === cat.id && styles.categoryChipTextActive
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Méthode de paiement *</Text>
            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentChip,
                    paymentMethod === method.value && styles.paymentChipActive
                  ]}
                  onPress={() => setPaymentMethod(method.value)}
                >
                  <Text
                    style={[
                      styles.paymentChipText,
                      paymentMethod === method.value && styles.paymentChipTextActive
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Projet / Chantier"
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Nom du projet (optionnel)"
            />
          </Card>

          {/* Notes */}
          <Card style={styles.formSection}>
            <Input
              label="Notes (optionnel)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Justification ou commentaires..."
              multiline
              numberOfLines={3}
            />
          </Card>

          {/* Bouton Soumettre */}
          <Button
            title={loading ? 'Soumission...' : 'Soumettre le reçu'}
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || !imageUri || !totalAmount || !categoryId}
            style={styles.submitButton}
          />

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    padding: 16
  },
  photoSection: {
    marginBottom: 16
  },
  formSection: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed'
  },
  photoButtonIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  photoButtonText: {
    fontSize: 14,
    color: '#666'
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden'
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12
  },
  ocrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  ocrText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14
  },
  changePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 12
  },
  ocrBadge: {
    marginTop: 12,
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start'
  },
  ocrBadgeText: {
    color: '#2563EB',
    fontSize: 12
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8
  },
  dollarIcon: {
    fontSize: 16,
    color: '#666'
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  categoryChipActive: {
    backgroundColor: '#64191E',
    borderColor: '#64191E'
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666'
  },
  categoryChipTextActive: {
    color: '#fff'
  },
  paymentMethods: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16
  },
  paymentChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  paymentChipActive: {
    backgroundColor: '#64191E',
    borderColor: '#64191E'
  },
  paymentChipText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  },
  paymentChipTextActive: {
    color: '#fff'
  },
  submitButton: {
    marginTop: 8
  }
})
