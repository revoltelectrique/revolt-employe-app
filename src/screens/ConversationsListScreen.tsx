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
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { Conversation } from '../types'
import { SearchBar, Badge, EmptyState } from '../components'

type FilterType = 'all' | 'ouverte' | 'fermee'

const statusStyles = {
  ouverte: { bg: '#DCFCE7', text: '#16A34A', label: 'Ouverte' },
  fermee: { bg: '#FEE2E2', text: '#DC2626', label: 'Fermée' },
  archivee: { bg: '#F3F4F6', text: '#6B7280', label: 'Archivée' },
}

export default function ConversationsListScreen() {
  const navigation = useNavigation<any>()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = async () => {
    try {
      let query = supabase
        .from('conversations')
        .select(`
          *,
          creator:users!created_by(email, first_name, last_name)
        `)
        .order('updated_at', { ascending: false })

      if (filter === 'ouverte') {
        query = query.eq('status', 'ouverte')
      } else if (filter === 'fermee') {
        query = query.in('status', ['fermee', 'archivee'])
      }

      const { data, error } = await query

      if (error) throw error
      setConversations(data || [])
    } catch (error) {
      console.error('Erreur fetch conversations:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchConversations()
    }, [filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      conv.servicentre_number.toLowerCase().includes(query) ||
      conv.client_name.toLowerCase().includes(query) ||
      conv.location?.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`

    return date.toLocaleDateString('fr-CA', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getCreatorName = (conv: Conversation) => {
    if (conv.creator?.first_name) {
      return `${conv.creator.first_name} ${conv.creator.last_name || ''}`
    }
    return conv.creator?.email?.split('@')[0] || 'Inconnu'
  }

  const getClientInitials = (clientName: string) => {
    const words = clientName.trim().split(/\s+/)
    if (words.length >= 2) {
      return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
    }
    return clientName.substring(0, 2).toUpperCase()
  }

  const renderConversation = ({ item: conv }: { item: Conversation }) => {
    const status = statusStyles[conv.status]

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ConversationChat', { conversationId: conv.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getClientInitials(conv.client_name)}
              </Text>
            </View>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.clientName} numberOfLines={1}>
                {conv.client_name}
              </Text>
              <Text style={styles.servicentreNumber}>
                {conv.servicentre_number}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.timeText}>{formatDate(conv.updated_at)}</Text>
            <View style={[styles.statusDot, { backgroundColor: status.text }]} />
          </View>
        </View>

        {conv.location && (
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {conv.location}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.creatorText}>
            Créé par {getCreatorName(conv)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>
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
      {/* Recherche */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher par client, numéro..."
      />

      {/* Filtres */}
      <View style={styles.filters}>
        {(['all', 'ouverte', 'fermee'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Toutes' : f === 'ouverte' ? 'Ouvertes' : 'Fermées'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#64191E']} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title="Aucune conversation"
            description={searchQuery ? 'Aucun résultat pour votre recherche' : 'Créez une nouvelle conversation pour commencer'}
            actionLabel="Nouvelle conversation"
            onAction={() => navigation.navigate('NouvelleConversation')}
          />
        }
      />

      {/* FAB pour nouvelle conversation */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NouvelleConversation')}
      >
        <Text style={styles.fabIcon}>+</Text>
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#64191E',
    borderColor: '#64191E',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 12,
    paddingTop: 4,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardTitleContainer: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  servicentreNumber: {
    fontSize: 13,
    color: '#64191E',
    fontWeight: '500',
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 56,
  },
  locationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  creatorText: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
})
