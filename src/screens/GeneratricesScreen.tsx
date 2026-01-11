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
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import {
  GeneratorInstallation,
  GeneratorInstallationStatus,
  GENERATOR_STATUS_LABELS,
  GENERATOR_STATUS_COLORS
} from '../types'
import SearchBar from '../components/SearchBar'
import Badge from '../components/Badge'

const STATUS_ORDER: GeneratorInstallationStatus[] = [
  'a_planifier',
  'planifie',
  'en_cours',
  'complete',
  'documents_envoyes'
]

export default function GeneratricesScreen() {
  const navigation = useNavigation<any>()
  const [installations, setInstallations] = useState<GeneratorInstallation[]>([])
  const [filteredInstallations, setFilteredInstallations] = useState<GeneratorInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<GeneratorInstallationStatus | 'all'>('all')

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('generator_installations')
        .select('*')
        .order('client_number', { ascending: true })

      if (error) throw error
      setInstallations(data || [])
      filterInstallations(data || [], searchQuery, selectedStatus)
    } catch (error) {
      console.error('Error loading installations:', error)
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

  const filterInstallations = (
    data: GeneratorInstallation[],
    query: string,
    status: GeneratorInstallationStatus | 'all'
  ) => {
    let filtered = data

    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(
        (i) =>
          i.client_name.toLowerCase().includes(lowerQuery) ||
          i.address?.toLowerCase().includes(lowerQuery) ||
          i.phone?.includes(query) ||
          i.email?.toLowerCase().includes(lowerQuery)
      )
    }

    if (status !== 'all') {
      filtered = filtered.filter((i) => i.status === status)
    }

    setFilteredInstallations(filtered)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    filterInstallations(installations, query, selectedStatus)
  }

  const handleStatusFilter = (status: GeneratorInstallationStatus | 'all') => {
    setSelectedStatus(status)
    filterInstallations(installations, searchQuery, status)
  }

  const getStatusCount = (status: GeneratorInstallationStatus) => {
    return installations.filter((i) => i.status === status).length
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA')
  }

  const renderStatusFilter = () => (
    <View style={styles.statusFilterContainer}>
      <TouchableOpacity
        style={[
          styles.statusFilterButton,
          selectedStatus === 'all' && styles.statusFilterButtonActive
        ]}
        onPress={() => handleStatusFilter('all')}
      >
        <Text style={[
          styles.statusFilterText,
          selectedStatus === 'all' && styles.statusFilterTextActive
        ]}>
          Tous ({installations.length})
        </Text>
      </TouchableOpacity>
      {STATUS_ORDER.map((status) => (
        <TouchableOpacity
          key={status}
          style={[
            styles.statusFilterButton,
            selectedStatus === status && styles.statusFilterButtonActive,
            { borderLeftColor: GENERATOR_STATUS_COLORS[status], borderLeftWidth: 3 }
          ]}
          onPress={() => handleStatusFilter(status)}
        >
          <Text style={[
            styles.statusFilterText,
            selectedStatus === status && styles.statusFilterTextActive
          ]}>
            {GENERATOR_STATUS_LABELS[status].split(' ')[0]} ({getStatusCount(status)})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  const renderItem = ({ item }: { item: GeneratorInstallation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DetailsGeneratrice', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.clientNumber}>#{item.client_number}</Text>
          <Text style={styles.clientName}>{item.client_name}</Text>
        </View>
        <Badge
          text={GENERATOR_STATUS_LABELS[item.status]}
          color={GENERATOR_STATUS_COLORS[item.status]}
        />
      </View>

      <View style={styles.cardBody}>
        {item.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}
        {item.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>
        )}
        {item.installation_date && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{formatDate(item.installation_date)}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.indicators}>
          {item.signature_image_url && (
            <View style={styles.indicator}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={styles.indicatorText}>Signé</Text>
            </View>
          )}
          {item.generator_brand && (
            <View style={styles.indicator}>
              <Ionicons name="flash" size={16} color="#F59E0B" />
              <Text style={styles.indicatorText}>{item.generator_brand}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Génératrices</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Suivi des installations résidentielles
        </Text>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder="Rechercher par nom, adresse, téléphone..."
      />

      {renderStatusFilter()}

      <FlatList
        data={filteredInstallations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {loading ? 'Chargement...' : 'Aucune installation trouvée'}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statusFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  statusFilterButtonActive: {
    backgroundColor: '#64191E',
  },
  statusFilterText: {
    fontSize: 12,
    color: '#666',
  },
  statusFilterTextActive: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  clientNumber: {
    fontSize: 12,
    color: '#999',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  indicators: {
    flexDirection: 'row',
    gap: 12,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
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
