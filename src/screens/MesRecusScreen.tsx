import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Receipt, ReceiptStatus } from '../types'
import { Card, Badge, Button, EmptyState } from '../components'

const statusLabels: Record<ReceiptStatus, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé'
}

const statusColors: Record<ReceiptStatus, { bg: string; text: string }> = {
  en_attente: { bg: '#FEF3C7', text: '#D97706' },
  approuve: { bg: '#D1FAE5', text: '#059669' },
  refuse: { bg: '#FEE2E2', text: '#DC2626' }
}

export default function MesRecusScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<ReceiptStatus | 'all'>('all')

  const loadReceipts = async () => {
    try {
      let query = supabase
        .from('receipts')
        .select(`
          *,
          category:receipt_categories(id, name)
        `)
        .eq('submitted_by', user?.id)
        .order('submission_date', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setReceipts(data || [])
    } catch (error) {
      console.error('Erreur chargement reçus:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadReceipts()
    }, [filter])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadReceipts()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const filters: { value: ReceiptStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'approuve', label: 'Approuvés' },
    { value: 'refuse', label: 'Refusés' }
  ]

  const renderReceipt = ({ item }: { item: Receipt }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('DetailsRecu', { receiptId: item.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.receiptCard}>
        <View style={styles.receiptHeader}>
          <View style={styles.receiptInfo}>
            <Text style={styles.receiptNumber}>{item.receipt_number}</Text>
            <Text style={styles.receiptDate}>
              Soumis le {formatDate(item.submission_date)}
            </Text>
          </View>
          <Badge
            label={statusLabels[item.status]}
            variant={
              item.status === 'approuve' ? 'success' :
              item.status === 'refuse' ? 'danger' : 'pending'
            }
          />
        </View>

        <View style={styles.receiptContent}>
          {item.image_url && (
            <Image
              source={{ uri: item.image_url }}
              style={styles.receiptThumbnail}
            />
          )}
          <View style={styles.receiptDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fournisseur:</Text>
              <Text style={styles.detailValue}>{item.vendor_name || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Catégorie:</Text>
              <Text style={styles.detailValue}>{item.category?.name || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total:</Text>
              <Text style={styles.totalAmount}>{formatCurrency(item.total_amount)}</Text>
            </View>
          </View>
        </View>

        {item.status === 'refuse' && item.rejection_reason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionLabel}>Raison du refus:</Text>
            <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
          </View>
        )}

        {item.project_name && (
          <View style={styles.projectBadge}>
            <Text style={styles.projectText}>📍 {item.project_name}</Text>
          </View>
        )}

        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Appuyez pour voir les détails →</Text>
        </View>
      </Card>
    </TouchableOpacity>
  )

  // Statistiques
  const stats = {
    total: receipts.length,
    pending: receipts.filter(r => r.status === 'en_attente').length,
    approved: receipts.filter(r => r.status === 'approuve').length,
    rejected: receipts.filter(r => r.status === 'refuse').length,
    totalAmount: receipts
      .filter(r => r.status === 'approuve')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)
  }

  return (
    <View style={styles.container}>
      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#059669' }]}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approuvés</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#64191E' }]}>
            {formatCurrency(stats.totalAmount)}
          </Text>
          <Text style={styles.statLabel}>Total approuvé</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterChip,
              filter === f.value && styles.filterChipActive
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.value && styles.filterChipTextActive
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste des reçus */}
      <FlatList
        data={receipts}
        renderItem={renderReceipt}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="🧾"
              title="Aucun reçu"
              description={
                filter === 'all'
                  ? "Vous n'avez pas encore soumis de reçu"
                  : `Aucun reçu avec le statut "${filters.find(f => f.value === filter)?.label}"`
              }
              actionLabel="Nouveau reçu"
              onAction={() => navigation.navigate('NouveauRecu')}
            />
          ) : null
        }
      />

      {/* Bouton flottant */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NouveauRecu')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  filterChipActive: {
    backgroundColor: '#64191E',
    borderColor: '#64191E'
  },
  filterChipText: {
    fontSize: 13,
    color: '#666'
  },
  filterChipTextActive: {
    color: '#fff'
  },
  listContent: {
    padding: 16,
    paddingBottom: 100
  },
  receiptCard: {
    marginBottom: 12
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  receiptInfo: {
    flex: 1
  },
  receiptNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  receiptDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  receiptContent: {
    flexDirection: 'row',
    gap: 12
  },
  receiptThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0'
  },
  receiptDetails: {
    flex: 1,
    justifyContent: 'center'
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    width: 80
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    flex: 1
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64191E'
  },
  rejectionBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4
  },
  rejectionText: {
    fontSize: 13,
    color: '#991B1B'
  },
  projectBadge: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  projectText: {
    fontSize: 12,
    color: '#2563EB'
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
    elevation: 8
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    marginTop: -2
  },
  tapHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  tapHintText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center'
  }
})
