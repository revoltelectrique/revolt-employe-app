import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import { AvantageProduct } from '../types'

type RootStackParamList = {
  ErpDetailsProduit: { code: string }
}

export default function ErpInventaireScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [products, setProducts] = useState<AvantageProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const PAGE_SIZE = 30

  const loadProducts = useCallback(
    async (reset = false) => {
      try {
        const currentPage = reset ? 0 : page
        const from = currentPage * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        let query = supabase
          .from('avantage_products')
          .select('*', { count: 'exact' })

        if (search) {
          query = query.or(
            `code.ilike.%${search}%,description.ilike.%${search}%,fournisseur.ilike.%${search}%`
          )
        }

        query = query.range(from, to).order('code')

        const { data, count, error } = await query

        if (error) throw error

        if (reset) {
          setProducts(data || [])
          setPage(0)
        } else {
          setProducts((prev) => [...prev, ...(data || [])])
        }

        setTotalCount(count || 0)
        setHasMore((data?.length || 0) === PAGE_SIZE)
      } catch (error) {
        console.error('Erreur chargement produits:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [page, search]
  )

  useEffect(() => {
    setLoading(true)
    loadProducts(true)
  }, [search])

  const onRefresh = () => {
    setRefreshing(true)
    loadProducts(true)
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage((p) => p + 1)
      loadProducts()
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const renderProduct = ({ item }: { item: AvantageProduct }) => {
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ErpDetailsProduit', { code: item.code })}
        activeOpacity={0.7}
      >
        <View style={styles.productHeader}>
          <Text style={styles.productCode}>{item.code}</Text>
          <Text
            style={[
              styles.stockBadge,
              item.quantite_stock <= 0
                ? styles.stockEmpty
                : item.quantite_stock < 5
                ? styles.stockLow
                : styles.stockOk,
            ]}
          >
            {item.quantite_stock} {item.unite}
          </Text>
        </View>

        <Text style={styles.productDesc} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.productFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Coûtant</Text>
            <Text style={styles.priceCost}>{formatMoney(item.prix_coutant)}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Vente</Text>
            <Text style={styles.priceSale}>{formatMoney(item.prix_vente)}</Text>
          </View>
          {item.categorie && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.categorie}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inventaire</Text>
          <Text style={styles.headerCount}>{totalCount} produits</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher code, description..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97706" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && !refreshing ? (
            <ActivityIndicator size="small" color="#D97706" style={styles.loader} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Aucun produit</Text>
              <Text style={styles.emptyText}>
                {search ? 'Aucun résultat pour cette recherche' : 'Aucun produit synchronisé'}
              </Text>
            </View>
          ) : null
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
    backgroundColor: '#D97706',
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchContainer: {
    backgroundColor: '#D97706',
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
  listContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D97706',
    fontFamily: 'monospace',
  },
  stockBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockOk: {
    backgroundColor: '#D1FAE5',
    color: '#059669',
  },
  stockLow: {
    backgroundColor: '#FEF3C7',
    color: '#D97706',
  },
  stockEmpty: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  productDesc: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  priceContainer: {
    marginRight: 20,
  },
  priceLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  priceCost: {
    fontSize: 14,
    color: '#666',
  },
  priceSale: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryBadge: {
    marginLeft: 'auto',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
  loader: {
    paddingVertical: 20,
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
