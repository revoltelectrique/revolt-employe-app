import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { TaskPriority, User } from '../types'

interface Subtask {
  id: string
  title: string
}

interface PendingAttachment {
  id: string
  uri: string
  name: string
  type: 'image' | 'pdf'
}

export default function NouvelleTacheScreen() {
  const navigation = useNavigation<any>()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<User[]>([])
  const [showEmployeePicker, setShowEmployeePicker] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [priority, setPriority] = useState<TaskPriority>('normale')
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .in('role', ['admin', 'contremaitre', 'contremaître', 'employe', 'employé'])
      .order('first_name')

    if (data) {
      setEmployees(data as User[])
    }
  }

  const getUserName = (emp: User) => {
    if (emp.first_name) {
      return `${emp.first_name} ${emp.last_name || ''}`.trim()
    }
    return emp.email.split('@')[0]
  }

  const addSubtask = () => {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim() }])
    setNewSubtask('')
  }

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id))
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
      const asset = result.assets[0]
      setAttachments([...attachments, {
        id: Date.now().toString(),
        uri: asset.uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image',
      }])
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
      const asset = result.assets[0]
      const fileName = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`
      setAttachments([...attachments, {
        id: Date.now().toString(),
        uri: asset.uri,
        name: fileName,
        type: 'image',
      }])
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
      setAttachments([...attachments, {
        id: Date.now().toString(),
        uri: asset.uri,
        name: asset.name,
        type: fileType as 'image' | 'pdf',
      }])
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id))
  }

  const uploadAttachments = async (taskId: string) => {
    for (const attachment of attachments) {
      try {
        // Générer un nom unique pour éviter les conflits
        const ext = attachment.type === 'image' ? 'jpg' : 'pdf'
        const uniqueName = `task_${taskId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `tasks/${uniqueName}`

        console.log('Uploading to:', filePath)

        // Lire le fichier comme base64
        const response = await fetch(attachment.uri)
        const arrayBuffer = await response.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, uint8Array, {
            contentType: attachment.type === 'image' ? 'image/jpeg' : 'application/pdf',
            upsert: true,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          Alert.alert('Erreur upload', uploadError.message)
          continue
        }

        console.log('Upload success:', uploadData)

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath)

        console.log('Public URL:', urlData.publicUrl)

        const { data: insertData, error: insertError } = await supabase
          .from('task_attachments')
          .insert({
            task_id: taskId,
            uploaded_by: user?.id,
            file_name: attachment.name,
            file_url: urlData.publicUrl,
            file_type: attachment.type,
            file_size: uint8Array.length,
          })
          .select()

        if (insertError) {
          console.error('Insert error:', insertError)
          Alert.alert('Erreur DB', insertError.message)
        } else {
          console.log('Insert success:', insertData)
        }
      } catch (error: any) {
        console.error('Erreur upload attachment:', error)
        Alert.alert('Erreur', error.message || 'Impossible d\'uploader la pièce jointe')
      }
    }
  }

  const generateTaskNumber = async (): Promise<string> => {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

    const { data } = await supabase
      .from('tasks')
      .select('task_number')
      .like('task_number', `TASK-${dateStr}-%`)
      .order('task_number', { ascending: false })
      .limit(1)

    let seq = 1
    if (data && data.length > 0) {
      const lastNum = data[0].task_number
      const lastSeq = parseInt(lastNum.slice(-3), 10)
      seq = lastSeq + 1
    }

    return `TASK-${dateStr}-${seq.toString().padStart(3, '0')}`
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire')
      return
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Erreur d\'authentification')
      return
    }

    setLoading(true)

    try {
      const taskNumber = await generateTaskNumber()

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          task_number: taskNumber,
          title: title.trim(),
          description: description.trim() || null,
          created_by: user.id,
          assigned_to: assignedTo || null,
          priority: priority,
          status: 'a_faire',
        })
        .select()
        .single()

      if (taskError) throw taskError

      // Ajouter les sous-tâches
      if (subtasks.length > 0) {
        const subtasksToInsert = subtasks.map((s, index) => ({
          task_id: task.id,
          title: s.title,
          position: index,
        }))

        await supabase.from('task_subtasks').insert(subtasksToInsert)
      }

      // Ajouter à l'historique
      await supabase.from('task_history').insert({
        task_id: task.id,
        user_id: user.id,
        action: 'created',
        new_value: title.trim(),
      })

      // Upload des pièces jointes
      if (attachments.length > 0) {
        await uploadAttachments(task.id)
      }

      // Notification si assigné à quelqu'un d'autre
      if (assignedTo && assignedTo !== user.id) {
        await supabase.from('task_notifications').insert({
          user_id: assignedTo,
          task_id: task.id,
          type: 'assigned',
          message: `Une nouvelle tâche vous a été assignée: ${title.trim()}`,
        })
      }

      Alert.alert('Succès', 'Tâche créée avec succès', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ])
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de créer la tâche')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView}>
        {/* Titre */}
        <View style={styles.field}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre de la tâche"
            placeholderTextColor="#999"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description détaillée..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Assigner à */}
        <View style={styles.field}>
          <Text style={styles.label}>Assigner à</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowEmployeePicker(true)}
          >
            <Text style={styles.selectButtonText}>
              {assignedTo
                ? `${getUserName(employees.find(e => e.id === assignedTo) as User)}${assignedTo === user?.id ? ' (moi)' : ''}`
                : 'Non assignée'}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Employee Picker Modal */}
        <Modal
          visible={showEmployeePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEmployeePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assigner à</Text>
                <TouchableOpacity onPress={() => setShowEmployeePicker(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={[{ id: '', email: '', first_name: 'Non assignée', last_name: '', role: 'employe' as const, phone: null, organization_id: null, can_view_client_portal: false, created_at: '' }, ...employees]}
                keyExtractor={(item) => item.id || 'none'}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      assignedTo === item.id && styles.modalItemActive,
                    ]}
                    onPress={() => {
                      setAssignedTo(item.id)
                      setShowEmployeePicker(false)
                    }}
                  >
                    <Text style={[
                      styles.modalItemText,
                      assignedTo === item.id && styles.modalItemTextActive,
                    ]}>
                      {item.id ? `${getUserName(item)}${item.id === user?.id ? ' (moi)' : ''}` : 'Non assignée'}
                    </Text>
                    {assignedTo === item.id && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Priorité */}
        <View style={styles.field}>
          <Text style={styles.label}>Priorité</Text>
          <View style={styles.priorityButtons}>
            {(['basse', 'normale', 'haute', 'urgente'] as TaskPriority[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityButton,
                  priority === p && styles.priorityButtonActive,
                  priority === p && p === 'urgente' && styles.priorityButtonUrgent,
                ]}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === p && styles.priorityButtonTextActive,
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sous-tâches */}
        <View style={styles.field}>
          <Text style={styles.label}>Sous-tâches (checklist)</Text>
          <View style={styles.subtaskInput}>
            <TextInput
              style={styles.subtaskTextInput}
              value={newSubtask}
              onChangeText={setNewSubtask}
              placeholder="Ajouter une sous-tâche..."
              placeholderTextColor="#999"
              onSubmitEditing={addSubtask}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addButton} onPress={addSubtask}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {subtasks.length > 0 && (
            <View style={styles.subtasksList}>
              {subtasks.map((subtask) => (
                <View key={subtask.id} style={styles.subtaskItem}>
                  <Text style={styles.subtaskTitle}>{subtask.title}</Text>
                  <TouchableOpacity onPress={() => removeSubtask(subtask.id)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pièces jointes */}
        <View style={styles.field}>
          <Text style={styles.label}>Pièces jointes</Text>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={showAttachmentOptions}
          >
            <Text style={styles.attachmentButtonIcon}>📎</Text>
            <Text style={styles.attachmentButtonText}>Ajouter une pièce jointe</Text>
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View style={styles.attachmentsList}>
              {attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentItem}>
                  {attachment.type === 'image' ? (
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                  ) : (
                    <View style={styles.attachmentPdfIcon}>
                      <Text style={styles.attachmentPdfText}>PDF</Text>
                    </View>
                  )}
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <TouchableOpacity onPress={() => removeAttachment(attachment.id)}>
                    <Text style={styles.removeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Boutons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Créer la tâche</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemActive: {
    backgroundColor: '#FEE2E2',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextActive: {
    color: '#64191E',
    fontWeight: '600',
  },
  checkIcon: {
    fontSize: 18,
    color: '#64191E',
    fontWeight: 'bold',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#64191E',
    borderColor: '#64191E',
  },
  priorityButtonUrgent: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  priorityButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  priorityButtonTextActive: {
    color: '#fff',
  },
  subtaskInput: {
    flexDirection: 'row',
    gap: 8,
  },
  subtaskTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    color: '#333',
  },
  addButton: {
    width: 50,
    backgroundColor: '#64191E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  subtasksList: {
    marginTop: 12,
  },
  subtaskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  removeButton: {
    fontSize: 18,
    color: '#DC2626',
    paddingHorizontal: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
  },
  attachmentButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  attachmentButtonText: {
    fontSize: 15,
    color: '#666',
  },
  attachmentsList: {
    marginTop: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  attachmentPdfIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachmentPdfText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#64191E',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
})
