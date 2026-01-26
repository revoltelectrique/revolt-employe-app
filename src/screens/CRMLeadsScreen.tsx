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
  CRMLead,
  CRMLeadStatus,
  CRM_STATUS_LABELS,
  CRM_STATUS_COLORS,
  CRM_CLIENT_TYPE_LABELS
} from '../types'
import SearchBar from '../components/SearchBar'
import Badge from '../components/Badge'

const STATUS_ORDER: CRMLeadStatus[] = [
  'nouveau',
  'contacte',
  'qualifie',
  'converti',
  'perdu'
]

export default function CRMLeadsScreen() {
  const navigation = useNavigation<any>()
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<CRMLeadStatus | 'all'>('all')

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_leads')
        .select(`
          *,
          assigned_user:users!crm_leads_assigned_to_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
      filterLeads(data || [], searchQuery, selectedStatus)
    } catch (error) {
      console.error('Error loading leads:', error)
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

  const filterLeads = (
    data: CRMLead[],
    query: string,
    status: CRMLeadStatus | 'all'
  ) => {
    let filtered = data

    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(
        (lead) =>
          lead.contact_name.toLowerCase().includes(lowerQuery) ||
          lead.company_name?.toLowerCase().includes(lowerQuery) ||
          lead.phone_main?.includes(query) ||
          lead.email?.toLowerCase().includes(lowerQuery) ||
          lead.city?.toLowerCase().includes(lowerQuery)
      )
    }

    if (status !== 'all') {
      filtered = filtered.filter((lead) => lead.status === status)
    }

    setFilteredLeads(filtered)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    filterLeads(leads, query, selectedStatus)
  }

  const handleStatusFilter = (status: CRMLeadStatus | 'all') => {
    setSelectedStatus(status)
    filterLeads(leads, searchQuery, status)
  }

  const getStatusCount = (status: CRMLeadStatus) => {
    return leads.filter((lead) => lead.status === status).length
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(amount)
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
          Tous ({leads.length})
        </Text>
      </TouchableOpacity>
      {STATUS_ORDER.map((status) => (
        <TouchableOpacity
          key={status}
          style={[
            styles.statusFilterButton,
            selectedStatus === status && styles.statusFilterButtonActive,
            { borderLeftColor: CRM_STATUS_COLORS[status], borderLeftWidth: 3 }
          ]}
          onPress={() => handleStatusFilter(status)}
        >
          <Text style={[
            styles.statusFilterText,
            selectedStatus === status && styles.statusFilterTextActive
          ]}>
            {CRM_STATUS_LABELS[status].substring(0, 6)} ({getStatusCount(status)})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  const renderItem = ({ item }: { item: CRMLead }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CRMLeadDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.leadNumber}>{item.lead_number}</Text>
          <Text style={styles.contactName}>{item.contact_name}</Text>
          {item.company_name && (
            <Text style={styles.companyName}>{item.company_name}</Text>
          )}
        </View>
        <Badge
          text={CRM_STATUS_LABELS[item.status]}
          color={CRM_STATUS_COLORS[item.status]}
        />
      </View>

      <View style={styles.cardBody}>
        {item.phone_main && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.phone_main}</Text>
          </View>
        )}
        {item.city && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.city}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{CRM_CLIENT_TYPE_LABELS[item.client_type]}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.valueContainer}>
          <Text style={styles.valueLabel}>Valeur estimée</Text>
          <Text style={styles.valueAmount}>{formatCurrency(item.estimated_value)}</Text>
        </View>
        <View style={styles.indicators}>
          {item.next_followup_date && (
            <View style={styles.indicator}>
              <Ionicons
                name="calendar"
                size={16}
                color={new Date(item.next_followup_date) < new Date() ? '#EF4444' : '#666'}
              />
              <Text style={[
                styles.indicatorText,
                new Date(item.next_followup_date) < new Date() && { color: '#EF4444' }
              ]}>
                {formatDate(item.next_followup_date)}
              </Text>
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
          <Text style={styles.headerTitle}>Prospects</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CRMNewLead')}>
            <Ionicons name="add-circle" size={28} color="#10B981" />
          </TouchableOpacity>
        </View>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder="Rechercher par nom, entreprise, téléphone..."
      />

      {renderStatusFilter()}

      <FlatList
        data={filteredLeads}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {loading ? 'Chargement...' : 'Aucun prospect trouvé'}
            </Text>
            {!loading && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('CRMNewLead')}
              >
                <Text style={styles.emptyButtonText}>Créer un prospect</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  statusFilterButtonActive: {
    backgroundColor: '#10B981',
  },
  statusFilterText: {
    fontSize: 11,
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  leadNumber: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  companyName: {
    fontSize: 13,
    color: '#666',
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
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
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
  valueContainer: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 10,
    color: '#999',
  },
  valueAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
})
