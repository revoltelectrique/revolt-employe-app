import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import SignatureScreen from 'react-native-signature-canvas'
import { supabase } from '../lib/supabase'
import {
  GeneratorInstallation,
  GeneratorInstallationPhoto,
  GeneratorInstallationStatus,
  GeneratorBrand,
  GENERATOR_STATUS_LABELS,
  GENERATOR_STATUS_COLORS
} from '../types'
import { useAuth } from '../contexts/AuthContext'
import Button from '../components/Button'
import Card from '../components/Card'
import Badge from '../components/Badge'

const STATUS_ORDER: GeneratorInstallationStatus[] = [
  'a_planifier',
  'planifie',
  'en_cours',
  'complete',
  'documents_envoyes'
]

export default function DetailsGeneratriceScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { profile } = useAuth()
  const signatureRef = useRef<any>(null)

  const [installation, setInstallation] = useState<GeneratorInstallation | null>(null)
  const [photos, setPhotos] = useState<GeneratorInstallationPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showBrandPicker, setShowBrandPicker] = useState(false)

  // Form state
  const [status, setStatus] = useState<GeneratorInstallationStatus>('a_planifier')
  const [generatorBrand, setGeneratorBrand] = useState<GeneratorBrand | ''>('')
  const [generatorSerial, setGeneratorSerial] = useState('')
  const [transferSwitchSerial, setTransferSwitchSerial] = useState('')
  const [installerName, setInstallerName] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [route.params?.id])

  const loadData = async () => {
    try {
      const { data: inst, error } = await supabase
        .from('generator_installations')
        .select('*')
        .eq('id', route.params?.id)
        .single()

      if (error) throw error

      setInstallation(inst)
      setStatus(inst.status)
      setGeneratorBrand(inst.generator_brand || '')
      setGeneratorSerial(inst.generator_serial || '')
      setTransferSwitchSerial(inst.transfer_switch_serial || '')
      setInstallerName(inst.installer_name || '')
      setNotes(inst.notes || '')

      // Load photos
      const { data: photosData } = await supabase
        .from('generator_installation_photos')
        .select('*')
        .eq('installation_id', route.params?.id)
        .order('uploaded_at', { ascending: false })

      setPhotos(photosData || [])
    } catch (error) {
      console.error('Error loading installation:', error)
      Alert.alert('Erreur', 'Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!installation) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('generator_installations')
        .update({
          status,
          generator_brand: generatorBrand || null,
          generator_serial: generatorSerial || null,
          transfer_switch_serial: transferSwitchSerial || null,
          installer_name: installerName || null,
          notes: notes || null,
        })
        .eq('id', installation.id)

      if (error) throw error

      Alert.alert('Succès', 'Modifications enregistrées')
      loadData()
    } catch (error) {
      console.error('Error saving:', error)
      Alert.alert('Erreur', 'Impossible de sauvegarder')
    } finally {
      setSaving(false)
    }
  }

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'L\'accès à la caméra est nécessaire')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    })

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri)
    }
  }

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      base64: false,
    })

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri)
    }
  }

  const uploadPhoto = async (uri: string) => {
    if (!installation) return

    try {
      const fileName = `${installation.id}/${Date.now()}.jpg`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('generator-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('generator-photos')
        .getPublicUrl(fileName)

      await supabase.from('generator_installation_photos').insert({
        installation_id: installation.id,
        photo_url: publicUrl,
        uploaded_by: profile?.id,
      })

      Alert.alert('Succès', 'Photo ajoutée')
      loadData()
    } catch (error) {
      console.error('Error uploading photo:', error)
      Alert.alert('Erreur', 'Impossible d\'ajouter la photo')
    }
  }

  const handleDeletePhoto = (photo: GeneratorInstallationPhoto) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cette photo?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('generator_installation_photos')
                .delete()
                .eq('id', photo.id)

              loadData()
            } catch (error) {
              console.error('Error deleting photo:', error)
            }
          },
        },
      ]
    )
  }

  const handleSignature = async (signature: string) => {
    if (!installation) return
    setShowSignatureModal(false)

    try {
      // Upload signature image
      const fileName = `signatures/${installation.id}_${Date.now()}.png`
      const response = await fetch(signature)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('generator-photos')
        .upload(fileName, blob, { contentType: 'image/png' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('generator-photos')
        .getPublicUrl(fileName)

      // Update installation
      await supabase
        .from('generator_installations')
        .update({
          signature_image_url: publicUrl,
          signature_timestamp: new Date().toISOString(),
          signature_ip: 'App Mobile',
        })
        .eq('id', installation.id)

      Alert.alert('Succès', 'Signature enregistrée')
      loadData()
    } catch (error) {
      console.error('Error saving signature:', error)
      Alert.alert('Erreur', 'Impossible d\'enregistrer la signature')
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA')
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#64191E" />
        </View>
      </SafeAreaView>
    )
  }

  if (!installation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Installation non trouvée</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>#{installation.client_number}</Text>
          <Text style={styles.headerSubtitle}>{installation.client_name}</Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#64191E" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#64191E" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Info Client */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Informations client</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{installation.address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{installation.phone || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{installation.email || '-'}</Text>
          </View>
        </Card>

        {/* Statut */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Statut</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowStatusPicker(true)}
          >
            <Badge
              text={GENERATOR_STATUS_LABELS[status]}
              color={GENERATOR_STATUS_COLORS[status]}
            />
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </Card>

        {/* Détails installation */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Détails installation</Text>

          <Text style={styles.label}>Marque de génératrice</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowBrandPicker(true)}
          >
            <Text style={generatorBrand ? styles.pickerText : styles.pickerPlaceholder}>
              {generatorBrand || 'Sélectionner...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          <Text style={styles.label}>N° série génératrice</Text>
          <TextInput
            style={styles.input}
            value={generatorSerial}
            onChangeText={setGeneratorSerial}
            placeholder="Numéro de série..."
          />

          <Text style={styles.label}>N° série transfer switch</Text>
          <TextInput
            style={styles.input}
            value={transferSwitchSerial}
            onChangeText={setTransferSwitchSerial}
            placeholder="Numéro de série..."
          />

          <Text style={styles.label}>Installateur</Text>
          <TextInput
            style={styles.input}
            value={installerName}
            onChangeText={setInstallerName}
            placeholder="Nom de l'installateur..."
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes..."
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Photos */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.iconButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={24} color="#64191E" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handlePickPhoto}>
                <Ionicons name="images" size={24} color="#64191E" />
              </TouchableOpacity>
            </View>
          </View>

          {photos.length === 0 ? (
            <Text style={styles.emptyText}>Aucune photo</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoContainer}
                  onLongPress={() => handleDeletePhoto(photo)}
                >
                  <Image source={{ uri: photo.photo_url }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card>

        {/* Signature */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Signature client</Text>

          {installation.signature_image_url ? (
            <View>
              <Image
                source={{ uri: installation.signature_image_url }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
              <Text style={styles.signatureDate}>
                Signé le {formatDate(installation.signature_timestamp)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.signatureButton}
              onPress={() => setShowSignatureModal(true)}
            >
              <Ionicons name="create-outline" size={24} color="#64191E" />
              <Text style={styles.signatureButtonText}>Capturer signature</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Changer le statut</Text>
            {STATUS_ORDER.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.modalOption, status === s && styles.modalOptionActive]}
                onPress={() => {
                  setStatus(s)
                  setShowStatusPicker(false)
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: GENERATOR_STATUS_COLORS[s] }]} />
                <Text style={styles.modalOptionText}>{GENERATOR_STATUS_LABELS[s]}</Text>
                {status === s && <Ionicons name="checkmark" size={20} color="#64191E" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Brand Picker Modal */}
      <Modal visible={showBrandPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Marque de génératrice</Text>
            {(['BE', 'Westinghouse'] as GeneratorBrand[]).map((brand) => (
              <TouchableOpacity
                key={brand}
                style={[styles.modalOption, generatorBrand === brand && styles.modalOptionActive]}
                onPress={() => {
                  setGeneratorBrand(brand)
                  setShowBrandPicker(false)
                }}
              >
                <Text style={styles.modalOptionText}>{brand}</Text>
                {generatorBrand === brand && <Ionicons name="checkmark" size={20} color="#64191E" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowBrandPicker(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={showSignatureModal} animationType="slide">
        <SafeAreaView style={styles.signatureModal}>
          <View style={styles.signatureHeader}>
            <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
              <Text style={styles.signatureCancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.signatureTitle}>Signature du client</Text>
            <TouchableOpacity onPress={() => signatureRef.current?.clearSignature()}>
              <Text style={styles.signatureClearText}>Effacer</Text>
            </TouchableOpacity>
          </View>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleSignature}
            onEmpty={() => Alert.alert('Erreur', 'Veuillez signer avant de confirmer')}
            descriptionText="Signez ici"
            clearText="Effacer"
            confirmText="Confirmer"
            webStyle={`.m-signature-pad--footer { display: flex; flex-direction: row; justify-content: space-around; }`}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerText: {
    fontSize: 14,
    color: '#333',
  },
  pickerPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  photoContainer: {
    marginRight: 10,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  signatureDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#64191E',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 24,
  },
  signatureButtonText: {
    fontSize: 16,
    color: '#64191E',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionActive: {
    backgroundColor: '#f5f5f5',
  },
  modalOptionText: {
    fontSize: 16,
    flex: 1,
    marginLeft: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalCancel: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64191E',
    fontWeight: '600',
  },
  signatureModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  signatureCancelText: {
    fontSize: 16,
    color: '#64191E',
  },
  signatureClearText: {
    fontSize: 16,
    color: '#64191E',
  },
})
