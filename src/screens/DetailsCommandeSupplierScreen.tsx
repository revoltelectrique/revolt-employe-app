import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { SupplierOrder, SupplierOrderItem, SupplierOrderStatus } from '../types'

const statusLabels: Record<SupplierOrderStatus, { label: string; bg: string; text: string }> = {
  en_attente: { label: 'En attente', bg: '#FEF3C7', text: '#D97706' },
  partiel: { label: 'Partiel', bg: '#FED7AA', text: '#EA580C' },
  recu: { label: 'Recu', bg: '#D1FAE5', text: '#059669' },
  annule: { label: 'Annule', bg: '#F3F4F6', text: '#6B7280' },
}

type SupplierOrderFull = SupplierOrder & {
  supplier?: { display_name: string; name: string } | null
  purchase_order?: { po_number: string; client_name?: string } | null
  items?: SupplierOrderItem[]
  carrier?: string | null
  tracking_number?: string | null
  shipped_at?: string | null
  total_amount?: number | null
}

export default function DetailsCommandeSupplierScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { orderId } = route.params

  const [order, setOrder] = useState<SupplierOrderFull | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select(`
          *,
          supplier:suppliers(display_name, name),
          purchase_order:purchase_orders(po_number, client_name),
          items:supplier_order_items(*)
        `)
        .eq('id', orderId)
        .single()

      if (error) throw error
      setOrder(data)
    } catch (error) {
      console.error('Erreur fetch commande:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount)
  }

  const getTrackingUrl = (carrier: string | null, trackingNumber: string | null): string | null => {
    if (!trackingNumber || !carrier) return null
    const carrierLower = carrier.toLowerCase()
    if (carrierLower.includes('dicom')) {
      return `https://www.dicom.com/fr/suivi?tracking=${trackingNumber}`
    }
    if (carrierLower.includes('purolator')) {
      return `https://www.purolator.com/fr/suivi?pin=${trackingNumber}`
    }
    if (carrierLower.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
    }
    if (carrierLower.includes('ups')) {
      return `https://www.ups.com/track?tracknum=${trackingNumber}`
    }
    if (carrierLower.includes('canada post') || carrierLower.includes('postes canada')) {
      return `https://www.canadapost-postescanada.ca/track-reperage/fr#/search?searchFor=${trackingNumber}`
    }
    return null
  }

  const openTracking = () => {
    const url = getTrackingUrl(order?.carrier || null, order?.tracking_number || null)
    if (url) {
      Linking.openURL(url)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyIcon}>❌</Text>
        <Text style={styles.emptyText}>Commande non trouvee</Text>
      </View>
    )
  }

  const status = statusLabels[order.status] || statusLabels.en_attente
  const trackingUrl = getTrackingUrl(order.carrier || null, order.tracking_number || null)

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.supplierName}>{order.supplier?.display_name || 'Fournisseur'}</Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.poNumber}>
          {order.purchase_order?.po_number || order.po_reference || 'Sans P.O.'}
        </Text>
        {order.supplier_order_number && (
          <Text style={styles.orderNumber}>Commande #{order.supplier_order_number}</Text>
        )}
      </View>

      {/* Infos Client */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations client</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Client</Text>
            <Text style={styles.infoValue}>{order.client_name || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>N d'appel</Text>
            <Text style={styles.infoValue}>{order.servicentre_call_number || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Infos Commande */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details commande</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Livraison prevue</Text>
            <Text style={styles.infoValue}>{formatDate(order.expected_delivery_date)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Lieu</Text>
            <Text style={styles.infoValue}>{order.delivery_location || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Total</Text>
            <Text style={[styles.infoValue, styles.totalValue]}>
              {formatCurrency(order.total_amount || null)}
            </Text>
          </View>
        </View>
      </View>

      {/* Tracking */}
      {(order.carrier || order.tracking_number) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expedition</Text>
          <View style={styles.trackingCard}>
            {order.carrier && (
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>Transporteur</Text>
                <Text style={styles.trackingValue}>{order.carrier}</Text>
              </View>
            )}
            {order.tracking_number && (
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>Suivi</Text>
                {trackingUrl ? (
                  <TouchableOpacity onPress={openTracking}>
                    <Text style={[styles.trackingValue, styles.trackingLink]}>
                      {order.tracking_number} ↗
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.trackingValue}>{order.tracking_number}</Text>
                )}
              </View>
            )}
            {order.shipped_at && (
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>Expedie le</Text>
                <Text style={styles.trackingValue}>{formatDate(order.shipped_at)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({order.items?.length || 0})</Text>
        {order.items && order.items.length > 0 ? (
          order.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              {item.supplier_sku && (
                <Text style={styles.itemSku}>SKU: {item.supplier_sku}</Text>
              )}
              <View style={styles.itemFooter}>
                <Text style={styles.itemQty}>
                  {item.quantity_received}/{item.quantity_ordered} {item.unit}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.unit_price ? item.unit_price * item.quantity_ordered : null)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyItems}>
            <Text style={styles.emptyItemsText}>Aucun item</Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  headerCard: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  poNumber: {
    fontSize: 16,
    color: '#64191E',
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 16,
    color: '#64191E',
    fontWeight: '700',
  },
  trackingCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trackingLabel: {
    fontSize: 13,
    color: '#666',
  },
  trackingValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  trackingLink: {
    color: '#2563EB',
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
  },
  itemHeader: {
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQty: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  emptyItems: {
    padding: 20,
    alignItems: 'center',
  },
  emptyItemsText: {
    color: '#999',
  },
})
