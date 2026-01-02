import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import SignatureScreen from 'react-native-signature-canvas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { InspectionResponseStatus } from '../types'

// Points de vérification PEMP
const PEMP_ITEMS = [
  { number: 1, title: 'Plaques signalétiques, étiquettes de danger', description: 'présence • propreté • lisibilité' },
  { number: 2, title: 'Échelle ou marches', description: 'état général • dommages • débris • propreté' },
  { number: 3, title: 'Manuel d\'utilisation', description: 'présent dans le boîtier • bon état • version française' },
  { number: 4, title: 'Plancher de la plate-forme', description: 'désencombré • propreté • état structure/soudures' },
  { number: 5, title: 'Portillon d\'entrée, barrières', description: 'mouvement • verrouillage • pièces manquantes' },
  { number: 6, title: 'Garde-corps et ancrages', description: 'état adéquat • identifiés' },
  { number: 7, title: 'Pneus et roues', description: 'entailles • écrous desserrés • gonflement' },
  { number: 8, title: 'Mode d\'alimentation', description: 'batterie | propane | essence | diesel' },
  { number: 9, title: 'Fluides (Niveau)', description: 'huile hydraulique • huile moteur • refroidissement' },
  { number: 10, title: 'Commandes de fonctionnement', description: 'porteur • plate-forme • freins' },
  { number: 11, title: 'Système élévateur (groupe A)', description: 'souplesse du mouvement vertical' },
  { number: 12, title: 'Élévation, rotation (groupe B)', description: 'fonctionnement adéquat' },
  { number: 13, title: 'Stabilisateurs / vérin', description: 'fonctionnement adéquat' },
  { number: 14, title: 'Composants structuraux', description: 'dommages • pièces cassées • fissures soudures' },
  { number: 15, title: 'Point d\'attache plate-forme', description: 'pièces manquantes ou desserrées' },
  { number: 16, title: 'Canalisations hydrauliques', description: 'fuites • raccords desserrés' },
  { number: 17, title: 'Dispositifs de sécurité', description: 'avertisseurs sonores • lumineux • descente urgence' },
]

interface ItemResponse {
  status: InspectionResponseStatus | null
  comment: string
}

