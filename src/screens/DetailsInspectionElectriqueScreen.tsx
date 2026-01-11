import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { ELECTRICAL_INSPECTION_SECTIONS } from '../data/electricalInspectionData'
import { InspectionForm } from '../types'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'



export default function DetailsInspectionElectriqueScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { inspectionId } = route.params || {}

  const [loading, setLoading] = useState(true)
  const [inspection, setInspection] = useState<InspectionForm | null>(null)
  const [userName, setUserName] = useState('')
  const [hasNonConformities, setHasNonConformities] = useState(false)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [hasAnomalies, setHasAnomalies] = useState(false)

  useEffect(() => {
    loadInspection()
  }, [inspectionId])

  const loadInspection = async () => {
    try {
      const { data: form, error } = await supabase
        .from('electrical_inspections')
        .select('*')
        .eq('id', inspectionId)
        .single()

      if (error) throw error

      setInspection(form)
      setUserName(form.technician_name || '')

      // Load responses
      const { data: respData } = await supabase
        .from('electrical_inspection_responses')
        .select('*')
        .eq('inspection_id', inspectionId)

      if (respData) {
        const organizedResponses: Record<string, any> = {}
        let hasNc = false
        respData.forEach((r: any) => {
          if (!organizedResponses[r.section_code]) {
            organizedResponses[r.section_code] = {
              isNa: r.section_na,
              location: r.section_location,
              volts: r.section_volts,
              amps: r.section_amps,
              power: r.section_power,
              notes: r.section_notes,
              items: {},
            }
          }
          if (r.item_number !== null) {
            organizedResponses[r.section_code].items[r.item_number] = {
              selectedOptions: r.selected_options || [],
              textValue: r.text_value,
              isNc: r.is_nc,
            }
            if (r.is_nc) hasNc = true
          }
        })
        console.log('[DEBUG] Organized sections:', Object.keys(organizedResponses))
        setResponses(organizedResponses)
        setHasNonConformities(hasNc)
      }
    } catch (error) {
      console.error('Error loading inspection:', error)
      Alert.alert('Erreur', 'Impossible de charger l\'inspection')
    } finally {
      setLoading(false)
    }
  }

  

  const getOptionLabel = (value: string): string => {
    const labels: Record<string, string> = {
      na: 'N/A', nac: 'NAC', ok: 'OK', nc: 'NC',
      cuivre: 'Cuivre', aluminium: 'Aluminium', endommages: 'Endommagés',
      rouille: 'Rouille', eau: 'Eau', debouchure_ouverte: 'Débouchure ouverte',
      craquelure: 'Craquelure', decoloration: 'Décoloration', brisure: 'Brisure',
      oui: 'OUI', cavalier_nc: 'Cavalier NC',
      type_d: 'Type « D »', type_p: 'Type « P »',
      salle_bains: 'Salle de bains', placard: 'Placard',
    }
    return labels[value] || value
  }

  const getStatusStyle = (isNc: boolean) => {
    if (isNc) {
      return { bg: '#fee2e2', text: '#991b1b', label: 'NC' }
    }
    return { bg: '#dcfce7', text: '#166534', label: 'OK' }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok': return 'OK'
      case 'anomaly': return 'X'
      case 'na': return 'S.O.'
      default: return '-'
    }
  }

  const [sharing, setSharing] = useState(false)

  const generatePDFHTML = () => {
    const date = new Date(inspection?.inspection_date || '').toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const itemsHTML = ELECTRICAL_INSPECTION_SECTIONS.map(item => {
      const response = responses[item.number]
      const statusText = response?.status === 'ok' ? 'OK' : response?.status === 'anomaly' ? 'X' : response?.status === 'na' ? 'S.O.' : '-'
      const statusColor = response?.status === 'ok' ? '#22c55e' : response?.status === 'anomaly' ? '#ef4444' : '#6b7280'
      const bgColor = response?.status === 'anomaly' ? '#fef2f2' : 'transparent'

      return `
        <tr style="background-color: ${bgColor};">
          <td style="border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">${item.number}</td>
          <td style="border-bottom: 1px solid #ddd;">${item.title}${item.number === 8 && response?.value ? ` <span style="color: #2563eb; font-size: 9px;">(${response.value})</span>` : ''}${response?.comment ? ` <span style="color: #991b1b; font-size: 9px;">- ${response.comment}</span>` : ''}</td>
          <td style="border-bottom: 1px solid #ddd; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
        </tr>
      `
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Inspection électrique</title>
        <style>
          @page { margin: 12mm; }
          body { font-family: Arial, sans-serif; padding: 0; margin: 0; font-size: 11px; line-height: 1.3; }
          h2 { color: #64191E; font-size: 12px; margin: 14px 0 8px 0; border-bottom: 2px solid #64191E; padding-bottom: 4px; font-weight: bold; }
          .header { border-bottom: 3px solid #64191E; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
          .header-left { }
          .header-right { text-align: right; font-size: 10px; color: #666; }
          .alert { background-color: #fee2e2; border: 1px solid #fecaca; padding: 8px 12px; color: #991b1b; font-weight: bold; margin-bottom: 10px; font-size: 11px; border-radius: 4px; }
          .info-grid { display: flex; flex-wrap: wrap; margin-bottom: 8px; }
          .info-item { width: 20%; margin-bottom: 10px; }
          .info-label { color: #666; font-size: 9px; text-transform: uppercase; }
          .info-value { font-weight: 600; font-size: 11px; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #f3f4f6; padding: 6px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 10px; }
          td { padding: 5px 8px; font-size: 10px; }
          .sig-container { display: flex; gap: 20px; margin-top: 8px; }
          .signature-box { border: 1px solid #ccc; padding: 10px; flex: 1; min-height: 70px; border-radius: 4px; }
          .signature-label { color: #666; font-size: 9px; margin-bottom: 4px; font-weight: bold; }
          .signature-box img { max-height: 55px; max-width: 100%; }
          .signature-box p { margin: 0; font-size: 9px; }
          .footer { margin-top: 20px; text-align: center; color: #999; font-size: 9px; border-top: 1px solid #ddd; padding-top: 8px; }
          .footer p { margin: 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="https://portail.revoltelectrique.com/logo-bt.png" style="height: 40px;" alt="ReVolt" />
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 18px; font-weight: bold; color: #64191E;">INSPECTION ÉLECTRIQUE</div>
            <div style="font-size: 10px; color: #666;">Plateforme élévatrice mobile de personnel</div>
          </div>
          <div class="header-right">
            ${inspection?.equipment_category === '3A' ? 'Groupe 3A<br>(Ciseaux)' : inspection?.equipment_category === '3B' ? 'Groupe 3B<br>(Boom)' : ''}
          </div>
        </div>

        ${hasAnomalies ? '<div class="alert">⚠️ ANOMALIES DÉTECTÉES</div>' : ''}

        <h2>Informations générales</h2>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Date d'inspection</span><br><span class="info-value">${date}</span></div>
          <div class="info-item"><span class="info-label">Opérateur</span><br><span class="info-value">${userName || '-'}</span></div>
          <div class="info-item"><span class="info-label">Lieu / Chantier</span><br><span class="info-value">${inspection?.location || '-'}</span></div>
          <div class="info-item"><span class="info-label">Propriétaire</span><br><span class="info-value">${inspection?.equipment_owner || '-'}</span></div>
          <div class="info-item"><span class="info-label">Modèle</span><br><span class="info-value">${inspection?.equipment_model || '-'}</span></div>
          <div class="info-item"><span class="info-label">N° série</span><br><span class="info-value">${inspection?.equipment_serial || '-'}</span></div>
          <div class="info-item"><span class="info-label">Catégorie</span><br><span class="info-value">${inspection?.equipment_category || '-'}</span></div>
          <div class="info-item"><span class="info-label">Horomètre</span><br><span class="info-value">${inspection?.hour_meter || '-'} h</span></div>
          <div class="info-item"><span class="info-label">Charge nominale</span><br><span class="info-value">${inspection?.nominal_load || '-'}</span></div>
          <div class="info-item"><span class="info-label">Initiales opérateur</span><br><span class="info-value">${inspection?.operator_initials || '-'}</span></div>
        </div>

        <h2>Points de vérification</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 20px;">#</th>
              <th>Point</th>
              <th style="width: 35px; text-align: center;">État</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        ${inspection?.notes ? `<h2>Notes</h2><p style="font-size: 8px; margin: 2px 0;">${inspection.notes}</p>` : ''}

        <h2>Signatures</h2>
        <div class="sig-container">
          <div class="signature-box">
            <div class="signature-label">Opérateur ${inspection?.operator_initials ? `(${inspection.operator_initials})` : ''}</div>
            ${inspection?.operator_signature ? `<img src="${inspection.operator_signature}" />` : '<p style="color: #ccc;">-</p>'}
          </div>
          <div class="signature-box">
            <div class="signature-label">Superviseur ${inspection?.supervisor_initials ? `(${inspection.supervisor_initials})` : ''}</div>
            ${inspection?.supervisor_signature ? `<img src="${inspection.supervisor_signature}" />` : '<p style="color: #ccc;">-</p>'}
          </div>
        </div>

        <div class="footer">
          <p>Généré le ${new Date().toLocaleString('fr-CA')}</p>
        </div>
      </body>
      </html>
    `
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      const html = generatePDFHTML()
      const date = new Date(inspection?.inspection_date || '').toISOString().split('T')[0]
      const fileName = `Inspection_Electrique_${date}.pdf`

      // Générer le PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      })

      // Vérifier si le partage est disponible
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager l\'inspection',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil')
      }
    } catch (error) {
      console.error('Error generating/sharing PDF:', error)
      Alert.alert('Erreur', 'Impossible de générer le PDF')
    } finally {
      setSharing(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!inspection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Inspection non trouvée</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Retour</Text>
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
        <Text style={styles.headerTitle}>Détails inspection</Text>
        <TouchableOpacity onPress={handleShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.shareButton}>PDF</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alert if anomalies */}
        {hasAnomalies && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>⚠️ Anomalies détectées</Text>
          </View>
        )}

        {/* General Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(inspection.inspection_date).toLocaleDateString('fr-CA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Opérateur</Text>
              <Text style={styles.infoValue}>{userName || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Lieu</Text>
              <Text style={styles.infoValue}>{inspection.location || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Catégorie</Text>
              <Text style={styles.infoValue}>{inspection.equipment_category || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Modèle</Text>
              <Text style={styles.infoValue}>{inspection.equipment_model || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>N° série</Text>
              <Text style={styles.infoValue}>{inspection.equipment_serial || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Horomètre</Text>
              <Text style={styles.infoValue}>{inspection.hour_meter || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Charge</Text>
              <Text style={styles.infoValue}>{inspection.nominal_load || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Points de vérification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points de vérification</Text>
          {ELECTRICAL_INSPECTION_SECTIONS.map((section) => {
          const sectionData = responses[section.code]
          if (!sectionData) return null

          if (sectionData.isNa) {
            return (
              <View key={section.code} style={styles.sectionNa}>
                <Text style={styles.sectionNaTitle}>
                  {section.code} - {section.name}
                </Text>
                <Text style={styles.sectionNaText}>N/A</Text>
              </View>
            )
          }

          return (
            <View key={section.code} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {section.code} - {section.name}
              </Text>

              {(sectionData.location || sectionData.volts || sectionData.amps || sectionData.power) && (
                <View style={styles.sectionMeta}>
                  {sectionData.location && (
                    <Text style={styles.metaText}>📍 {sectionData.location}</Text>
                  )}
                  {sectionData.volts && (
                    <Text style={styles.metaText}>⚡ {sectionData.volts}V</Text>
                  )}
                  {sectionData.amps && (
                    <Text style={styles.metaText}>🔌 {sectionData.amps}A</Text>
                  )}
                  {sectionData.power && (
                    <Text style={styles.metaText}>💡 {sectionData.power}kW</Text>
                  )}
                </View>
              )}

              {section.items.map((item) => {
                const itemData = sectionData.items[item.item_number]
                if (!itemData || itemData.selectedOptions.length === 0) return null

                const statusStyle = getStatusStyle(itemData.isNc)

                return (
                  <View
                    key={item.item_number}
                    style={[
                      styles.checkItem,
                      itemData.isNc && styles.checkItemNc,
                    ]}
                  >
                    <View style={styles.checkNumber}>
                      <Text style={styles.checkNumberText}>{item.item_number}</Text>
                    </View>
                    <View style={styles.checkContent}>
                      <Text style={styles.checkTitle}>{item.name}</Text>
                      <Text style={styles.checkOptions}>
                        {itemData.selectedOptions.map(opt => getOptionLabel(opt)).join(', ')}
                      </Text>
                      {itemData.textValue && (
                        <Text style={styles.checkTextValue}>→ {itemData.textValue}</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusText, { color: statusStyle.text }]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>
                )
              })}

              {sectionData.notes && (
                <View style={styles.sectionNotesBox}>
                  <Text style={styles.sectionNotesLabel}>Note:</Text>
                  <Text style={styles.sectionNotesText}>{sectionData.notes}</Text>
                </View>
              )}
            </View>
          )
        })}
        </View>

        {/* Notes */}
        {inspection.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{inspection.notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Opérateur</Text>
              {inspection.operator_signature ? (
                <View>
                  <Image
                    source={{ uri: inspection.operator_signature }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  {inspection.operator_initials && (
                    <Text style={styles.initials}>Initiales: {inspection.operator_initials}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.noSignature}>Pas de signature</Text>
              )}
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Superviseur</Text>
              {inspection.supervisor_signature ? (
                <View>
                  <Image
                    source={{ uri: inspection.supervisor_signature }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  {inspection.supervisor_initials && (
                    <Text style={styles.initials}>Initiales: {inspection.supervisor_initials}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.noSignature}>Pas de signature</Text>
              )}
            </View>
          </View>
        </View>

        {/* Metadata */}
        <Text style={styles.metadata}>
          Créé le {new Date(inspection.created_at).toLocaleString('fr-CA')}
          {inspection.completed_at && (
            `\nComplété le ${new Date(inspection.completed_at).toLocaleString('fr-CA')}`
          )}
        </Text>

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
    justifyContent: 'space-between',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    color: '#fff',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 16,
  },
  backLink: {
    color: '#64191E',
    fontSize: 16,
  },
  alertBanner: {
    backgroundColor: '#fee2e2',
    padding: 12,
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertText: {
    color: '#991b1b',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    marginTop: 0,
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
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkItemNc: {
    backgroundColor: '#fef2f2',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  checkNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#be185d',
  },
  checkContent: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 14,
    color: '#333',
  },
  fuelType: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 2,
  },
  anomalyComment: {
    fontSize: 12,
    color: '#991b1b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  signatureLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  signatureImage: {
    height: 60,
    width: '100%',
  },
  initials: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  noSignature: {
    fontSize: 13,
    color: '#ccc',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  metadata: {
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
    marginVertical: 12,
    lineHeight: 18,
  },
  sectionNa: {
    backgroundColor: '#f9fafb',
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#d1d5db',
  },
  sectionNaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sectionNaText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  sectionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
    marginBottom: 4,
  },
  checkItemNc: {
    backgroundColor: '#fef2f2',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  checkOptions: {
    fontSize: 13,
    color: '#2563eb',
    marginTop: 2,
  },
  checkTextValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  sectionNotesBox: {
    backgroundColor: '#fef9f3',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  sectionNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  sectionNotesText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },

})
