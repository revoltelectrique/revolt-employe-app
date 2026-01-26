import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CRMClientType, CRMLeadSource } from '../types'

export default function CRMNewLeadScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    contact_name: '',
    company_name: '',
    email: '',
    phone_main: '',
    phone_cell: '',
    address_line1: '',
    city: '',
    postal_code: '',
    province: 'QC',
    client_type: 'residentiel' as CRMClientType,
    source: 'telephone' as CRMLeadSource,
    estimated_value: '',
    notes: '',
  })

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const generateLeadNumber = () => {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0')
    return `LEAD-${dateStr}-${random}`
  }

  const handleSubmit = async () => {
    if (!form.contact_name.trim()) {
      Alert.alert('Erreur', 'Le nom du contact est requis')
      return
    }

    setLoading(true)
    try {
      const leadNumber = generateLeadNumber()

      const { error } = await supabase
        .from('crm_leads')
        .insert({
          lead_number: leadNumber,
          contact_name: form.contact_name.trim(),
          company_name: form.company_name.trim() || null,
          email: form.email.trim() || null,
          phone_main: form.phone_main.trim() || null,
          phone_cell: form.phone_cell.trim() || null,
          address_line1: form.address_line1.trim() || null,
          city: form.city.trim() || null,
          postal_code: form.postal_code.trim() || null,
          province: form.province,
          client_type: form.client_type,
          source: form.source,
          estimated_value: parseFloat(form.estimated_value) || 0,
          notes: form.notes.trim() || null,
          status: 'nouveau',
          probability: 50,
          created_by: user?.id,
          assigned_to: user?.id,
        })

      if (error) throw error

      Alert.alert('Succès', 'Prospect créé avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    } catch (error) {
      console.error('Error creating lead:', error)
      Alert.alert('Erreur', 'Impossible de créer le prospect')
    } finally {
      setLoading(false)
    }
  }

  const clientTypes: { value: CRMClientType; label: string }[] = [
    { value: 'residentiel', label: 'Résidentiel' },
    { value: 'commercial', label: 'Commercial' },
  ]

  const sources: { value: CRMLeadSource; label: string }[] = [
    { value: 'telephone', label: 'Téléphone' },
    { value: 'email', label: 'Email' },
    { value: 'site_web', label: 'Site web' },
    { value: 'reference', label: 'Référence' },
    { value: 'autre', label: 'Autre' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau prospect</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Text style={styles.saveButton}>Créer</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView}>
          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nom du contact *</Text>
              <TextInput
                style={styles.input}
                value={form.contact_name}
                onChangeText={(v) => updateForm('contact_name', v)}
                placeholder="Nom complet"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Entreprise</Text>
              <TextInput
                style={styles.input}
                value={form.company_name}
                onChangeText={(v) => updateForm('company_name', v)}
                placeholder="Nom de l'entreprise (optionnel)"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={form.phone_main}
                onChangeText={(v) => updateForm('phone_main', v)}
                placeholder="(XXX) XXX-XXXX"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Cellulaire</Text>
              <TextInput
                style={styles.input}
                value={form.phone_cell}
                onChangeText={(v) => updateForm('phone_cell', v)}
                placeholder="(XXX) XXX-XXXX"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => updateForm('email', v)}
                placeholder="email@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Adresse */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adresse</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Adresse</Text>
              <TextInput
                style={styles.input}
                value={form.address_line1}
                onChangeText={(v) => updateForm('address_line1', v)}
                placeholder="123 rue Exemple"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 2 }]}>
                <Text style={styles.label}>Ville</Text>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={(v) => updateForm('city', v)}
                  placeholder="Ville"
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.label}>Code postal</Text>
                <TextInput
                  style={styles.input}
                  value={form.postal_code}
                  onChangeText={(v) => updateForm('postal_code', v)}
                  placeholder="G1A 1A1"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          {/* Classification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Classification</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Type de client</Text>
              <View style={styles.buttonGroup}>
                {clientTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      form.client_type === type.value && styles.typeButtonActive
                    ]}
                    onPress={() => updateForm('client_type', type.value)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      form.client_type === type.value && styles.typeButtonTextActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Source</Text>
              <View style={styles.buttonGroup}>
                {sources.map((source) => (
                  <TouchableOpacity
                    key={source.value}
                    style={[
                      styles.sourceButton,
                      form.source === source.value && styles.sourceButtonActive
                    ]}
                    onPress={() => updateForm('source', source.value)}
                  >
                    <Text style={[
                      styles.sourceButtonText,
                      form.source === source.value && styles.sourceButtonTextActive
                    ]}>
                      {source.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Valeur */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estimation</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Valeur estimée ($)</Text>
              <TextInput
                style={styles.input}
                value={form.estimated_value}
                onChangeText={(v) => updateForm('estimated_value', v)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.notes}
                onChangeText={(v) => updateForm('notes', v)}
                placeholder="Notes additionnelles..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#10B981',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  sourceButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  sourceButtonActive: {
    backgroundColor: '#10B981',
  },
  sourceButtonText: {
    fontSize: 13,
    color: '#666',
  },
  sourceButtonTextActive: {
    color: '#fff',
  },
})