export default function NouvelleInspectionScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { profile, user } = useAuth()
  const signatureRef = useRef<any>(null)

  const { typeCode, typeId } = route.params || {}

  const [saving, setSaving] = useState(false)
  const [showSignature, setShowSignature] = useState(false)

  // Form state
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [equipmentOwner, setEquipmentOwner] = useState('')
  const [equipmentSerial, setEquipmentSerial] = useState('')
  const [equipmentModel, setEquipmentModel] = useState('')
  const [equipmentCategory, setEquipmentCategory] = useState<'3A' | '3B'>('3A')
  const [nominalLoad, setNominalLoad] = useState('')
  const [hourMeter, setHourMeter] = useState('')
  const [location, setLocation] = useState('')
  const [fuelType, setFuelType] = useState<'batterie' | 'propane' | 'essence' | 'diesel'>('batterie')
  const [notes, setNotes] = useState('')
  const [operatorSignature, setOperatorSignature] = useState<string | null>(null)
  const [operatorInitials, setOperatorInitials] = useState('')

  // Responses
  const [responses, setResponses] = useState<Record<number, ItemResponse>>(() => {
    const initial: Record<number, ItemResponse> = {}
    PEMP_ITEMS.forEach(item => {
      initial[item.number] = { status: null, comment: '' }
    })
    return initial
  })

  const updateResponse = (itemNumber: number, status: InspectionResponseStatus) => {
    setResponses(prev => ({
      ...prev,
      [itemNumber]: { ...prev[itemNumber], status }
    }))
  }

  const updateComment = (itemNumber: number, comment: string) => {
    setResponses(prev => ({
      ...prev,
      [itemNumber]: { ...prev[itemNumber], comment }
    }))
  }

  const handleSignature = (signature: string) => {
    setOperatorSignature(signature)
    setShowSignature(false)
  }

  const clearSignature = () => {
    setOperatorSignature(null)
    signatureRef.current?.clearSignature()
  }

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft) {
      if (!operatorSignature) {
        Alert.alert('Erreur', 'La signature de l\'opérateur est requise')
        return
      }

      const unanswered = PEMP_ITEMS.filter(item => !responses[item.number]?.status)
      if (unanswered.length > 0) {
        Alert.alert('Erreur', `Veuillez répondre à tous les points (${unanswered.length} manquants)`)
        return
      }
    }

    setSaving(true)
    try {
      // Create inspection form
      const { data: form, error: formError } = await supabase
        .from('inspection_forms')
        .insert({
          inspection_type_id: typeId,
          user_id: user?.id,
          inspection_date: inspectionDate,
          equipment_owner: equipmentOwner || null,
          equipment_serial: equipmentSerial || null,
          equipment_model: equipmentModel || null,
          equipment_category: equipmentCategory,
          nominal_load: nominalLoad || null,
          hour_meter: hourMeter || null,
          location: location || null,
          operator_signature: operatorSignature,
          operator_initials: operatorInitials || null,
          status: isDraft ? 'draft' : 'completed',
          notes: notes || null,
          completed_at: isDraft ? null : new Date().toISOString(),
        })
        .select()
        .single()

      if (formError) throw formError

      // Save responses
      const responseInserts = PEMP_ITEMS.map(item => ({
        form_id: form.id,
        item_id: null,
        status: responses[item.number]?.status || null,
        value: JSON.stringify({
          item_number: item.number,
          fuel_type: item.number === 8 ? fuelType : undefined
        }),
        comment: responses[item.number]?.comment || null,
      }))

      await supabase.from('inspection_responses').insert(responseInserts)

      Alert.alert(
        'Succès',
        isDraft ? 'Brouillon sauvegardé!' : 'Inspection soumise avec succès!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    } catch (error) {
      console.error('Error saving inspection:', error)
      Alert.alert('Erreur', 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const renderStatusButton = (itemNumber: number, status: InspectionResponseStatus, label: string, color: string) => {
    const isSelected = responses[itemNumber]?.status === status
    return (
      <TouchableOpacity
        style={[
          styles.statusButton,
          { backgroundColor: isSelected ? color : color + '30' }
        ]}
        onPress={() => updateResponse(itemNumber, status)}
      >
        <Text style={[styles.statusButtonText, { color: isSelected ? '#fff' : color }]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  const handleConfirmSignature = () => {
    signatureRef.current?.readSignature()
  }

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature()
  }

  if (showSignature) {
    return (
      <SafeAreaView style={styles.signatureContainer}>
        <View style={styles.signatureHeader}>
          <Text style={styles.signatureTitle}>Signature de l'opérateur</Text>
          <TouchableOpacity onPress={() => setShowSignature(false)}>
            <Text style={styles.cancelButton}>Annuler</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.signatureCanvasWrapper}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleSignature}
            onEmpty={() => Alert.alert('Erreur', 'Veuillez dessiner votre signature')}
            descriptionText=""
            clearText=""
            confirmText=""
            autoClear={false}
            backgroundColor="white"
            penColor="black"
            webStyle={`
              .m-signature-pad {
                box-shadow: none;
                border: none;
                width: 100%;
                height: 100%;
                margin: 0;
              }
              .m-signature-pad--body {
                border: 1px solid #e5e7eb;
                margin: 10px;
                border-radius: 8px;
              }
              .m-signature-pad--footer {
                display: none !important;
              }
            `}
          />
        </View>
        {/* Boutons natifs React Native */}
        <View style={styles.signatureButtons}>
          <TouchableOpacity
            style={styles.signatureClearButton}
            onPress={handleClearSignature}
          >
            <Text style={styles.signatureButtonText}>Effacer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signatureConfirmButton}
            onPress={handleConfirmSignature}
          >
            <Text style={styles.signatureButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection PEMP</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Infos générales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <TextInput
                style={styles.input}
                value={inspectionDate}
                onChangeText={setInspectionDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lieu</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Chantier"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Modèle</Text>
              <TextInput
                style={styles.input}
                value={equipmentModel}
                onChangeText={setEquipmentModel}
                placeholder="Ex: JLG 450AJ"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>N° série</Text>
              <TextInput
                style={styles.input}
                value={equipmentSerial}
                onChangeText={setEquipmentSerial}
                placeholder="Série"
              />
            </View>
          </View>

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.categoryButton, equipmentCategory === '3A' && styles.categorySelected]}
              onPress={() => setEquipmentCategory('3A')}
            >
              <Text style={[styles.categoryText, equipmentCategory === '3A' && styles.categoryTextSelected]}>
                3A (Ciseaux)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, equipmentCategory === '3B' && styles.categorySelected]}
              onPress={() => setEquipmentCategory('3B')}
            >
              <Text style={[styles.categoryText, equipmentCategory === '3B' && styles.categoryTextSelected]}>
                3B (Boom)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Horomètre</Text>
              <TextInput
                style={styles.input}
                value={hourMeter}
                onChangeText={setHourMeter}
                placeholder="Heures"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Charge nominale</Text>
              <TextInput
                style={styles.input}
                value={nominalLoad}
                onChangeText={setNominalLoad}
                placeholder="Ex: 500 lb"
              />
            </View>
          </View>
        </View>

        {/* Points de vérification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points de vérification</Text>
          <Text style={styles.legend}>OK = Conforme | X = Anomalie | S.O. = Sans objet</Text>

          {PEMP_ITEMS.map(item => (
            <View key={item.number} style={styles.checkItem}>
              <View style={styles.checkHeader}>
                <View style={styles.checkNumber}>
                  <Text style={styles.checkNumberText}>{item.number}</Text>
                </View>
                <View style={styles.checkInfo}>
                  <Text style={styles.checkTitle}>{item.title}</Text>
                  <Text style={styles.checkDescription}>{item.description}</Text>
                </View>
              </View>

              {/* Fuel type for item 8 */}
              {item.number === 8 && (
                <View style={styles.fuelRow}>
                  {(['batterie', 'propane', 'essence', 'diesel'] as const).map(fuel => (
                    <TouchableOpacity
                      key={fuel}
                      style={[styles.fuelButton, fuelType === fuel && styles.fuelSelected]}
                      onPress={() => setFuelType(fuel)}
                    >
                      <Text style={[styles.fuelText, fuelType === fuel && styles.fuelTextSelected]}>
                        {fuel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.statusRow}>
                {renderStatusButton(item.number, 'ok', 'OK', '#22c55e')}
                {renderStatusButton(item.number, 'anomaly', 'X', '#ef4444')}
                {renderStatusButton(item.number, 'na', 'S.O.', '#6b7280')}
              </View>

              {responses[item.number]?.status === 'anomaly' && (
                <TextInput
                  style={styles.commentInput}
                  value={responses[item.number]?.comment || ''}
                  onChangeText={(text) => updateComment(item.number, text)}
                  placeholder="Décrire l'anomalie..."
                  multiline
                />
              )}
            </View>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes / Commentaires</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes additionnelles..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Signature */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Initiales</Text>
              <TextInput
                style={styles.input}
                value={operatorInitials}
                onChangeText={(text) => setOperatorInitials(text.toUpperCase())}
                placeholder="Ex: JD"
                maxLength={5}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.signatureBox}
            onPress={() => setShowSignature(true)}
          >
            {operatorSignature ? (
              <View style={styles.signaturePreview}>
                <Text style={styles.signaturePreviewText}>Signature enregistrée</Text>
                <TouchableOpacity onPress={clearSignature}>
                  <Text style={styles.clearSignatureText}>Effacer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.signaturePlaceholder}>
                Touchez pour signer
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={() => handleSubmit(true)}
            disabled={saving}
          >
            <Text style={styles.draftButtonText}>Sauvegarder brouillon</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.buttonDisabled]}
            onPress={() => handleSubmit(false)}
            disabled={saving}
          >
            <Text style={styles.submitButtonText}>
              {saving ? 'Enregistrement...' : 'Soumettre'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#64191E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  categoryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  categorySelected: {
    backgroundColor: '#64191E',
    borderColor: '#64191E',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  legend: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    textAlign: 'center',
  },
  checkItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#be185d',
  },
  checkInfo: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  checkDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginLeft: 40,
  },
  statusButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fuelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginLeft: 40,
  },
  fuelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  fuelSelected: {
    backgroundColor: '#2563eb',
  },
  fuelText: {
    fontSize: 12,
    color: '#2563eb',
    textTransform: 'capitalize',
  },
  fuelTextSelected: {
    color: '#fff',
  },
  commentInput: {
    marginTop: 8,
    marginLeft: 40,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  signatureBox: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  signaturePlaceholder: {
    color: '#999',
    fontSize: 14,
  },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  signaturePreviewText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500',
  },
  clearSignatureText: {
    color: '#ef4444',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    margin: 12,
  },
  draftButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64191E',
    alignItems: 'center',
  },
  draftButtonText: {
    color: '#64191E',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#64191E',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signatureContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 30 : 0,
    paddingBottom: Platform.OS === 'android' ? 24 : 20,
  },
  signatureCanvasWrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  signatureButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 32 : 16,
    gap: 16,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  signatureClearButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signatureConfirmButton: {
    flex: 1,
    backgroundColor: '#64191E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signatureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    color: '#ef4444',
    fontSize: 16,
  },
})
