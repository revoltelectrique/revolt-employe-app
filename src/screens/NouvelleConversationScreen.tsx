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
import { useNavigation } from '@react-navigation/native'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function NouvelleConversationScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

  const [servicentreNumber, setServicentreNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const getCurrentLocation = async () => {
    setGettingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Impossible d\'accéder à la localisation')
        return
      }

      const loc = await Location.getCurrentPositionAsync({})
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      })

      if (address) {
        const formattedAddress = [
          address.streetNumber,
          address.street,
          address.city,
        ].filter(Boolean).join(' ')
        setLocation(formattedAddress)
      }
    } catch (error) {
      console.error('Erreur localisation:', error)
      Alert.alert('Erreur', 'Impossible de récupérer la localisation')
    } finally {
      setGettingLocation(false)
    }
  }

  const handleSubmit = async () => {
    if (!servicentreNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le numéro Servicentre')
      return
    }

    if (!clientName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom du client')
      return
    }

    setLoading(true)

    try {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          servicentre_number: servicentreNumber.trim(),
          client_name: clientName.trim(),
          location: location.trim() || null,
          description: description.trim() || null,
          created_by: user?.id,
          status: 'ouverte',
        })
        .select()
        .single()

      if (error) throw error

      // Naviguer vers le chat de la conversation
      navigation.replace('ConversationChat', { conversationId: conv.id })
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de créer la conversation')
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de l'appel</Text>

          <Text style={styles.label}>Numéro Servicentre *</Text>
          <TextInput
            style={styles.input}
            value={servicentreNumber}
            onChangeText={setServicentreNumber}
            placeholder="Ex: SC-12345"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Nom du client *</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Ex: Ville de Baie-Comeau"
          />

          <Text style={styles.label}>Adresse du chantier</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: 123 rue Principale"
            />
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.locationButtonText}>📍</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description du travail à effectuer..."
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Créer la conversation</Text>
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
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    marginBottom: 0,
  },
  locationButton: {
    width: 50,
    height: 50,
    backgroundColor: '#64191E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 20,
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
