import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MaterialRequest } from '../types'
import { SearchBar, Badge, EmptyState } from '../components'

type FilterType = 'all' | 'en_attente' | 'traite' | 'mine'

export default function RequisitionsScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('material_requests')
        .select(`
          *,
          requester:users!requester_id(email, first_name, last_name),
          items:material_request_items(*)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'mine' && user?.id) {
        query = query.eq('requester_id', user.id)
      } else if (filter === 'en_attente' || filter === 'traite') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error('Erreur fetch requests:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchRequests()
    }, [filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchRequests()
  }

  const filteredRequests = requests.filter((request) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      request.request_number.toLowerCase().includes(query) ||
      request.client_name.toLowerCase().includes(query) ||
      request.servicentre_call_number.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRequesterName = (request: MaterialRequest) => {
    if (request.requester?.first_name) {
      return `${request.requester.first_name} ${request.requester.last_name || ''}`
    }
    return request.requester?.email || '-'
  }

  const renderRequest = ({ item: request }: { item: MaterialRequest }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DetailsRequisition', { requestId: request.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.reqNumber}>{request.request_number}</Text>
        <Badge
          label={request.status === 'en_attente' ? 'En attente' : 'Traité'}
          variant={request.status === 'en_attente' ? 'pending' : 'success'}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.row}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{request.client_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Demandeur</Text>
          <Text style={styles.value}>{getRequesterName(request)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>N° Servicentre</Text>
          <Text style={styles.value}>{request.servicentre_call_number}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Items</Text>
          <Text style={styles.value}>{request.items?.length || 0} item(s)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{formatDate(request.created_at)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewDetails}>Voir les détails →</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Recherche */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher par numéro, client..."
      />

      {/* Filtres */}
      <View style={styles.filters}>
        {(['all', 'en_attente', 'traite', 'mine'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Tous' : f === 'en_attente' ? 'En attente' : f === 'traite' ? 'Traités' : 'Mes req.'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="📦"
            title="Aucune réquisition"
            description={searchQuery ? 'Aucun résultat pour votre recherche' : 'Les réquisitions apparaîtront ici'}
            actionLabel="Créer une réquisition"
            onAction={() => navigation.navigate('NouvelleRequisition')}
          />
        }
      />
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
    gap: 6,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 12,
    paddingTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reqNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardBody: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 14,
    alignItems: 'center',
  },
  viewDetails: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
  },
})
