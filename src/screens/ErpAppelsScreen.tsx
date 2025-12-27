import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  TextInput,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { ErpServiceCall, ErpServiceCallStatus } from '../types'

type RootStackParamList = {
  ErpDetailsAppel: { id: string }
  ErpNouvelAppel: undefined
}

const STATUS_LABELS: Record<ErpServiceCallStatus, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  termine: 'Terminé',
  facture: 'Facturé',
  annule: 'Annulé',
}

const STATUS_COLORS: Record<ErpServiceCallStatus, { bg: string; text: string }> = {
  ouvert: { bg: '#DBEAFE', text: '#1D4ED8' },
  en_cours: { bg: '#FEF3C7', text: '#D97706' },
  termine: { bg: '#D1FAE5', text: '#059669' },
  facture: { bg: '#E5E7EB', text: '#374151' },
  annule: { bg: '#FEE2E2', text: '#DC2626' },
}

export default function ErpAppelsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [calls, setCalls] = useState<ErpServiceCall[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')

  const loadCalls = useCallback(async () => {
    try {
      let query = supabase
        .from('erp_service_calls')
        .select(`
          *,
          client_facture_a:erp_clients!erp_service_calls_client_facture_a_id_fkey(id, numero, nom),
          client_effectue_pour:erp_clients!erp_service_calls_client_effectue_pour_id_fkey(id, numero, nom),
          creator:users!erp_service_calls_created_by_fkey(id, email, first_name, last_name)
        `)
        .order('numero', { ascending: false })

      // Apply filters
      if (filter === 'active') {
        query = query.in('statut', ['ouvert', 'en_cours'])
      } else if (filter === 'closed') {
        query = query.in('statut', ['termine', 'facture', 'annule'])
      }

      const { data, error } = await query.limit(50)

      if (error) throw error
      setCalls(data || [])
    } catch (error) {
      console.error('Erreur chargement appels:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    loadCalls()
  }, [loadCalls])

  const onRefresh = () => {
    setRefreshing(true)
    loadCalls()
  }

  const filteredCalls = calls.filter((call) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      call.numero.toString().includes(searchLower) ||
      call.client_facture_a?.nom?.toLowerCase().includes(searchLower) ||
      call.localisation?.toLowerCase().includes(searchLower) ||
      call.description?.toLowerCase().includes(searchLower)
    )
  })

  const renderCall = ({ item }: { item: ErpServiceCall }) => {
    const statusColor = STATUS_COLORS[item.statut]

    return (
      <TouchableOpacity
        style={styles.callCard}
        onPress={() => navigation.navigate('ErpDetailsAppel', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.callHeader}>
          <View style={styles.callNumber}>
            <Text style={styles.callNumberText}>#{item.numero}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {STATUS_LABELS[item.statut]}
            </Text>
          </View>
        </View>

        <Text style={styles.clientName} numberOfLines={1}>
          {item.client_facture_a?.nom || 'Client non spécifié'}
        </Text>

        {item.client_effectue_pour && item.client_effectue_pour.id !== item.client_facture_a?.id && (
          <Text style={styles.clientSecondary} numberOfLines={1}>
            Pour: {item.client_effectue_pour.nom}
          </Text>
        )}

        {item.localisation && (
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{item.localisation}</Text>
          </View>
        )}

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.callFooter}>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString('fr-CA')}
          </Text>
          {item.po_client && (
            <Text style={styles.poText}>P.O. {item.po_client}</Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appels de service</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('ErpNouvelAppel')}
        >
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterTabText, filter === 'active' && styles.filterTabTextActive]}>
            Actifs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'closed' && styles.filterTabActive]}
          onPress={() => setFilter('closed')}
        >
          <Text style={[styles.filterTabText, filter === 'closed' && styles.filterTabTextActive]}>
            Fermés
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            Tous
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredCalls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loading ? (
              <Text style={styles.emptyText}>Chargement...</Text>
            ) : (
              <>
                <Text style={styles.emptyIcon}>📞</Text>
                <Text style={styles.emptyTitle}>Aucun appel</Text>
                <Text style={styles.emptyText}>
                  {search
                    ? 'Aucun résultat pour cette recherche'
                    : 'Créez un nouvel appel de service'}
                </Text>
              </>
            )}
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
  },
  header: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '400',
  },
  searchContainer: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#fff',
    fontSize: 15,
  },
  clearIcon: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    padding: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterTabActive: {
    backgroundColor: '#8B5CF6',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  callCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callNumber: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  clientSecondary: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  callFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  poText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
})
