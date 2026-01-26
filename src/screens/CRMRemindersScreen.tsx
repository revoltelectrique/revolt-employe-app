import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CRMReminder } from '../types'

interface ReminderWithLead extends CRMReminder {
  lead?: {
    id: string
    contact_name: string
    company_name: string | null
  }
}

export default function CRMRemindersScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [reminders, setReminders] = useState<ReminderWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>('all')

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_reminders')
        .select(`
          *,
          lead:crm_leads(id, contact_name, company_name),
          assigned_user:users!crm_reminders_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq('is_completed', false)
        .order('reminder_date', { ascending: true })

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error('Error loading reminders:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const completeReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('crm_reminders')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user?.id
        })
        .eq('id', reminderId)

      if (error) throw error

      setReminders(reminders.filter(r => r.id !== reminderId))
      Alert.alert('Succès', 'Rappel marqué comme complété')
    } catch (error) {
      console.error('Error completing reminder:', error)
      Alert.alert('Erreur', 'Impossible de compléter le rappel')
    }
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const now = new Date()
  const filteredReminders = reminders.filter(reminder => {
    const reminderDate = new Date(reminder.reminder_date)
    if (filter === 'overdue') return reminderDate < now
    if (filter === 'upcoming') return reminderDate >= now
    return true
  })

  const overdueCount = reminders.filter(r => new Date(r.reminder_date) < now).length
  const upcomingCount = reminders.filter(r => new Date(r.reminder_date) >= now).length

  const renderItem = ({ item }: { item: ReminderWithLead }) => {
    const isOverdue = new Date(item.reminder_date) < now

    return (
      <View style={[styles.card, isOverdue && styles.cardOverdue]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons
              name="notifications"
              size={20}
              color={isOverdue ? '#EF4444' : '#F59E0B'}
            />
            <Text style={[styles.cardDate, isOverdue && styles.textOverdue]}>
              {formatDateTime(item.reminder_date)}
            </Text>
          </View>
          {isOverdue && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>En retard</Text>
            </View>
          )}
        </View>

        <Text style={styles.message}>{item.message}</Text>

        {item.lead && (
          <TouchableOpacity
            style={styles.leadLink}
            onPress={() => navigation.navigate('CRMLeadDetail', { id: item.lead!.id })}
          >
            <Ionicons name="person" size={16} color="#666" />
            <Text style={styles.leadName}>
              {item.lead.contact_name}
              {item.lead.company_name && ` - ${item.lead.company_name}`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        )}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => completeReminder(item.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.completeButtonText}>Marquer fait</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rappels CRM</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Tous ({reminders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'overdue' && styles.filterButtonActive,
            { borderLeftColor: '#EF4444', borderLeftWidth: 3 }
          ]}
          onPress={() => setFilter('overdue')}
        >
          <Text style={[styles.filterText, filter === 'overdue' && styles.filterTextActive]}>
            En retard ({overdueCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'upcoming' && styles.filterButtonActive,
            { borderLeftColor: '#F59E0B', borderLeftWidth: 3 }
          ]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
            À venir ({upcomingCount})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredReminders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {loading ? 'Chargement...' : 'Aucun rappel en attente'}
            </Text>
          </View>
        }
      />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  textOverdue: {
    color: '#EF4444',
  },
  overdueBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overdueBadgeText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  leadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  leadName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  completeButtonText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
})
