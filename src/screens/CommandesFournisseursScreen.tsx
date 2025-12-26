import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { SupplierOrder, SupplierOrderStatus } from '../types'

const statusLabels: Record<SupplierOrderStatus, { label: string; bg: string; text: string }> = {
  en_attente: { label: 'En attente', bg: '#FEF3C7', text: '#D97706' },
  partiel: { label: 'Partiel', bg: '#FED7AA', text: '#EA580C' },
  recu: { label: 'Recu', bg: '#D1FAE5', text: '#059669' },
  annule: { label: 'Annule', bg: '#F3F4F6', text: '#6B7280' },
}

type SupplierOrderWithRelations = SupplierOrder & {
  supplier?: { display_name: string; name: string } | null
  purchase_order?: { po_number: string } | null
  items?: { id: string }[]
}

export default function CommandesFournisseursScreen() {
  const navigation = useNavigation<any>()
  const [orders, setOrders] = useState<SupplierOrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'en_attente' | 'recu'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(display_name, name),
          purchase_order:purchase_orders(po_number),
          items:supplier_order_items(id)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'en_attente') {
        query = query.in('status', ['en_attente', 'partiel'])
      } else if (filter === 'recu') {
        query = query.eq('status', 'recu')
      }

      const { data, error } = await query

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Erreur fetch commandes:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchOrders()
    }, [filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      order.supplier?.display_name?.toLowerCase().includes(search) ||
      order.po_reference?.toLowerCase().includes(search) ||
      order.client_name?.toLowerCase().includes(search) ||
      order.supplier_order_number?.toLowerCase().includes(search) ||
      order.purchase_order?.po_number?.toLowerCase().includes(search)
    )
  })

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
    })
  }

  const renderOrder = ({ item }: { item: SupplierOrderWithRelations }) => {
    const status = statusLabels[item.status] || statusLabels.en_attente

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('DetailsCommandeSupplier', { orderId: item.id })}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.supplierName} numberOfLines={1}>
            {item.supplier?.display_name || 'Fournisseur inconnu'}
          </Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.poNumber}>
            {item.purchase_order?.po_number || item.po_reference || 'Sans P.O.'}
          </Text>
          {item.supplier_order_number && (
            <Text style={styles.orderNumber}>#{item.supplier_order_number}</Text>
          )}
        </View>

        <View style={styles.orderMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.client_name || '-'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Items</Text>
            <Text style={styles.metaValue}>{item.items?.length || 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par P.O., fournisseur, client..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButtonText}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <FilterButton value="all" label="Toutes" />
        <FilterButton value="en_attente" label="En attente" />
        <FilterButton value="recu" label="Recues" />
      </View>

      {/* Bouton Scan QR */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => navigation.navigate('ScanQR')}
      >
        <Text style={styles.scanButtonIcon}>📷</Text>
        <Text style={styles.scanButtonText}>Scanner un QR code</Text>
      </TouchableOpacity>

      {/* Liste */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D97706']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>Aucune commande trouvee</Text>
            <Text style={styles.emptySubtext}>Tirez vers le bas pour actualiser</Text>
          </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  filterButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#D97706',
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  scanButtonIcon: {
    fontSize: 20,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
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
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  poNumber: {
    fontSize: 14,
    color: '#64191E',
    fontWeight: '500',
  },
  orderNumber: {
    fontSize: 13,
    color: '#999',
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
})
