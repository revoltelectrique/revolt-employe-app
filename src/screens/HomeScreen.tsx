import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CompanyNews, NewsCategory, Task, TaskStatus, TaskPriority } from '../types'
import { useOfflineList } from '../hooks/useOfflineData'
import { CacheKeys } from '../lib/storage'
import { useOffline } from '../contexts/OfflineContext'

const categoryStyles: Record<NewsCategory, { bg: string; text: string; label: string }> = {
  info: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Information' },
  urgent: { bg: '#FEF2F2', text: '#DC2626', label: 'Urgent' },
  evenement: { bg: '#F0FDF4', text: '#16A34A', label: 'Événement' },
}

const statusLabels: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  a_faire: { label: 'À faire', bg: '#F3F4F6', text: '#374151' },
  en_cours: { label: 'En cours', bg: '#DBEAFE', text: '#1D4ED8' },
  termine: { label: 'Terminé', bg: '#D1FAE5', text: '#059669' },
  bloque: { label: 'Bloqué', bg: '#FEE2E2', text: '#DC2626' },
  annule: { label: 'Annulé', bg: '#F3F4F6', text: '#6B7280' },
}

const priorityColors: Record<TaskPriority, string> = {
  basse: '#9CA3AF',
  normale: '#3B82F6',
  haute: '#F97316',
  urgente: '#DC2626',
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function HomeScreen() {
  const navigation = useNavigation<any>()
  const { profile, user } = useAuth()
  const { isOnline } = useOffline()

  const displayName = profile?.first_name || profile?.email?.split('@')[0] || 'Employé'

  // Fetch tâches avec cache offline
  const fetchTasks = async (): Promise<Task[]> => {
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .not('status', 'in', '("termine","annule")')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw error
    return data || []
  }

  // Fetch news avec cache offline
  const fetchNews = async (): Promise<CompanyNews[]> => {
    const { data, error } = await supabase
      .from('company_news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(5)
    if (error) throw error
    return data || []
  }

  const {
    data: tasks,
    loading: tasksLoading,
    isStale: tasksStale,
    refetch: refetchTasks,
  } = useOfflineList<Task>(
    fetchTasks,
    CacheKeys.tasksList(user?.id || 'guest'),
    [user?.id]
  )

  const {
    data: news,
    loading: newsLoading,
    isStale: newsStale,
    refetch: refetchNews,
  } = useOfflineList<CompanyNews>(
    fetchNews,
    CacheKeys.news(),
    []
  )

  const loading = tasksLoading && newsLoading
  const refreshing = false // Géré par le hook

  const onRefresh = async () => {
    await Promise.all([refetchTasks(), refetchNews()])
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#64191E']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {displayName}!</Text>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>Portail Employé ReVolt</Text>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>Hors ligne</Text>
            </View>
          )}
          {isOnline && (tasksStale || newsStale) && (
            <View style={styles.staleBadge}>
              <Text style={styles.staleBadgeText}>Données en cache</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, { borderLeftColor: '#64191E' }]}
            onPress={() => navigation.navigate('NouveauBC')}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionTitle}>Nouveau BC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderLeftColor: '#2563EB' }]}
            onPress={() => navigation.navigate('NouvelleRequisition')}
          >
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionTitle}>Nouvelle réquisition</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mes tâches */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes tâches</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tâches')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {(tasks || []).length > 0 ? (
          (tasks || []).map((task) => {
            const status = statusLabels[task.status]
            const priorityColor = priorityColors[task.priority]
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskCard, { borderLeftColor: priorityColor }]}
                onPress={() => navigation.navigate('DetailsTache', { taskId: task.id })}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskNumber}>{task.task_number}</Text>
                  <View style={[styles.taskBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.taskBadgeText, { color: status.text }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
              </TouchableOpacity>
            )
          })
        ) : (
          <View style={styles.emptyTasks}>
            <Text style={styles.emptyTasksIcon}>✓</Text>
            <Text style={styles.emptyTasksText}>Aucune tâche active</Text>
            <TouchableOpacity
              style={styles.newTaskButton}
              onPress={() => navigation.navigate('NouvelleTache')}
            >
              <Text style={styles.newTaskButtonText}>+ Nouvelle tâche</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Nouvelles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dernières nouvelles</Text>
        {(news || []).length > 0 ? (
          (news || []).map((item) => {
            const style = categoryStyles[item.category]
            return (
              <View
                key={item.id}
                style={[styles.newsCard, { backgroundColor: style.bg }]}
              >
                <View style={styles.newsHeader}>
                  <View style={[styles.badge, { backgroundColor: style.text + '20' }]}>
                    <Text style={[styles.badgeText, { color: style.text }]}>
                      {style.label}
                    </Text>
                  </View>
                  <Text style={styles.newsDate}>{formatDate(item.published_at)}</Text>
                </View>
                <Text style={[styles.newsTitle, { color: style.text }]}>{item.title}</Text>
                <Text style={styles.newsContent}>{item.content}</Text>
              </View>
            )
          })
        ) : (
          <View style={styles.emptyNews}>
            <Text style={styles.emptyText}>Aucune nouvelle pour le moment</Text>
          </View>
        )}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#64191E',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  offlineBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  staleBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  staleBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: '#64191E',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  taskCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskNumber: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  taskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  taskBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  emptyTasks: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTasksIcon: {
    fontSize: 32,
    color: '#10B981',
    marginBottom: 8,
  },
  emptyTasksText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  newTaskButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#64191E',
    borderRadius: 8,
  },
  newTaskButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  newsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newsDate: {
    fontSize: 12,
    color: '#666',
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  newsContent: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  emptyNews: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
})
