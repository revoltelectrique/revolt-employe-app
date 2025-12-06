import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button, Input, Card } from '../components'
import { registerForPushNotificationsAsync, savePushToken, removePushToken } from '../lib/notifications'

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState(profile?.first_name || '')
  const [lastName, setLastName] = useState(profile?.last_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')

  useEffect(() => {
    setNotificationsEnabled(!!profile?.expo_push_token)
  }, [profile])

  const handleSave = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('id', user.id)

      if (error) throw error

      Alert.alert('Succès', 'Profil mis à jour')
      setEditMode(false)
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!user?.id) return

    setLoading(true)
    try {
      if (enabled) {
        const token = await registerForPushNotificationsAsync()
        if (token) {
          await savePushToken(user.id, token)
          setNotificationsEnabled(true)
          Alert.alert('Succès', 'Notifications activées')
        } else {
          Alert.alert('Erreur', 'Impossible d\'activer les notifications. Vérifiez les permissions.')
        }
      } else {
        await removePushToken(user.id)
        setNotificationsEnabled(false)
        Alert.alert('Succès', 'Notifications désactivées')
      }
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de modifier les notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: signOut },
      ]
    )
  }

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrateur',
      contremaitre: 'Contremaître',
      employe: 'Employé',
      client: 'Client',
    }
    return roles[role] || role
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(firstName || profile?.email || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>
          {firstName || lastName
            ? `${firstName} ${lastName}`.trim()
            : profile?.email?.split('@')[0]}
        </Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleName(profile?.role || '')}</Text>
        </View>
      </View>

      {/* Informations */}
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Informations</Text>
          {!editMode && (
            <TouchableOpacity onPress={() => setEditMode(true)}>
              <Text style={styles.editLink}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>

        {editMode ? (
          <>
            <Input
              label="Prénom"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Votre prénom"
            />
            <Input
              label="Nom"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Votre nom"
            />
            <Input
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              placeholder="555-555-5555"
              keyboardType="phone-pad"
            />
            <View style={styles.editButtons}>
              <Button
                title="Annuler"
                variant="outline"
                onPress={() => {
                  setEditMode(false)
                  setFirstName(profile?.first_name || '')
                  setLastName(profile?.last_name || '')
                  setPhone(profile?.phone || '')
                }}
                style={styles.editButton}
              />
              <Button
                title="Enregistrer"
                onPress={handleSave}
                loading={loading}
                style={styles.editButton}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Courriel</Text>
              <Text style={styles.infoValue}>{profile?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Prénom</Text>
              <Text style={styles.infoValue}>{firstName || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom</Text>
              <Text style={styles.infoValue}>{lastName || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{phone || '-'}</Text>
            </View>
          </>
        )}
      </Card>

      {/* Notifications */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Notifications push</Text>
            <Text style={styles.switchDescription}>
              Recevez des alertes pour les nouvelles demandes
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: '#ddd', true: '#64191E' }}
            thumbColor="#fff"
            disabled={loading}
          />
        </View>
      </Card>

      {/* Actions */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={styles.menuItemText}>Se déconnecter</Text>
          <Text style={styles.menuItemIcon}>→</Text>
        </TouchableOpacity>
      </Card>

      {/* Version */}
      <Text style={styles.version}>Version 1.0.0</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#64191E',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    margin: 16,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editLink: {
    color: '#64191E',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: '#DC2626',
  },
  menuItemIcon: {
    fontSize: 16,
    color: '#999',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 24,
  },
})
