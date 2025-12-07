import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { Receipt, ReceiptStatus, PaymentMethod } from '../types'
import { Card, Badge, Button } from '../components'

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

const paymentLabels: Record<PaymentMethod, string> = {
  carte_credit: 'Carte crédit',
  carte_debit: 'Carte débit',
  cash: 'Cash'
}

export default function DetailsRecuScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { receiptId } = route.params

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageFullscreen, setImageFullscreen] = useState(false)

  useEffect(() => {
    loadReceipt()
  }, [receiptId])

  const loadReceipt = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          category:receipt_categories(id, name)
        `)
        .eq('id', receiptId)
        .single()

      if (error) throw error
      setReceipt(data)
    } catch (error) {
      console.error('Erreur chargement reçu:', error)
      Alert.alert('Erreur', 'Impossible de charger le reçu')
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'long',
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  if (!receipt) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Reçu introuvable</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* En-tête avec statut */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.receiptNumber}>{receipt.receipt_number}</Text>
              <Text style={styles.submissionDate}>
                Soumis le {formatDate(receipt.submission_date)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[receipt.status].bg }]}>
              <Text style={[styles.statusText, { color: statusColors[receipt.status].text }]}>
                {statusLabels[receipt.status]}
              </Text>
            </View>
          </View>

          {receipt.status === 'approuve' && receipt.reviewed_at && (
            <Text style={styles.reviewedDate}>
              Approuvé le {formatDate(receipt.reviewed_at)}
            </Text>
          )}

          {receipt.status === 'refuse' && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Raison du refus:</Text>
              <Text style={styles.rejectionText}>{receipt.rejection_reason}</Text>
            </View>
          )}
        </Card>

        {/* Image du reçu */}
        <Card style={styles.imageCard}>
          <Text style={styles.sectionTitle}>Image du reçu</Text>
          <TouchableOpacity onPress={() => setImageFullscreen(true)}>
            <Image
              source={{ uri: receipt.image_url }}
              style={styles.receiptImage}
              resizeMode="contain"
            />
            <Text style={styles.tapToEnlarge}>Appuyez pour agrandir</Text>
          </TouchableOpacity>
        </Card>

        {/* Informations */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fournisseur</Text>
            <Text style={styles.infoValue}>{receipt.vendor_name || '-'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date du reçu</Text>
            <Text style={styles.infoValue}>{formatDate(receipt.receipt_date)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Référence</Text>
            <Text style={styles.infoValue}>{receipt.receipt_reference || '-'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Catégorie</Text>
            <Text style={styles.infoValue}>{receipt.category?.name || '-'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Méthode de paiement</Text>
            <Text style={styles.infoValue}>{paymentLabels[receipt.payment_method]}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Projet/Chantier</Text>
            <Text style={styles.infoValue}>{receipt.project_name || '-'}</Text>
          </View>

          {receipt.is_manually_entered && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualText}>Saisie manuelle</Text>
            </View>
          )}

          {!receipt.is_manually_entered && receipt.ocr_confidence && (
            <View style={styles.ocrBadge}>
              <Text style={styles.ocrText}>OCR: {receipt.ocr_confidence}% confiance</Text>
            </View>
          )}
        </Card>

        {/* Montants */}
        <Card style={styles.amountsCard}>
          <Text style={styles.sectionTitle}>Montants</Text>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Sous-total</Text>
            <Text style={styles.amountValue}>{formatCurrency(receipt.subtotal)}</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Taxes</Text>
            <Text style={styles.amountValue}>{formatCurrency(receipt.tax_amount)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.amountRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(receipt.total_amount)}</Text>
          </View>
        </Card>

        {/* Notes */}
        {receipt.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{receipt.notes}</Text>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </View>

      {/* Modal plein écran pour l'image */}
      {imageFullscreen && (
        <TouchableOpacity
          style={styles.fullscreenOverlay}
          activeOpacity={1}
          onPress={() => setImageFullscreen(false)}
        >
          <Image
            source={{ uri: receipt.image_url }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          <Text style={styles.closeHint}>Appuyez pour fermer</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const { width, height } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 12,
    color: '#666'
  },
  headerCard: {
    marginBottom: 16
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  receiptNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  submissionDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  reviewedDate: {
    fontSize: 12,
    color: '#059669',
    marginTop: 12
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
    fontSize: 14,
    color: '#991B1B'
  },
  imageCard: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0'
  },
  tapToEnlarge: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 8
  },
  infoCard: {
    marginBottom: 16
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  infoLabel: {
    fontSize: 14,
    color: '#666'
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16
  },
  manualBadge: {
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  manualText: {
    fontSize: 12,
    color: '#666'
  },
  ocrBadge: {
    marginTop: 12,
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  ocrText: {
    fontSize: 12,
    color: '#2563EB'
  },
  amountsCard: {
    marginBottom: 16
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  amountLabel: {
    fontSize: 14,
    color: '#666'
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#64191E'
  },
  notesCard: {
    marginBottom: 16
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  fullscreenImage: {
    width: width,
    height: height * 0.8
  },
  closeHint: {
    position: 'absolute',
    bottom: 50,
    color: '#fff',
    fontSize: 14
  }
})
