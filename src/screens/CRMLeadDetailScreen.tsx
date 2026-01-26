import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import {
  CRMLead,
  CRMActivity,
  CRMReminder,
  CRM_STATUS_LABELS,
  CRM_STATUS_COLORS,
  CRM_CLIENT_TYPE_LABELS,
  CRM_SOURCE_LABELS,
  CRMLeadStatus
} from '../types'
import Badge from '../components/Badge'

const ACTIVITY_ICONS: Record<string, string> = {
  appel: 'call',
  email: 'mail',
  rencontre: 'people',
  note: 'document-text',
  rappel: 'notifications'
}

export default function CRMLeadDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { id } = route.params

  const [lead, setLead] = useState<CRMLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select(`
          *,
          assigned_user:users!crm_leads_assigned_to_fkey(id, first_name, last_name, email),
          activities:crm_activities(
            id, activity_type, subject, description, activity_date, duration_minutes, created_by,
            created_by_user:users(id, first_name, last_name)
          ),
          reminders:crm_reminders(
            id, reminder_date, message, is_completed, assigned_to,
            assigned_user:users!crm_reminders_assigned_to_fkey(id, first_name, last_name)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setLead(data)
    } catch (error) {
      console.error('Error loading lead:', error)
      Alert.alert('Erreur', 'Impossible de charger le prospect')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [id])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const updateStatus = async (newStatus: CRMLeadStatus) => {
    if (!lead) return

    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({ status: newStatus })
        .eq('id', lead.id)

      if (error) throw error

      setLead({ ...lead, status: newStatus })
      Alert.alert('Succès', 'Statut mis à jour')
    } catch (error) {
      console.error('Error updating status:', error)
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`)
  }

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    )
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Prospect non trouvé</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const pendingReminders = lead.reminders?.filter(r => !r.is_completed) || []
  const overdueReminders = pendingReminders.filter(r => new Date(r.reminder_date) < new Date())

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détails prospect</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* En-tête du prospect */}
        <View style={styles.leadHeader}>
          <View style={styles.leadHeaderTop}>
            <View style={styles.leadInfo}>
              <Text style={styles.leadNumber}>{lead.lead_number}</Text>
              <Text style={styles.contactName}>{lead.contact_name}</Text>
              {lead.company_name && (
                <Text style={styles.companyName}>{lead.company_name}</Text>
              )}
            </View>
            <Badge
              text={CRM_STATUS_LABELS[lead.status]}
              color={CRM_STATUS_COLORS[lead.status]}
            />
          </View>

          <View style={styles.typeRow}>
            <View style={[styles.typeBadge, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.typeBadgeText}>{CRM_CLIENT_TYPE_LABELS[lead.client_type]}</Text>
            </View>
            {lead.source && (
              <View style={[styles.typeBadge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={styles.typeBadgeText}>{CRM_SOURCE_LABELS[lead.source]}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Alerte rappels en retard */}
        {overdueReminders.length > 0 && (
          <View style={styles.alertCard}>
            <Ionicons name="warning" size={20} color="#EF4444" />
            <Text style={styles.alertText}>{overdueReminders.length} rappel(s) en retard</Text>
          </View>
        )}

        {/* Actions rapides */}
        <View style={styles.actionsContainer}>
          {lead.phone_main && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(lead.phone_main!)}
            >
              <Ionicons name="call" size={20} color="#22C55E" />
              <Text style={styles.actionText}>Appeler</Text>
            </TouchableOpacity>
          )}
          {lead.email && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(lead.email!)}
            >
              <Ionicons name="mail" size={20} color="#3B82F6" />
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pipeline - Changer le statut */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avancer dans le pipeline</Text>
          <View style={styles.statusButtons}>
            {lead.status === 'nouveau' && (
              <TouchableOpacity
                style={[styles.statusButton, { backgroundColor: '#F59E0B' }]}
                onPress={() => updateStatus('contacte')}
                disabled={updatingStatus}
              >
                <Text style={styles.statusButtonText}>Marquer contacté</Text>
              </TouchableOpacity>
            )}
            {lead.status === 'contacte' && (
              <TouchableOpacity
                style={[styles.statusButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => updateStatus('qualifie')}
                disabled={updatingStatus}
              >
                <Text style={styles.statusButtonText}>Marquer qualifié</Text>
              </TouchableOpacity>
            )}
            {lead.status === 'qualifie' && (
              <>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: '#22C55E' }]}
                  onPress={() => updateStatus('converti')}
                  disabled={updatingStatus}
                >
                  <Text style={styles.statusButtonText}>Convertir en client</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => updateStatus('perdu')}
                  disabled={updatingStatus}
                >
                  <Text style={styles.statusButtonText}>Marquer perdu</Text>
                </TouchableOpacity>
              </>
            )}
            {['nouveau', 'contacte'].includes(lead.status) && (
              <TouchableOpacity
                style={[styles.statusButton, { backgroundColor: '#EF4444' }]}
                onPress={() => updateStatus('perdu')}
                disabled={updatingStatus}
              >
                <Text style={styles.statusButtonText}>Marquer perdu</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Valeur */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pipeline</Text>
          <View style={styles.valueGrid}>
            <View style={styles.valueCard}>
              <Text style={styles.valueLabel}>Valeur estimée</Text>
              <Text style={styles.valueAmount}>{formatCurrency(lead.estimated_value)}</Text>
            </View>
            <View style={styles.valueCard}>
              <Text style={styles.valueLabel}>Probabilité</Text>
              <Text style={styles.valueAmount}>{lead.probability}%</Text>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.contactCard}>
            {lead.phone_main && (
              <TouchableOpacity style={styles.contactRow} onPress={() => handleCall(lead.phone_main!)}>
                <Ionicons name="call-outline" size={18} color="#666" />
                <Text style={styles.contactValue}>{lead.phone_main}</Text>
              </TouchableOpacity>
            )}
            {lead.phone_cell && (
              <TouchableOpacity style={styles.contactRow} onPress={() => handleCall(lead.phone_cell!)}>
                <Ionicons name="phone-portrait-outline" size={18} color="#666" />
                <Text style={styles.contactValue}>{lead.phone_cell}</Text>
              </TouchableOpacity>
            )}
            {lead.email && (
              <TouchableOpacity style={styles.contactRow} onPress={() => handleEmail(lead.email!)}>
                <Ionicons name="mail-outline" size={18} color="#666" />
                <Text style={styles.contactValue}>{lead.email}</Text>
              </TouchableOpacity>
            )}
            {(lead.address_line1 || lead.city) && (
              <View style={styles.contactRow}>
                <Ionicons name="location-outline" size={18} color="#666" />
                <View>
                  {lead.address_line1 && <Text style={styles.contactValue}>{lead.address_line1}</Text>}
                  {lead.city && (
                    <Text style={styles.contactValue}>
                      {lead.city}, {lead.province} {lead.postal_code}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigné à</Text>
              <Text style={styles.infoValue}>
                {lead.assigned_user
                  ? `${lead.assigned_user.first_name || ''} ${lead.assigned_user.last_name || ''}`.trim()
                  : 'Non assigné'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Créé le</Text>
              <Text style={styles.infoValue}>{formatDate(lead.created_at)}</Text>
            </View>
            {lead.next_followup_date && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Prochain suivi</Text>
                <Text style={[
                  styles.infoValue,
                  new Date(lead.next_followup_date) < new Date() && { color: '#EF4444' }
                ]}>
                  {formatDate(lead.next_followup_date)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {lead.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{lead.notes}</Text>
            </View>
          </View>
        )}

        {/* Activités récentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activités récentes</Text>
          {lead.activities && lead.activities.length > 0 ? (
            <View style={styles.activitiesContainer}>
              {lead.activities
                .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())
                .slice(0, 5)
                .map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <View style={styles.activityIcon}>
                      <Ionicons
                        name={ACTIVITY_ICONS[activity.activity_type] as any || 'document'}
                        size={16}
                        color="#666"
                      />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activitySubject}>{activity.subject}</Text>
                      <Text style={styles.activityDate}>{formatDateTime(activity.activity_date)}</Text>
                    </View>
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucune activité enregistrée</Text>
            </View>
          )}
        </View>

        {/* Rappels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rappels en attente</Text>
          {pendingReminders.length > 0 ? (
            <View style={styles.remindersContainer}>
              {pendingReminders.map((reminder) => {
                const isOverdue = new Date(reminder.reminder_date) < new Date()
                return (
                  <View
                    key={reminder.id}
                    style={[
                      styles.reminderItem,
                      isOverdue && styles.reminderOverdue
                    ]}
                  >
                    <Ionicons
                      name="notifications"
                      size={16}
                      color={isOverdue ? '#EF4444' : '#F59E0B'}
                    />
                    <View style={styles.reminderContent}>
                      <Text style={styles.reminderMessage}>{reminder.message}</Text>
                      <Text style={[
                        styles.reminderDate,
                        isOverdue && { color: '#EF4444' }
                      ]}>
                        {formatDateTime(reminder.reminder_date)}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucun rappel en attente</Text>
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  scrollView: {
    flex: 1,
  },
  leadHeader: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  leadHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadInfo: {
    flex: 1,
  },
  leadNumber: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contactName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  companyName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  alertText: {
    color: '#EF4444',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  valueGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  valueCard: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 12,
    color: '#666',
  },
  valueAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 4,
  },
  contactCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
  },
  contactValue: {
    fontSize: 14,
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  notesCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  activitiesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activitySubject: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  remindersContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  reminderItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  reminderOverdue: {
    backgroundColor: '#FEF2F2',
  },
  reminderContent: {
    flex: 1,
  },
  reminderMessage: {
    fontSize: 14,
    color: '#333',
  },
  reminderDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
})
