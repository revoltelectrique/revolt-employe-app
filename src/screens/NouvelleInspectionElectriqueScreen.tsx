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
import { ELECTRICAL_INSPECTION_SECTIONS, SectionSeed, ItemSeed } from '../data/electricalInspectionData'

interface ItemResponse {
  selectedOptions: string[]
  textValue: string
  isNc: boolean
}

interface SectionData {
  isNa: boolean
  location: string
  volts: string
  amps: string
  power: string
  notes: string
  items: Record<string, ItemResponse>
}

export default function NouvelleInspectionElectriqueScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { profile, user } = useAuth()
  const signatureRef = useRef<any>(null)

  const { typeCode, typeId } = route.params || {}

  const [saving, setSaving] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['1A']))

  // Form fields
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [inspectionAddress, setInspectionAddress] = useState('')
  const [inspectionCity, setInspectionCity] = useState('')
  const [buildingType, setBuildingType] = useState('')
  const [meterNumber, setMeterNumber] = useState('')
  const [contractorSignature, setContractorSignature] = useState<string | null>(null)
  const [technicianName, setTechnicianName] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  // Section data
  const [sections, setSections] = useState<Record<string, SectionData>>(() => {
    const initial: Record<string, SectionData> = {}
    ELECTRICAL_INSPECTION_SECTIONS.forEach((section) => {
      const items: Record<string, ItemResponse> = {}
      section.items.forEach((item) => {
        items[item.item_number.toString()] = {
          selectedOptions: [],
          textValue: '',
          isNc: false,
        }
      })
      initial[section.code] = {
        isNa: false,
        location: '',
        volts: '',
        amps: '',
        power: '',
        notes: '',
        items,
      }
    })
    return initial
  })

  const toggleSection = (sectionCode: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionCode)) {
        newSet.delete(sectionCode)
      } else {
        newSet.add(sectionCode)
      }
      return newSet
    })
  }

  const toggleSectionNa = (sectionCode: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionCode]: {
        ...prev[sectionCode],
        isNa: !prev[sectionCode].isNa,
      },
    }))
  }

  const updateSectionField = (sectionCode: string, field: keyof SectionData, value: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionCode]: {
        ...prev[sectionCode],
        [field]: value,
      },
    }))
  }

  const toggleItemOption = (sectionCode: string, itemNumber: number, optionValue: string) => {
    setSections((prev) => {
      const section = prev[sectionCode]
      const item = section.items[itemNumber.toString()]
      const currentOptions = item.selectedOptions || []

      let newOptions: string[]
      if (currentOptions.includes(optionValue)) {
        newOptions = currentOptions.filter((o) => o !== optionValue)
      } else {
        if (optionValue === 'nc') {
          newOptions = [...currentOptions.filter((o) => o !== 'nc'), optionValue]
        } else {
          newOptions = currentOptions.filter((o) => o === 'nc')
          newOptions.push(optionValue)
        }
      }

      const isNc = newOptions.includes('nc')

      return {
        ...prev,
        [sectionCode]: {
          ...section,
          items: {
            ...section.items,
            [itemNumber.toString()]: {
              ...item,
              selectedOptions: newOptions,
              isNc,
            },
          },
        },
      }
    })
  }

  const updateItemTextValue = (sectionCode: string, itemNumber: number, value: string) => {
    setSections((prev) => {
      const section = prev[sectionCode]
      return {
        ...prev,
        [sectionCode]: {
          ...section,
          items: {
            ...section.items,
            [itemNumber.toString()]: {
              ...section.items[itemNumber.toString()],
              textValue: value,
            },
          },
        },
      }
    })
  }

  const getSectionStatus = (sectionCode: string) => {
    const section = sections[sectionCode]
    if (section.isNa) return 'na'

    const sectionDef = ELECTRICAL_INSPECTION_SECTIONS.find((s) => s.code === sectionCode)
    if (!sectionDef) return 'incomplete'

    let hasNc = false
    let hasAnswers = false

    sectionDef.items.forEach((item) => {
      const itemData = section.items[item.item_number.toString()]
      if (itemData?.selectedOptions?.length > 0) {
        hasAnswers = true
      }
      if (itemData?.isNc) {
        hasNc = true
      }
    })

    if (hasNc) return 'nc'
    if (hasAnswers) return 'partial'
    return 'incomplete'
  }

  const handleSignature = (signature: string) => {
    setContractorSignature(signature)
    setShowSignature(false)
  }

  const clearSignature = () => {
    setContractorSignature(null)
    signatureRef.current?.clearSignature()
  }

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft) {
      if (!clientName.trim()) {
        Alert.alert('Erreur', 'Le nom du client est requis')
        return
      }
      if (!inspectionAddress.trim()) {
        Alert.alert('Erreur', "L'adresse d'inspection est requise")
        return
      }
    }

    setSaving(true)
    try {
      // Create inspection record
      const { data: inspection, error: inspectionError } = await supabase
        .from('electrical_inspections')
        .insert({
          user_id: profile?.id,
          client_name: clientName,
          client_address: clientAddress || null,
          client_city: clientCity || null,
          inspection_date: inspectionDate,
          inspection_address: inspectionAddress,
          inspection_city: inspectionCity || null,
          building_type: buildingType || null,
          meter_number: meterNumber || null,
          contractor_name: 'ReVolt Électrique inc.',
          contractor_address: '162 route 138 Ouest, Forestville, G0T 1E0',
          contractor_phone: '418-587-5403',
          contractor_license: '5795-3226',
          technician_name: technicianName || profile?.first_name + ' ' + profile?.last_name || null,
          contractor_signature: contractorSignature,
          contractor_signature_date: contractorSignature ? inspectionDate : null,
          general_notes: generalNotes || null,
          status: isDraft ? 'draft' : 'completed',
          completed_at: isDraft ? null : new Date().toISOString(),
        })
        .select()
        .single()

      if (inspectionError) throw inspectionError

      console.log('[DEBUG SAVE] Inspection created successfully!')
      console.log('[DEBUG SAVE] Inspection ID:', inspection.id)
      console.log('[DEBUG SAVE] User ID used:', profile?.id)
      console.log('[DEBUG SAVE] Status:', inspection.status)

      // Save responses
      const responsesToInsert: any[] = []

      Object.entries(sections).forEach(([sectionCode, sectionData]) => {
        // Section-level response
        responsesToInsert.push({
          inspection_id: inspection.id,
          section_code: sectionCode,
          item_number: null,
          section_na: sectionData.isNa,
          section_location: sectionData.location || null,
          section_volts: sectionData.volts || null,
          section_amps: sectionData.amps || null,
          section_power: sectionData.power || null,
          section_notes: sectionData.notes || null,
          selected_options: null,
          text_value: null,
          is_nc: false,
        })

        // Item responses
        if (!sectionData.isNa) {
          Object.entries(sectionData.items).forEach(([itemNumber, itemData]) => {
            if (itemData.selectedOptions?.length || itemData.textValue) {
              responsesToInsert.push({
                inspection_id: inspection.id,
                section_code: sectionCode,
                item_number: itemNumber,
                section_na: false,
                section_location: null,
                section_volts: null,
                section_amps: null,
                section_power: null,
                section_notes: null,
                selected_options: itemData.selectedOptions || null,
                text_value: itemData.textValue || null,
                is_nc: itemData.isNc,
              })
            }
          })
        }
      })

      if (responsesToInsert.length > 0) {
        const { error: responsesError } = await supabase
          .from('electrical_inspection_responses')
          .insert(responsesToInsert)

        if (responsesError) {
          console.error('Error saving responses:', responsesError)
        }
      }

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

  const renderOptionButton = (
    sectionCode: string,
    itemNumber: number,
    option: { value: string; label: string },
    isSelected: boolean
  ) => {
    const isNcOption = option.value === 'nc'
    let bgColor = '#e5e7eb'
    let textColor = '#6b7280'

    if (isSelected) {
      if (isNcOption) {
        bgColor = '#ef4444'
        textColor = '#fff'
      } else if (option.value === 'ok') {
        bgColor = '#22c55e'
        textColor = '#fff'
      } else if (option.value === 'na' || option.value === 'nac') {
        bgColor = '#6b7280'
        textColor = '#fff'
      } else {
        bgColor = '#3b82f6'
        textColor = '#fff'
      }
    }

    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.optionButton, { backgroundColor: bgColor }]}
        onPress={() => toggleItemOption(sectionCode, itemNumber, option.value)}
      >
        <Text style={[styles.optionButtonText, { color: textColor }]}>{option.label}</Text>
      </TouchableOpacity>
    )
  }

  const renderItem = (sectionCode: string, item: ItemSeed) => {
    const sectionData = sections[sectionCode]
    const itemData = sectionData.items[item.item_number.toString()]

    return (
      <View
        key={`${sectionCode}-${item.item_number}`}
        style={[styles.itemRow, itemData?.isNc && styles.itemRowNc]}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemNumber}>
            <Text style={styles.itemNumberText}>{item.item_number}</Text>
          </View>
          <Text style={styles.itemName}>{item.name}</Text>
        </View>

        {item.has_text_input && (
          <TextInput
            style={styles.itemTextInput}
            value={itemData?.textValue || ''}
            onChangeText={(value) => updateItemTextValue(sectionCode, item.item_number, value)}
            placeholder={item.text_input_label || 'Valeur'}
          />
        )}

        <View style={styles.optionsRow}>
          {item.options.map((option) =>
            renderOptionButton(
              sectionCode,
              item.item_number,
              option,
              itemData?.selectedOptions?.includes(option.value) || false
            )
          )}
        </View>
      </View>
    )
  }

  const renderSection = (section: SectionSeed) => {
    const sectionData = sections[section.code]
    const isExpanded = expandedSections.has(section.code)
    const status = getSectionStatus(section.code)

    const statusColors: Record<string, string> = {
      na: '#6b7280',
      nc: '#ef4444',
      partial: '#eab308',
      incomplete: '#d1d5db',
    }

    return (
      <View key={section.code} style={[styles.sectionCard, sectionData.isNa && styles.sectionCardNa]}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.code)}>
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionCode, { backgroundColor: statusColors[status] + '30' }]}>
              <Text style={[styles.sectionCodeText, { color: statusColors[status] }]}>{section.code}</Text>
            </View>
            <Text style={styles.sectionName} numberOfLines={1}>{section.name}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {section.has_na_option && (
              <TouchableOpacity
                style={[styles.naButton, sectionData.isNa && styles.naButtonActive]}
                onPress={() => toggleSectionNa(section.code)}
              >
                <Text style={[styles.naButtonText, sectionData.isNa && styles.naButtonTextActive]}>N/A</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.chevron}>{isExpanded ? '▼' : '▶'}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && !sectionData.isNa && (
          <View style={styles.sectionContent}>
            {/* Section fields */}
            {(section.has_volts_field || section.has_amps_field || section.has_power_field) && (
              <View style={styles.sectionFields}>
                {section.has_location_field && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Localisation</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={sectionData.location}
                      onChangeText={(v) => updateSectionField(section.code, 'location', v)}
                      placeholder="Localisation"
                    />
                  </View>
                )}
                {section.has_volts_field && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Volts</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={sectionData.volts}
                      onChangeText={(v) => updateSectionField(section.code, 'volts', v)}
                      placeholder="V"
                      keyboardType="numeric"
                    />
                  </View>
                )}
                {section.has_amps_field && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Ampères</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={sectionData.amps}
                      onChangeText={(v) => updateSectionField(section.code, 'amps', v)}
                      placeholder="A"
                      keyboardType="numeric"
                    />
                  </View>
                )}
                {section.has_power_field && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Puissance</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={sectionData.power}
                      onChangeText={(v) => updateSectionField(section.code, 'power', v)}
                      placeholder="kW"
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Items */}
            {section.items.map((item) => renderItem(section.code, item))}

            {/* Section notes */}
            <View style={styles.sectionNotesContainer}>
              <Text style={styles.fieldLabel}>Notes de section</Text>
              <TextInput
                style={styles.sectionNotesInput}
                value={sectionData.notes}
                onChangeText={(v) => updateSectionField(section.code, 'notes', v)}
                placeholder="Notes..."
                multiline
              />
            </View>
          </View>
        )}

        {isExpanded && sectionData.isNa && (
          <View style={styles.sectionNaContent}>
            <Text style={styles.sectionNaText}>Section non applicable</Text>
          </View>
        )}
      </View>
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
          <Text style={styles.signatureTitle}>Signature du technicien</Text>
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
              .m-signature-pad { box-shadow: none; border: none; width: 100%; height: 100%; margin: 0; }
              .m-signature-pad--body { border: 1px solid #e5e7eb; margin: 10px; border-radius: 8px; }
              .m-signature-pad--footer { display: none !important; }
            `}
          />
        </View>
        <View style={styles.signatureButtons}>
          <TouchableOpacity style={styles.signatureClearButton} onPress={handleClearSignature}>
            <Text style={styles.signatureButtonText}>Effacer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signatureConfirmButton} onPress={handleConfirmSignature}>
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
        <Text style={styles.headerTitle}>⚡ Inspection électrique</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Client Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identification du client</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du client *</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="Nom du client"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse</Text>
            <TextInput
              style={styles.input}
              value={clientAddress}
              onChangeText={setClientAddress}
              placeholder="Adresse"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              style={styles.input}
              value={clientCity}
              onChangeText={setClientCity}
              placeholder="Ville"
            />
          </View>
        </View>

        {/* Inspection Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inspection</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Date *</Text>
              <TextInput
                style={styles.input}
                value={inspectionDate}
                onChangeText={setInspectionDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>N° compteur</Text>
              <TextInput
                style={styles.input}
                value={meterNumber}
                onChangeText={setMeterNumber}
                placeholder="N° compteur"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse d'inspection *</Text>
            <TextInput
              style={styles.input}
              value={inspectionAddress}
              onChangeText={setInspectionAddress}
              placeholder="Adresse inspectée"
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ville</Text>
              <TextInput
                style={styles.input}
                value={inspectionCity}
                onChangeText={setInspectionCity}
                placeholder="Ville"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>Type bâtiment</Text>
              <TextInput
                style={styles.input}
                value={buildingType}
                onChangeText={setBuildingType}
                placeholder="Ex: Duplex"
              />
            </View>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendText}>
            N/A = Non applicable | NC = Non conforme | NAC = Non accessible
          </Text>
        </View>

        {/* Sections */}
        {ELECTRICAL_INSPECTION_SECTIONS.map(renderSection)}

        {/* General Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Remarques générales</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={generalNotes}
            onChangeText={setGeneralNotes}
            placeholder="Notes additionnelles..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Signature */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signature</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du technicien</Text>
            <TextInput
              style={styles.input}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder={profile?.first_name + ' ' + profile?.last_name || 'Nom'}
            />
          </View>
          <TouchableOpacity style={styles.signatureBox} onPress={() => setShowSignature(true)}>
            {contractorSignature ? (
              <View style={styles.signaturePreview}>
                <Text style={styles.signaturePreviewText}>Signature enregistrée ✓</Text>
                <TouchableOpacity onPress={clearSignature}>
                  <Text style={styles.clearSignatureText}>Effacer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.signaturePlaceholder}>Touchez pour signer</Text>
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
            <Text style={styles.draftButtonText}>Brouillon</Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
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
  card: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
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
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  legendCard: {
    backgroundColor: '#fef3c7',
    margin: 12,
    padding: 12,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionCardNa: {
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionCode: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  sectionCodeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  naButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  naButtonActive: {
    backgroundColor: '#6b7280',
  },
  naButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  naButtonTextActive: {
    color: '#fff',
  },
  chevron: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  sectionContent: {
    padding: 12,
  },
  sectionFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  fieldGroup: {
    minWidth: 80,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    minWidth: 70,
  },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemRowNc: {
    backgroundColor: '#fef2f2',
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  itemTextInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    marginLeft: 34,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 34,
  },
  optionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  optionButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionNotesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionNotesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    backgroundColor: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionNaContent: {
    padding: 20,
    alignItems: 'center',
  },
  sectionNaText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  signatureBox: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
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
