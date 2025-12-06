import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Task, TaskStatus, TaskPriority } from '../types'

const statusLabels: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  a_faire: { label: 'À faire', bg: '#F3F4F6', text: '#374151' },
  en_cours: { label: 'En cours', bg: '#DBEAFE', text: '#1D4ED8' },
  termine: { label: 'Terminé', bg: '#D1FAE5', text: '#059669' },
  bloque: { label: 'Bloqué', bg: '#FEE2E2', text: '#DC2626' },
  annule: { label: 'Annulé', bg: '#F3F4F6', text: '#6B7280' },
}

const priorityLabels: Record<TaskPriority, { label: string; color: string }> = {
  basse: { label: 'Basse', color: '#9CA3AF' },
  normale: { label: 'Normale', color: '#3B82F6' },
  haute: { label: 'Haute', color: '#F97316' },
  urgente: { label: 'Urgente', color: '#DC2626' },
}

export default function TachesScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'mine'>('active')

  const fetchTasks = async () => {
    if (!user?.id) return

    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          creator:users!created_by(id, email, first_name, last_name),
          assignee:users!assigned_to(id, email, first_name, last_name),
          subtasks:task_subtasks(id, is_completed)
        `)
        .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (filter === 'active') {
        query = query.not('status', 'in', '("termine","annule")')
      } else if (filter === 'mine') {
        query = query.eq('assigned_to', user.id)
      }

      const { data, error } = await query

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Erreur fetch tâches:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchTasks()
    }, [user?.id, filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchTasks()
  }

  const getUserName = (user?: { first_name?: string; last_name?: string; email?: string }) => {
    if (!user) return 'Non assignée'
    if (user.first_name) return `${user.first_name} ${user.last_name || ''}`.trim()
    return user.email?.split('@')[0] || 'Inconnu'
  }

  const getSubtaskProgress = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null
    const completed = task.subtasks.filter(s => s.is_completed).length
    return { completed, total: task.subtasks.length }
  }

  const renderTask = ({ item }: { item: Task }) => {
    const status = statusLabels[item.status]
    const priority = priorityLabels[item.priority]
    const progress = getSubtaskProgress(item)

    return (
      <TouchableOpacity
        style={[styles.taskCard, { borderLeftColor: priority.color }]}
        onPress={() => navigation.navigate('DetailsTache', { taskId: item.id })}
      >
        <View style={styles.taskHeader}>
          <Text style={styles.taskNumber}>{item.task_number}</Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.taskMeta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Assignée à:</Text>
            <Text style={styles.metaValue}>{getUserName(item.assignee)}</Text>
          </View>

          {item.priority !== 'normale' && (
            <View style={[styles.priorityBadge, { backgroundColor: priority.color + '20' }]}>
              <Text style={[styles.priorityText, { color: priority.color }]}>
                {priority.label}
              </Text>
            </View>
          )}
        </View>

        {progress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress.completed / progress.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.completed}/{progress.total}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Filtres */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'active' && styles.filterActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Actives
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'mine' && styles.filterActive]}
          onPress={() => setFilter('mine')}
        >
          <Text style={[styles.filterText, filter === 'mine' && styles.filterTextActive]}>
            Mes tâches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Toutes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#64191E']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Aucune tâche</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('NouvelleTache')}
            >
              <Text style={styles.createButtonText}>+ Créer une tâche</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NouvelleTache')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
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
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  filterActive: {
    backgroundColor: '#64191E',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskNumber: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
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
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#64191E',
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    marginTop: -2,
  },
})
