import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../../lib/supabase'
import { Conversation, MaterialRequest } from '../../types'

interface ConversationInfoTabProps {
  conversation: Conversation
  onUpdate: (conversation: Conversation) => void
}

export default function ConversationInfoTab({ conversation, onUpdate }: ConversationInfoTabProps) {
  const navigation = useNavigation<any>()
  const [requisitions, setRequisitions] = useState<MaterialRequest[]>([])
  const [loadingRequisitions, setLoadingRequisitions] = useState(true)

  useEffect(() => {
    fetchRequisitions()
  }, [conversation.servicentre_number])

  const fetchRequisitions = async () => {
    try {
      // Extraire les 4 chiffres du numéro Servicentre
      const match = conversation.servicentre_number.match(/\d{4}/)
      if (!match) {
        setLoadingRequisitions(false)
        return
      }

      const servicentreDigits = match[0]

      // Chercher les réquisitions avec ce numéro
      const { data, error } = await supabase
        .from('material_requests')
        .select(`
          *,
          requester:users!requester_id(email, first_name, last_name),
          items:material_request_items(*)
        `)
        .ilike('servicentre_call_number', `%${servicentreDigits}%`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequisitions(data || [])
    } catch (error) {
      console.error('Erreur fetch réquisitions:', error)
    } finally {
      setLoadingRequisitions(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getCreatorName = () => {
    if (conversation.creator?.first_name) {
      return `${conversation.creator.first_name} ${conversation.creator.last_name || ''}`
    }
    return conversation.creator?.email?.split('@')[0] || 'Inconnu'
  }

  const getRequesterName = (req: MaterialRequest) => {
    if (req.requester?.first_name) {
      return `${req.requester.first_name} ${req.requester.last_name || ''}`
    }
    return req.requester?.email?.split('@')[0] || 'Inconnu'
  }

  const handleNewRequisition = () => {
    // Naviguer vers le formulaire avec les données pré-remplies
    navigation.navigate('NouvelleRequisition', {
      prefill: {
        clientName: conversation.client_name,
        servicentreNumber: conversation.servicentre_number,
        deliveryLocation: conversation.location || '',
      }
    })
  }

  const handleViewRequisition = (requisition: MaterialRequest) => {
    navigation.navigate('DetailsRequisition', { requisitionId: requisition.id })
  }

  const statusLabels = {
    ouverte: { label: 'En cours', color: '#16A34A', bg: '#DCFCE7' },
    fermee: { label: 'Terminé', color: '#DC2626', bg: '#FEE2E2' },
    archivee: { label: 'Archivé', color: '#6B7280', bg: '#F3F4F6' },
  }

  const reqStatusLabels = {
    en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
    traite: { label: 'Traité', color: '#16A34A', bg: '#DCFCE7' },
  }

  const status = statusLabels[conversation.status]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête avec statut */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>
              {conversation.client_name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clientName}>{conversation.client_name}</Text>
            <Text style={styles.servicentreNumber}>{conversation.servicentre_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      {/* Informations générales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations générales</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Adresse</Text>
          <Text style={styles.infoValue}>
            {conversation.location || 'Non spécifiée'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📅 Date de création</Text>
          <Text style={styles.infoValue}>{formatDate(conversation.created_at)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>👤 Créé par</Text>
          <Text style={styles.infoValue}>{getCreatorName()}</Text>
        </View>

        {conversation.description && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📝 Description</Text>
            <Text style={styles.infoValue}>{conversation.description}</Text>
          </View>
        )}
      </View>

      {/* Section Réquisitions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Réquisitions</Text>
          <TouchableOpacity style={styles.newReqButton} onPress={handleNewRequisition}>
            <Text style={styles.newReqButtonText}>+ Nouvelle</Text>
          </TouchableOpacity>
        </View>

        {loadingRequisitions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#64191E" />
          </View>
        ) : requisitions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>Aucune réquisition</Text>
            <Text style={styles.emptySubtext}>
              Les réquisitions avec ce numéro Servicentre apparaîtront ici
            </Text>
          </View>
        ) : (
          <View style={styles.requisitionsList}>
            {requisitions.map((req) => {
              const reqStatus = reqStatusLabels[req.status as keyof typeof reqStatusLabels] || reqStatusLabels.en_attente
              const itemCount = req.items?.length || 0

              return (
                <TouchableOpacity
                  key={req.id}
                  style={styles.requisitionCard}
                  onPress={() => handleViewRequisition(req)}
                >
                  <View style={styles.requisitionHeader}>
                    <View style={styles.requisitionIcon}>
                      <Text style={styles.requisitionIconText}>📦</Text>
                    </View>
                    <View style={styles.requisitionInfo}>
                      <Text style={styles.requisitionNumber}>{req.request_number}</Text>
                      <Text style={styles.requisitionMeta}>
                        {getRequesterName(req)} • {formatShortDate(req.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.reqStatusBadge, { backgroundColor: reqStatus.bg }]}>
                      <Text style={[styles.reqStatusText, { color: reqStatus.color }]}>
                        {reqStatus.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requisitionDetails}>
                    <Text style={styles.requisitionItemCount}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''} demandé{itemCount !== 1 ? 's' : ''}
                    </Text>
                    {req.special_notes && (
                      <Text style={styles.requisitionNotes} numberOfLines={1}>
                        💬 {req.special_notes}
                      </Text>
                    )}
                  </View>

                  <View style={styles.requisitionFooter}>
                    <Text style={styles.viewDetails}>Voir les détails →</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>

      {/* Statistiques */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiques</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>--</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>--</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{requisitions.length}</Text>
            <Text style={styles.statLabel}>Réquisitions</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  servicentreNumber: {
    fontSize: 14,
    color: '#64191E',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 0,
  },
  newReqButton: {
    backgroundColor: '#64191E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newReqButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  requisitionsList: {
    gap: 12,
  },
  requisitionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  requisitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requisitionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requisitionIconText: {
    fontSize: 18,
  },
  requisitionInfo: {
    flex: 1,
  },
  requisitionNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  requisitionMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reqStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reqStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  requisitionDetails: {
    paddingLeft: 52,
    marginBottom: 8,
  },
  requisitionItemCount: {
    fontSize: 13,
    color: '#555',
  },
  requisitionNotes: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  requisitionFooter: {
    paddingLeft: 52,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  viewDetails: {
    fontSize: 13,
    color: '#64191E',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#64191E',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
})
