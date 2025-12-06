import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { MaterialRequest } from '../types'
import { Button, Card, Badge, ConfirmDialog, CommentsSection } from '../components'

interface LinkedPO {
  id: string
  po_number: string
}

export default function DetailsRequisitionScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { requestId } = route.params

  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<MaterialRequest | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [linkedPO, setLinkedPO] = useState<LinkedPO | null>(null)

  useEffect(() => {
    fetchRequest()
    fetchUserRole()
    fetchLinkedPO()
  }, [requestId])

  const fetchLinkedPO = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number')
      .eq('material_request_id', requestId)
      .single()

    if (data) {
      setLinkedPO(data)
    }
  }

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(data?.role || '')
    }
  }

  const canEdit = ['admin', 'contremaitre', 'contremaître'].includes(userRole)

  const fetchRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('material_requests')
        .select(`
          *,
          requester:users!requester_id(email, first_name, last_name),
          items:material_request_items(*)
        `)
        .eq('id', requestId)
        .single()

      if (error) throw error

      // Générer les URLs publiques pour les pièces jointes
      if (data.items) {
        data.items = data.items.map((item: any) => {
          if (item.attachment_url && !item.attachment_url.startsWith('http')) {
            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(item.attachment_url)
            return { ...item, attachment_url: urlData.publicUrl }
          }
          return item
        })
      }

      setRequest(data)
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de charger la réquisition')
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!request) return

    setUpdating(true)
    const newStatus = request.status === 'en_attente' ? 'traite' : 'en_attente'

    try {
      const { error } = await supabase
        .from('material_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', request.id)

      if (error) throw error

      setRequest({ ...request, status: newStatus })
      setShowConfirm(false)
      Alert.alert('Succès', `Statut changé à "${newStatus === 'traite' ? 'Traité' : 'En attente'}"`)
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de changer le statut')
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRequesterName = () => {
    if (request?.requester?.first_name) {
      return `${request.requester.first_name} ${request.requester.last_name || ''}`
    }
    return request?.requester?.email || '-'
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    )
  }

  if (!request) return null

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.reqNumber}>{request.request_number}</Text>
          <Badge
            label={request.status === 'en_attente' ? 'En attente' : 'Traité'}
            variant={request.status === 'en_attente' ? 'pending' : 'success'}
          />
        </View>
        <Text style={styles.date}>Créé le {formatDate(request.created_at)}</Text>
      </Card>

      {/* Informations */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{request.client_name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Demandeur</Text>
          <Text style={styles.value}>{getRequesterName()}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>N° Servicentre</Text>
          <Text style={styles.value}>{request.servicentre_call_number}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Lieu de livraison</Text>
          <Text style={[styles.value, styles.valueWrap]}>{request.delivery_location}</Text>
        </View>

        {request.special_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.label}>Notes spéciales</Text>
            <Text style={styles.notes}>{request.special_notes}</Text>
          </View>
        )}

        {linkedPO && (
          <TouchableOpacity
            style={styles.linkedCard}
            onPress={() => (navigation as any).navigate('DetailsBC', { orderId: linkedPO.id })}
          >
            <Text style={styles.linkedLabel}>Bon de commande associé</Text>
            <View style={styles.linkedRow}>
              <Text style={styles.linkedIcon}>📄</Text>
              <Text style={styles.linkedNumber}>{linkedPO.po_number}</Text>
              <Text style={styles.linkedArrow}>→</Text>
            </View>
          </TouchableOpacity>
        )}
      </Card>

      {/* Items */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>
          Matériel demandé ({request.items?.length || 0})
        </Text>

        {request.items?.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIndex}>#{index + 1}</Text>
              <Text style={styles.itemQty}>Qté: {item.quantity}</Text>
            </View>
            <Text style={styles.itemDescription}>{item.description}</Text>
            {item.attachment_url && (
              <View style={styles.attachmentContainer}>
                <Image
                  source={{ uri: item.attachment_url }}
                  style={styles.attachment}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>
        ))}
      </Card>

      {/* Commentaires */}
      {currentUserId && (
        <CommentsSection
          documentType="material_request"
          documentId={request.id}
          currentUserId={currentUserId}
        />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {request.status === 'en_attente' && (
          <Button
            title="Générer un bon de commande"
            onPress={() => {
              (navigation as any).navigate('NouveauBC', {
                fromRequisition: {
                  id: request.id,
                  clientName: request.client_name,
                  servicentreNumber: request.servicentre_call_number,
                  items: request.items,
                }
              })
            }}
            variant="primary"
            style={{ marginBottom: 12 }}
          />
        )}
        {canEdit && (
          <Button
            title="Modifier la réquisition"
            onPress={() => {
              (navigation as any).navigate('ModifierRequisition', {
                requestId: request.id,
              })
            }}
            variant="outline"
            style={{ marginBottom: 12 }}
          />
        )}
        <Button
          title={request.status === 'en_attente' ? 'Marquer comme traité' : 'Réouvrir'}
          onPress={() => setShowConfirm(true)}
          variant={request.status === 'en_attente' ? 'outline' : 'outline'}
        />
      </View>

      <View style={{ height: 40 }} />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={showConfirm}
        title="Changer le statut"
        message={
          request.status === 'en_attente'
            ? 'Voulez-vous marquer cette réquisition comme traitée?'
            : 'Voulez-vous réouvrir cette réquisition?'
        }
        confirmLabel={request.status === 'en_attente' ? 'Traiter' : 'Réouvrir'}
        onConfirm={handleToggleStatus}
        onCancel={() => setShowConfirm(false)}
        loading={updating}
      />
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
  },
  headerCard: {
    margin: 16,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reqNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    margin: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  valueWrap: {
    flexWrap: 'wrap',
  },
  notesSection: {
    paddingTop: 12,
  },
  notes: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  itemDescription: {
    fontSize: 14,
    color: '#333',
  },
  attachmentContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachment: {
    width: '100%',
    height: 150,
    backgroundColor: '#e0e0e0',
  },
  actions: {
    padding: 16,
  },
  linkedCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  linkedLabel: {
    fontSize: 12,
    color: '#6366F1',
    marginBottom: 8,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedIcon: {
    fontSize: 18,
  },
  linkedNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338CA',
    flex: 1,
  },
  linkedArrow: {
    fontSize: 18,
    color: '#6366F1',
  },
})
