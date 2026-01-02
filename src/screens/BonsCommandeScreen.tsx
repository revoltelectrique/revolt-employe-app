import React, { useState, useCallback, useMemo } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PurchaseOrder } from '../types'
import { SearchBar, Badge, EmptyState } from '../components'
import { useOfflineData } from '../hooks/useOfflineData'
import { CacheKeys, CacheTTL } from '../lib/storage'
import { useOffline } from '../contexts/OfflineContext'

type FilterType = 'all' | 'en_attente' | 'traite' | 'mine'

export default function BonsCommandeScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch avec cache offline
  const fetchOrders = useCallback(async (): Promise<PurchaseOrder[]> => {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        requester:users!requester_id(email, first_name, last_name),
        items:purchase_order_items(*)
      `)
      .order('created_at', { ascending: false })

    if (filter === 'mine' && user?.id) {
      query = query.eq('requester_id', user.id)
    } else if (filter === 'en_attente' || filter === 'traite') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }, [filter, user?.id])

  // Cache key inclut le filtre
  const cacheKey = useMemo(
    () => `${CacheKeys.purchaseOrdersList(user?.id || 'guest')}:${filter}`,
    [user?.id, filter]
  )

  const {
    data: orders,
    loading,
    isStale,
    isFromCache,
    refetch,
  } = useOfflineData<PurchaseOrder[]>(fetchOrders, {
    cacheKey,
    ttl: CacheTTL.MEDIUM,
    strategy: 'stale-while-revalidate',
    dependencies: [filter, user?.id],
  })

  const onRefresh = async () => {
    await refetch()
  }

  const filteredOrders = (orders || []).filter((order) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.po_number?.toLowerCase().includes(query) ||
      order.supplier_name?.toLowerCase().includes(query) ||
      order.client_name?.toLowerCase().includes(query)
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

  const getRequesterName = (order: PurchaseOrder) => {
    if (order.requester?.first_name) {
      return `${order.requester.first_name} ${order.requester.last_name || ''}`
    }
    return order.requester?.email || '-'
  }

  const calculateTotal = (items?: PurchaseOrder['items']) => {
    if (!items || items.length === 0) return null
    const total = items.reduce((sum, item) => {
      return sum + (item.price ? item.price * item.quantity : 0)
    }, 0)
    return total > 0 ? total : null
  }

  const renderOrder = ({ item: order }: { item: PurchaseOrder }) => {
    const total = calculateTotal(order.items)

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('DetailsBC', { orderId: order.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.poNumber}>{order.po_number}</Text>
          <Badge
            label={order.status === 'en_attente' ? 'En attente' : 'Traité'}
            variant={order.status === 'en_attente' ? 'pending' : 'success'}
          />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Fournisseur</Text>
            <Text style={styles.value}>{order.supplier_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Demandeur</Text>
            <Text style={styles.value}>{getRequesterName(order)}</Text>
          </View>
          {total && (
            <View style={styles.row}>
              <Text style={styles.label}>Montant</Text>
              <Text style={styles.value}>{total.toFixed(2)} $</Text>
            </View>
          )}
          {order.is_billable && (
            <View style={styles.row}>
              <Text style={styles.label}>Client</Text>
              <Text style={styles.value}>{order.client_name}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(order.created_at)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetails}>Voir les détails →</Text>
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
      {/* Indicateur offline/cache */}
      {(!isOnline || isFromCache) && (
        <View style={[styles.cacheIndicator, !isOnline && styles.offlineIndicator]}>
          <Text style={styles.cacheIndicatorText}>
            {!isOnline ? '📡 Mode hors ligne' : isStale ? '⏳ Données en cache' : '✓ Cache récent'}
          </Text>
        </View>
      )}

      {/* Recherche */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher par numéro, fournisseur..."
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
              {f === 'all' ? 'Tous' : f === 'en_attente' ? 'En attente' : f === 'traite' ? 'Traités' : 'Mes BC'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} colors={['#64191E']} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="📄"
            title="Aucun bon de commande"
            description={searchQuery ? 'Aucun résultat pour votre recherche' : 'Les bons de commande apparaîtront ici'}
            actionLabel="Créer un BC"
            onAction={() => navigation.navigate('NouveauBC')}
          />
        }
      />

      {/* Bouton flottant pour ajouter */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NouveauBC')}
        activeOpacity={0.8}
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
  cacheIndicator: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  offlineIndicator: {
    backgroundColor: '#FEE2E2',
  },
  cacheIndicatorText: {
    fontSize: 12,
    color: '#92400E',
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
    backgroundColor: '#64191E',
    borderColor: '#64191E',
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
  poNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64191E',
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
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 14,
    alignItems: 'center',
  },
  viewDetails: {
    color: '#64191E',
    fontWeight: '600',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
})
