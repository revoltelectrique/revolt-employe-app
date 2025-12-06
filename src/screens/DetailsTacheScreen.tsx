import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Linking,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Task, TaskStatus, TaskPriority, TaskSubtask, TaskComment, TaskAttachment } from '../types'

const statusLabels: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  a_faire: { label: 'À faire', bg: '#F3F4F6', text: '#374151' },
  en_cours: { label: 'En cours', bg: '#DBEAFE', text: '#1D4ED8' },
  termine: { label: 'Terminé', bg: '#D1FAE5', text: '#059669' },
  bloque: { label: 'Bloqué', bg: '#FEE2E2', text: '#DC2626' },
  annule: { label: 'Annulé', bg: '#F3F4F6', text: '#6B7280' },
}

const priorityLabels: Record<TaskPriority, { label: string; color: string }> = {
  basse: { label: 'Basse', color: '#9CA3AF' },
  normale: { label: 'Normale', color: '#3B82F6' },
  haute: { label: 'Haute', color: '#F97316' },
  urgente: { label: 'Urgente', color: '#DC2626' },
}

const statusOptions: TaskStatus[] = ['a_faire', 'en_cours', 'bloque', 'termine', 'annule']

export default function DetailsTacheScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { user } = useAuth()
  const { taskId } = route.params

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchTask = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:users!created_by(id, email, first_name, last_name),
          assignee:users!assigned_to(id, email, first_name, last_name),
          linked_requisition:material_requests!linked_requisition_id(id, request_number, client_name),
          subtasks:task_subtasks(id, title, is_completed, completed_at, position),
          comments:task_comments(
            id, content, created_at,
            author:users!author_id(id, email, first_name, last_name)
          ),
          attachments:task_attachments(id, file_name, file_url, file_type)
        `)
        .eq('id', taskId)
        .single()

      if (error) throw error

      // Trier les sous-tâches par position
      if (data.subtasks) {
        data.subtasks.sort((a: any, b: any) => a.position - b.position)
      }
      // Trier les commentaires par date
      if (data.comments) {
        data.comments.sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }

      setTask(data)
    } catch (error) {
      console.error('Erreur fetch tâche:', error)
      Alert.alert('Erreur', 'Impossible de charger la tâche')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchTask()
    }, [taskId])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchTask()
  }

  const getUserName = (user?: { first_name?: string; last_name?: string; email?: string }) => {
    if (!user) return 'Inconnu'
    if (user.first_name) return `${user.first_name} ${user.last_name || ''}`.trim()
    return user.email?.split('@')[0] || 'Inconnu'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-CA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const canEdit = task && user && (
    task.created_by === user.id ||
    task.assigned_to === user.id
  )

  const updateStatus = async (newStatus: TaskStatus) => {
    if (!task || !canEdit) return
    setShowStatusPicker(false)

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)

      if (error) throw error

      setTask({ ...task, status: newStatus })

      // Ajouter à l'historique
      await supabase.from('task_history').insert({
        task_id: task.id,
        user_id: user?.id,
        action: 'status_changed',
        old_value: task.status,
        new_value: newStatus,
      })
    } catch (error) {
      console.error('Erreur update status:', error)
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut')
    }
  }

  const toggleSubtask = async (subtask: TaskSubtask) => {
    if (!task || !canEdit) return

    const newCompleted = !subtask.is_completed

    try {
      const { error } = await supabase
        .from('task_subtasks')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? user?.id : null,
        })
        .eq('id', subtask.id)

      if (error) throw error

      setTask({
        ...task,
        subtasks: task.subtasks?.map(s =>
          s.id === subtask.id ? { ...s, is_completed: newCompleted } : s
        ),
      })
    } catch (error) {
      console.error('Erreur toggle subtask:', error)
    }
  }

  const addComment = async () => {
    if (!newComment.trim() || !task || !user?.id) return
    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select(`
          id, content, created_at,
          author:users!author_id(id, email, first_name, last_name)
        `)
        .single()

      if (error) throw error

      setTask({
        ...task,
        comments: [...(task.comments || []), data],
      })
      setNewComment('')
    } catch (error) {
      console.error('Erreur add comment:', error)
      Alert.alert('Erreur', 'Impossible d\'ajouter le commentaire')
    } finally {
      setSubmitting(false)
    }
  }

  const showAttachmentOptions = () => {
    Alert.alert(
      'Ajouter une pièce jointe',
      'Choisissez une option',
      [
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir une image', onPress: pickImage },
        { text: 'Choisir un fichier', onPress: pickDocument },
        { text: 'Annuler', style: 'cancel' },
      ]
    )
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la caméra requis')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      await uploadFile(result.assets[0].uri, 'image')
    }
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie requis')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      await uploadFile(result.assets[0].uri, 'image')
    }
  }

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const fileType = asset.mimeType?.startsWith('image/') ? 'image' : 'pdf'
      await uploadFile(asset.uri, fileType, asset.name)
    }
  }

  const uploadFile = async (uri: string, fileType: string, originalName?: string) => {
    if (!task || !user?.id) return
    setUploading(true)

    try {
      const ext = fileType === 'image' ? 'jpg' : 'pdf'
      const uniqueName = `task_${task.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      const filePath = `tasks/${uniqueName}`

      // Lire le fichier comme ArrayBuffer (compatible React Native)
      const response = await fetch(uri)
      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, uint8Array, {
          contentType: fileType === 'image' ? 'image/jpeg' : 'application/pdf',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath)

      const { data: attachmentData, error: insertError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: task.id,
          uploaded_by: user.id,
          file_name: originalName || uniqueName,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_size: uint8Array.length,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setTask({
        ...task,
        attachments: [...(task.attachments || []), attachmentData],
      })

      Alert.alert('Succès', 'Pièce jointe ajoutée')
    } catch (error: any) {
      console.error('Erreur upload:', error)
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la pièce jointe')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  if (!task) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Tâche introuvable</Text>
      </View>
    )
  }

  const status = statusLabels[task.status]
  const priority = priorityLabels[task.priority]
  const subtaskProgress = task.subtasks && task.subtasks.length > 0
    ? {
        completed: task.subtasks.filter(s => s.is_completed).length,
        total: task.subtasks.length,
      }
    : null

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#64191E']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.taskNumber}>{task.task_number}</Text>
          <Text style={styles.taskTitle}>{task.title}</Text>

          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: status.bg }]}
              onPress={() => canEdit && setShowStatusPicker(true)}
              disabled={!canEdit}
            >
              <Text style={[styles.badgeText, { color: status.text }]}>
                {status.label} {canEdit ? '▼' : ''}
              </Text>
            </TouchableOpacity>
            <View style={[styles.badge, { backgroundColor: priority.color + '20' }]}>
              <Text style={[styles.badgeText, { color: priority.color }]}>
                {priority.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Picker Modal */}
        {showStatusPicker && (
          <View style={styles.statusPicker}>
            {statusOptions.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusOption,
                  task.status === s && styles.statusOptionActive,
                ]}
                onPress={() => updateStatus(s)}
              >
                <Text style={[
                  styles.statusOptionText,
                  task.status === s && styles.statusOptionTextActive,
                ]}>
                  {statusLabels[s].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{task.description}</Text>
          </View>
        )}

        {/* Infos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Créée par</Text>
              <Text style={styles.infoValue}>{getUserName(task.creator)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Assignée à</Text>
              <Text style={styles.infoValue}>
                {task.assignee ? getUserName(task.assignee) : 'Non assignée'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Créée le</Text>
              <Text style={styles.infoValue}>{formatDate(task.created_at)}</Text>
            </View>
            {task.completed_at && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Terminée le</Text>
                <Text style={styles.infoValue}>{formatDate(task.completed_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lien réquisition */}
        {task.linked_requisition && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Réquisition liée</Text>
            <TouchableOpacity
              style={styles.linkedItem}
              onPress={() => navigation.navigate('DetailsRequisition', {
                requisitionId: task.linked_requisition?.id
              })}
            >
              <Text style={styles.linkedNumber}>
                {task.linked_requisition.request_number}
              </Text>
              <Text style={styles.linkedName}>
                {task.linked_requisition.client_name}
              </Text>
              <Text style={styles.linkedArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sous-tâches */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Sous-tâches ({subtaskProgress?.completed}/{subtaskProgress?.total})
              </Text>
            </View>

            {subtaskProgress && (
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(subtaskProgress.completed / subtaskProgress.total) * 100}%` },
                  ]}
                />
              </View>
            )}

            {task.subtasks.map((subtask) => (
              <TouchableOpacity
                key={subtask.id}
                style={styles.subtaskItem}
                onPress={() => toggleSubtask(subtask)}
                disabled={!canEdit}
              >
                <View style={[
                  styles.checkbox,
                  subtask.is_completed && styles.checkboxChecked,
                ]}>
                  {subtask.is_completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[
                  styles.subtaskTitle,
                  subtask.is_completed && styles.subtaskCompleted,
                ]}>
                  {subtask.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pièces jointes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Pièces jointes ({task.attachments?.length || 0})
            </Text>
            {canEdit && (
              <TouchableOpacity
                style={styles.addAttachmentButton}
                onPress={showAttachmentOptions}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#64191E" />
                ) : (
                  <Text style={styles.addAttachmentText}>+ Ajouter</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {task.attachments && task.attachments.length > 0 ? (
            <View style={styles.attachmentsGrid}>
              {task.attachments.map((attachment) => (
                <TouchableOpacity
                  key={attachment.id}
                  style={styles.attachmentItem}
                  onPress={() => Linking.openURL(attachment.file_url)}
                >
                  {attachment.file_type === 'image' ? (
                    <Image
                      source={{ uri: attachment.file_url }}
                      style={styles.attachmentImage}
                    />
                  ) : (
                    <View style={styles.attachmentIcon}>
                      <Text style={styles.attachmentIconText}>📄</Text>
                    </View>
                  )}
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.file_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Aucune pièce jointe</Text>
          )}
        </View>

        {/* Commentaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Commentaires ({task.comments?.length || 0})
          </Text>

          {task.comments && task.comments.length > 0 ? (
            task.comments.map((comment: TaskComment) => (
              <View key={comment.id} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>
                    {getUserName(comment.author)}
                  </Text>
                  <Text style={styles.commentDate}>
                    {formatDate(comment.created_at)}
                  </Text>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aucun commentaire</Text>
          )}

          {/* Nouveau commentaire */}
          <View style={styles.newComment}>
            <TextInput
              style={styles.commentInput}
              placeholder="Écrire un commentaire..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newComment.trim() || submitting) && styles.sendButtonDisabled,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submitting}
            >
              <Text style={styles.sendButtonText}>
                {submitting ? '...' : 'Envoyer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  },
  errorText: {
    color: '#666',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  taskNumber: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
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
  statusPicker: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  statusOptionActive: {
    backgroundColor: '#64191E',
  },
  statusOptionText: {
    fontSize: 13,
    color: '#666',
  },
  statusOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
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
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  linkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    padding: 12,
    borderRadius: 8,
  },
  linkedNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    marginRight: 8,
  },
  linkedName: {
    flex: 1,
    fontSize: 14,
    color: '#6B21A8',
  },
  linkedArrow: {
    fontSize: 16,
    color: '#7C3AED',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  subtaskCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  addAttachmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
  },
  addAttachmentText: {
    fontSize: 13,
    color: '#64191E',
    fontWeight: '600',
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attachmentItem: {
    width: 100,
    alignItems: 'center',
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  attachmentIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentIconText: {
    fontSize: 32,
  },
  attachmentName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  commentItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentContent: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  newComment: {
    marginTop: 16,
  },
  commentInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  sendButton: {
    backgroundColor: '#64191E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})
