import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ScannedQRContent, InventoryItem, Kit } from '../types'

type ScannedItemType = 'inventory' | 'kit' | 'unknown'

interface ScannedResult {
  type: ScannedItemType
  data: InventoryItem | Kit | null
  raw: string
  error?: string
}

export default function ScanQRScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScannedResult | null>(null)
  const [showResult, setShowResult] = useState(false)

  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutDestination, setCheckoutDestination] = useState('')
  const [checkoutNotes, setCheckoutNotes] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const parseQRCode = (data: string): ScannedQRContent | null => {
    try {
      const parsed = JSON.parse(data)
      if (parsed.t && parsed.id && parsed.q) {
        return parsed as ScannedQRContent
      }
      return null
    } catch {
      return null
    }
  }

  const fetchInventoryItem = async (id: string): Promise<InventoryItem | null> => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          product:products(sku, name),
          purchase_order:purchase_orders(id, po_number)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erreur fetch item:', error)
      return null
    }
  }

  const fetchKit = async (id: string): Promise<Kit | null> => {
    try {
      const { data, error } = await supabase
        .from('kits')
        .select(`
          *,
          items:kit_items(
            id,
            quantity,
            inventory_item:inventory_items(id, qr_code, description, quantity, unit, status)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erreur fetch kit:', error)
      return null
    }
  }

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    console.log('=== BARCODE DETECTED ===', result)
    const data = result.data

    if (scanned || loading) {
      console.log('Already scanned or loading, ignoring')
      return
    }

    setScanned(true)
    setLoading(true)

    const qrContent = parseQRCode(data)

    if (!qrContent) {
      setResult({
        type: 'unknown',
        data: null,
        raw: data,
        error: 'Format QR non reconnu. Attendu: format inventaire ReVolt.',
      })
      setShowResult(true)
      setLoading(false)
      return
    }

    if (qrContent.t === 'inv') {
      const item = await fetchInventoryItem(qrContent.id)
      if (item) {
        setResult({ type: 'inventory', data: item, raw: data })
      } else {
        setResult({
          type: 'inventory',
          data: null,
          raw: data,
          error: 'Item non trouve dans la base de donnees.',
        })
      }
    } else if (qrContent.t === 'kit') {
      const kit = await fetchKit(qrContent.id)
      if (kit) {
        setResult({ type: 'kit', data: kit, raw: data })
      } else {
        setResult({
          type: 'kit',
          data: null,
          raw: data,
          error: 'Kit non trouve dans la base de donnees.',
        })
      }
    } else {
      setResult({
        type: 'unknown',
        data: null,
        raw: data,
        error: 'Type QR non supporte.',
      })
    }

    setShowResult(true)
    setLoading(false)
  }

  const resetScanner = () => {
    setScanned(false)
    setResult(null)
    setShowResult(false)
    setCheckoutDestination('')
    setCheckoutNotes('')
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount)
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      en_stock: { label: 'En stock', color: '#059669' },
      reserve: { label: 'Reserve', color: '#D97706' },
      en_transit: { label: 'En transit', color: '#2563EB' },
      sur_chantier: { label: 'Sur chantier', color: '#7C3AED' },
      utilise: { label: 'Utilise', color: '#6B7280' },
      retourne: { label: 'Retourne', color: '#10B981' },
      perdu: { label: 'Perdu', color: '#DC2626' },
      defectueux: { label: 'Defectueux', color: '#DC2626' },
      // Kit status
      brouillon: { label: 'Brouillon', color: '#9CA3AF' },
      pret: { label: 'Pret', color: '#059669' },
      partiel: { label: 'Partiel', color: '#F59E0B' },
    }
    return labels[status] || { label: status, color: '#6B7280' }
  }

  // Check if item can be checked out
  const canCheckout = (item: InventoryItem) => {
    return item.status === 'en_stock' && user
  }

  // Handle checkout action
  const handleCheckout = async () => {
    if (!result?.data || result.type !== 'inventory' || !user) return

    const item = result.data as InventoryItem

    setCheckoutLoading(true)
    try {
      // Update item status and checkout fields
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          status: 'sur_chantier',
          checked_out_at: new Date().toISOString(),
          checked_out_by: user.id,
          checkout_destination: checkoutDestination || null,
          checkout_notes: checkoutNotes || null,
        })
        .eq('id', item.id)

      if (updateError) throw updateError

      // Create movement record
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          inventory_item_id: item.id,
          movement_type: 'sortie',
          from_location: item.location,
          to_location: checkoutDestination || 'Chantier',
          quantity: item.quantity,
          performed_by: user.id,
          notes: checkoutNotes || `Sortie via scan QR par ${user.first_name || user.email}`,
        })

      if (movementError) throw movementError

      Alert.alert(
        'Sortie confirmee',
        `L'item ${item.qr_code} a ete mis en sortie avec succes.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowCheckoutModal(false)
              resetScanner()
            },
          },
        ]
      )
    } catch (error) {
      console.error('Erreur checkout:', error)
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sortie.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  console.log('=== ScanQRScreen RENDER ===', { permission, scanned, loading })

  if (!permission) {
    console.log('Permission is null, requesting...')
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.permissionText}>Demande d'acces a la camera...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    console.log('Permission not granted')
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Acces camera requis</Text>
        <Text style={styles.permissionText}>
          Pour scanner les QR codes, l'application a besoin d'acceder a votre camera.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Autoriser l'acces</Text>
        </TouchableOpacity>
      </View>
    )
  }

  console.log('=== Rendering CameraView ===')

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        active={true}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'aztec', 'ean13', 'ean8', 'qr', 'pdf417', 'datamatrix', 'code39', 'code128'],
          interval: 500,
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.instruction}>
          {loading ? 'Verification...' : 'Positionnez le QR code dans le cadre'}
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResult}
        animationType="slide"
        transparent={true}
        onRequestClose={resetScanner}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {result?.error ? (
              <>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Erreur</Text>
                <Text style={styles.errorText}>{result.error}</Text>
                <Text style={styles.rawData}>Donnees brutes: {result.raw}</Text>
              </>
            ) : result?.type === 'inventory' && result.data ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>📦</Text>
                  <Text style={styles.resultTitle}>Item d'inventaire</Text>
                </View>

                <View style={styles.qrCodeBadge}>
                  <Text style={styles.qrCodeText}>{(result.data as InventoryItem).qr_code}</Text>
                </View>

                <Text style={styles.itemDescription} numberOfLines={3}>
                  {(result.data as InventoryItem).description}
                </Text>

                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Quantite</Text>
                    <Text style={styles.infoValue}>
                      {(result.data as InventoryItem).quantity} {(result.data as InventoryItem).unit}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Localisation</Text>
                    <Text style={styles.infoValue}>{(result.data as InventoryItem).location}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusLabel((result.data as InventoryItem).status).color + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusLabel((result.data as InventoryItem).status).color },
                        ]}
                      >
                        {getStatusLabel((result.data as InventoryItem).status).label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Cout unitaire</Text>
                    <Text style={styles.infoValue}>
                      {formatCurrency((result.data as InventoryItem).unit_cost)}
                    </Text>
                  </View>
                </View>

                {(result.data as InventoryItem).client_name && (
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientLabel}>Client</Text>
                    <Text style={styles.clientValue}>{(result.data as InventoryItem).client_name}</Text>
                  </View>
                )}

                {(result.data as InventoryItem).purchase_order && (
                  <View style={styles.poInfo}>
                    <Text style={styles.poLabel}>P.O.</Text>
                    <Text style={styles.poValue}>
                      {(result.data as InventoryItem).purchase_order?.po_number}
                    </Text>
                  </View>
                )}

                {/* Checkout info if already checked out */}
                {(result.data as InventoryItem).status === 'sur_chantier' && (result.data as InventoryItem).checked_out_at && (
                  <View style={styles.checkoutInfo}>
                    <Text style={styles.checkoutInfoTitle}>⚡ Deja en sortie</Text>
                    {(result.data as InventoryItem).checkout_destination && (
                      <Text style={styles.checkoutInfoText}>
                        Destination: {(result.data as InventoryItem).checkout_destination}
                      </Text>
                    )}
                    <Text style={styles.checkoutInfoText}>
                      Depuis: {new Date((result.data as InventoryItem).checked_out_at!).toLocaleDateString('fr-CA')}
                    </Text>
                  </View>
                )}

                {/* Checkout button if item is in stock */}
                {canCheckout(result.data as InventoryItem) && (
                  <TouchableOpacity
                    style={styles.checkoutButton}
                    onPress={() => setShowCheckoutModal(true)}
                  >
                    <Text style={styles.checkoutButtonIcon}>📤</Text>
                    <Text style={styles.checkoutButtonText}>Sortie materiel</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : result?.type === 'kit' && result.data ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultIcon}>🧰</Text>
                  <Text style={styles.resultTitle}>Kit</Text>
                </View>

                <View style={styles.qrCodeBadge}>
                  <Text style={styles.qrCodeText}>{(result.data as Kit).qr_code}</Text>
                </View>

                <Text style={styles.itemDescription}>{(result.data as Kit).name}</Text>

                {(result.data as Kit).description && (
                  <Text style={styles.kitDescription}>{(result.data as Kit).description}</Text>
                )}

                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Localisation</Text>
                    <Text style={styles.infoValue}>{(result.data as Kit).location}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusLabel((result.data as Kit).status).color + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusLabel((result.data as Kit).status).color },
                        ]}
                      >
                        {getStatusLabel((result.data as Kit).status).label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Items</Text>
                    <Text style={styles.infoValue}>{(result.data as Kit).items?.length || 0}</Text>
                  </View>
                </View>

                {(result.data as Kit).client_name && (
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientLabel}>Client</Text>
                    <Text style={styles.clientValue}>{(result.data as Kit).client_name}</Text>
                  </View>
                )}

                {(result.data as Kit).items && (result.data as Kit).items!.length > 0 && (
                  <View style={styles.kitItems}>
                    <Text style={styles.kitItemsTitle}>Contenu du kit</Text>
                    {(result.data as Kit).items!.map((ki: any, index: number) => (
                      <View key={ki.id} style={styles.kitItem}>
                        <Text style={styles.kitItemDesc} numberOfLines={1}>
                          {ki.inventory_item?.description || 'Item'}
                        </Text>
                        <Text style={styles.kitItemQty}>
                          x{ki.quantity} {ki.inventory_item?.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={resetScanner}
              >
                <Text style={styles.secondaryButtonText}>Scanner a nouveau</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={() => {
                  resetScanner()
                  navigation.goBack()
                }}
              >
                <Text style={styles.primaryButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        visible={showCheckoutModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultIcon}>📤</Text>
              <Text style={styles.resultTitle}>Sortie materiel</Text>
            </View>

            {result?.type === 'inventory' && result.data && (
              <>
                <View style={styles.checkoutItemInfo}>
                  <Text style={styles.checkoutItemQr}>{(result.data as InventoryItem).qr_code}</Text>
                  <Text style={styles.checkoutItemDesc} numberOfLines={2}>
                    {(result.data as InventoryItem).description}
                  </Text>
                  <Text style={styles.checkoutItemQty}>
                    {(result.data as InventoryItem).quantity} {(result.data as InventoryItem).unit}
                  </Text>
                </View>

                <View style={styles.checkoutUserInfo}>
                  <Text style={styles.checkoutUserLabel}>Responsable</Text>
                  <Text style={styles.checkoutUserValue}>
                    {user?.first_name} {user?.last_name || user?.email}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Destination (optionnel)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={checkoutDestination}
                    onChangeText={setCheckoutDestination}
                    placeholder="Ex: Chantier ABC, Client XYZ..."
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes (optionnel)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={checkoutNotes}
                    onChangeText={setCheckoutNotes}
                    placeholder="Notes supplementaires..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={() => setShowCheckoutModal(false)}
                disabled={checkoutLoading}
              >
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.checkoutConfirmButton]}
                onPress={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirmer sortie</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#D97706',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  qrCodeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  qrCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64191E',
    fontFamily: 'monospace',
  },
  itemDescription: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    lineHeight: 24,
  },
  kitDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  infoItem: {
    width: '50%',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clientInfo: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  clientLabel: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  clientValue: {
    fontSize: 15,
    color: '#78350F',
    fontWeight: '600',
  },
  poInfo: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  poLabel: {
    fontSize: 12,
    color: '#1E40AF',
    marginBottom: 2,
  },
  poValue: {
    fontSize: 15,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  checkoutInfo: {
    backgroundColor: '#F3E8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  checkoutInfoTitle: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: 4,
  },
  checkoutInfoText: {
    fontSize: 13,
    color: '#6B21A8',
  },
  checkoutButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  checkoutButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  kitItems: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 16,
    marginTop: 8,
  },
  kitItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  kitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  kitItemDesc: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  kitItemQty: {
    fontSize: 13,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#D97706',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutConfirmButton: {
    backgroundColor: '#7C3AED',
  },
  errorIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  rawData: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  // Checkout modal styles
  checkoutItemInfo: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  checkoutItemQr: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64191E',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  checkoutItemDesc: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  checkoutItemQty: {
    fontSize: 13,
    color: '#666',
  },
  checkoutUserInfo: {
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  checkoutUserLabel: {
    fontSize: 12,
    color: '#166534',
    marginBottom: 2,
  },
  checkoutUserValue: {
    fontSize: 15,
    color: '#14532D',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
})
