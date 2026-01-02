import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Keyboard,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { notifyConversationMessage } from '../../lib/notifications'
import { Conversation, ConversationMessage, MessageType, User } from '../../types'
import { useOffline } from '../../contexts/OfflineContext'
import { useOfflineQueue } from '../../lib/offlineQueue'

const messageTypeLabels: Record<MessageType, { label: string; color: string; icon: string }> = {
  general: { label: 'Message', color: '#6B7280', icon: '💬' },
  observation: { label: 'Observation', color: '#3B82F6', icon: '👁️' },
  probleme: { label: 'Problème', color: '#EF4444', icon: '⚠️' },
  directive: { label: 'Directive', color: '#8B5CF6', icon: '📋' },
  materiel: { label: 'Matériel', color: '#F59E0B', icon: '🔧' },
}

interface ConversationChatTabProps {
  conversation: Conversation
  messages: ConversationMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>
  currentUserId: string
  currentUserName: string
}

export default function ConversationChatTab({
  conversation,
  messages,
  setMessages,
  currentUserId,
  currentUserName,
}: ConversationChatTabProps) {
  const { user, profile } = useAuth()
  const { isOnline } = useOffline()
  const { addMutation, mutations } = useOfflineQueue()
  const flatListRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()

  const [newMessage, setNewMessage] = useState('')
  const [selectedType, setSelectedType] = useState<MessageType>('general')
  const [sending, setSending] = useState(false)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false)

  // Audio recording
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)

  // Mentions
  const [employees, setEmployees] = useState<User[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const textInputRef = useRef<TextInput>(null)

  // Keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
        setTimeout(() => scrollToBottom(), 100)
      }
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
      }
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role')
        .in('role', ['employe', 'employé', 'contremaitre', 'contremaître', 'admin'])
        .order('first_name', { ascending: true })

      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur fetch employees:', error)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  const filteredEmployees = useMemo(() => {
    if (!mentionSearch) return employees.filter(e => e.id !== user?.id)
    const search = mentionSearch.toLowerCase()
    return employees
      .filter(e => e.id !== user?.id)
      .filter(e => {
        const fullName = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase()
        const email = e.email.toLowerCase()
        return fullName.includes(search) || email.includes(search)
      })
  }, [employees, mentionSearch, user?.id])

  const handleTextChange = (text: string) => {
    setNewMessage(text)
    const textBeforeCursor = text.substring(0, cursorPosition + (text.length - newMessage.length))
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt)
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
    setMentionSearch('')
  }

  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setCursorPosition(event.nativeEvent.selection.start)
  }

  const insertMention = (employee: User) => {
    const name = employee.first_name
      ? `${employee.first_name} ${employee.last_name || ''}`.trim()
      : employee.email.split('@')[0]

    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const beforeMention = newMessage.substring(0, lastAtIndex)
      const afterMention = newMessage.substring(cursorPosition)
      const newText = `${beforeMention}@${name} ${afterMention}`
      setNewMessage(newText)
    }

    setShowMentions(false)
    setMentionSearch('')
    textInputRef.current?.focus()
  }

  const extractMentions = (text: string): string[] => {
    const mentionedUserIds: string[] = []
    employees.forEach(emp => {
      const name = emp.first_name
        ? `${emp.first_name} ${emp.last_name || ''}`.trim()
        : emp.email.split('@')[0]
      if (text.includes(`@${name}`)) {
        mentionedUserIds.push(emp.id)
      }
    })
    return mentionedUserIds
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return null
      const loc = await Location.getCurrentPositionAsync({})
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
    } catch {
      return null
    }
  }

  const sendMessage = async (content: string, attachments?: any[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return
    if (conversation?.status !== 'ouverte') {
      Alert.alert('Conversation fermée', 'Cette conversation est fermée')
      return
    }

    setSending(true)
    setShowMentions(false)
    Keyboard.dismiss()

    const tempId = `temp-${Date.now()}`
    const location = await getCurrentLocation()
    const mentionedUserIds = extractMentions(content)

    // Créer un message temporaire pour affichage immédiat (optimistic UI)
    const tempMsg: ConversationMessage = {
      id: tempId,
      conversation_id: conversation.id,
      author_id: user?.id || '',
      message_type: selectedType,
      content: content.trim() || null,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: user?.id || '',
        email: user?.email || '',
        first_name: profile?.first_name,
        last_name: profile?.last_name,
      },
      attachments: [],
      _pending: true, // Marqueur pour indiquer que le message est en attente
    } as ConversationMessage & { _pending?: boolean }

    // Afficher immédiatement le message
    setMessages((prev) => [...prev, tempMsg])
    setNewMessage('')
    setSelectedType('general')

    if (isOnline) {
      try {
        const { data: msg, error: msgError } = await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversation.id,
            author_id: user?.id,
            message_type: selectedType,
            content: content.trim() || null,
            latitude: location?.latitude || null,
            longitude: location?.longitude || null,
          })
          .select()
          .single()

        if (msgError) throw msgError

        // Remplacer le message temporaire par le vrai
        const newMsg: ConversationMessage = {
          ...msg,
          author: {
            id: user?.id || '',
            email: user?.email || '',
            first_name: profile?.first_name,
            last_name: profile?.last_name,
          },
          attachments: [],
        }
        setMessages((prev) => prev.map(m => m.id === tempId ? newMsg : m))

        if (mentionedUserIds.length > 0) {
          await supabase.from('conversation_mentions').insert(
            mentionedUserIds.map(userId => ({
              message_id: msg.id,
              mentioned_user_id: userId,
              notified: false,
            }))
          )
        }

        if (attachments && attachments.length > 0) {
          for (const att of attachments) {
            await uploadAttachment(msg.id, att)
          }
        }

        if (conversation && user) {
          const senderName = profile?.first_name || user.email?.split('@')[0] || 'Quelqu\'un'
          const messagePreview = content.trim() || (attachments?.[0]?.type === 'photo' ? '📷 Photo' : '📄 Document')
          notifyConversationMessage(
            conversation.id,
            conversation.client_name,
            senderName,
            messagePreview,
            user.id,
            mentionedUserIds
          ).catch(console.error)
        }
      } catch (error) {
        console.error('Erreur envoi:', error)
        // Marquer le message comme échoué
        setMessages((prev) => prev.map(m =>
          m.id === tempId ? { ...m, _failed: true } as any : m
        ))
        Alert.alert('Erreur', "Impossible d'envoyer le message. Réessayez plus tard.")
      }
    } else {
      // Mode hors ligne - Ajouter à la queue
      addMutation({
        type: 'insert',
        table: 'conversation_messages',
        data: {
          conversation_id: conversation.id,
          author_id: user?.id,
          message_type: selectedType,
          content: content.trim() || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          _tempId: tempId, // Pour retrouver le message après sync
        },
        maxRetries: 5,
      })
      Alert.alert(
        'Mode hors ligne',
        'Votre message sera envoyé quand vous serez connecté.'
      )
    }

    setSending(false)
  }

  const uploadAttachment = async (messageId: string, attachment: any) => {
    try {
      const fileName = `${conversation.id}/${messageId}/${Date.now()}_${attachment.name || 'file'}`
      let fileData
      if (attachment.uri) {
        const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
          encoding: 'base64' as any,
        })
        fileData = decode(base64)
      }

      await supabase.storage
        .from('conversation-attachments')
        .upload(fileName, fileData, {
          contentType: attachment.mimeType || 'application/octet-stream',
        })

      await supabase.from('message_attachments').insert({
        message_id: messageId,
        file_type: attachment.type,
        file_url: fileName,
        file_name: attachment.name,
        file_size: attachment.size,
        duration: attachment.duration,
        latitude: attachment.latitude,
        longitude: attachment.longitude,
        captured_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Erreur upload:', error)
    }
  }

  const pickImage = async (useCamera: boolean) => {
    setShowAttachmentOptions(false)
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    }

    let result
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Accès à la caméra requis')
        return
      }
      result = await ImagePicker.launchCameraAsync(options)
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options)
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const location = await getCurrentLocation()
      await sendMessage('', [{
        uri: asset.uri,
        type: 'photo',
        name: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        latitude: location?.latitude,
        longitude: location?.longitude,
      }])
    }
  }

  const pickDocument = async () => {
    setShowAttachmentOptions(false)
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      await sendMessage('', [{
        uri: asset.uri,
        type: 'pdf',
        name: asset.name,
        mimeType: 'application/pdf',
        size: asset.size,
      }])
    }
  }

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        Alert.alert('Permission refusée', 'Accès au microphone requis')
        return
      }
      await audioRecorder.record()
      setIsRecording(true)
      setRecordingDuration(0)
      recordingInterval.current = setInterval(() => {
        setRecordingDuration((prev) => (prev >= 120 ? prev : prev + 1))
      }, 1000)
    } catch (error) {
      console.error('Erreur enregistrement:', error)
    }
  }

  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current)
      recordingInterval.current = null
    }
    setIsRecording(false)
    await audioRecorder.stop()
    const uri = audioRecorder.uri
    if (uri && recordingDuration > 0) {
      await sendMessage('', [{
        uri,
        type: 'audio',
        name: `audio_${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        duration: recordingDuration,
      }])
    }
    setRecordingDuration(0)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-CA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAuthorName = (msg: ConversationMessage) => {
    if (msg.author?.first_name) {
      return `${msg.author.first_name} ${msg.author.last_name || ''}`.trim()
    }
    return msg.author?.email?.split('@')[0] || 'Inconnu'
  }

  const getInitials = (msg: ConversationMessage) => {
    if (msg.author?.first_name && msg.author?.last_name) {
      return `${msg.author.first_name.charAt(0)}${msg.author.last_name.charAt(0)}`.toUpperCase()
    }
    if (msg.author?.first_name) {
      return msg.author.first_name.substring(0, 2).toUpperCase()
    }
    return msg.author?.email?.substring(0, 2).toUpperCase() || '??'
  }

  const renderMessage = ({ item: msg }: { item: ConversationMessage & { _pending?: boolean; _failed?: boolean } }) => {
    const isOwn = msg.author_id === currentUserId
    const typeInfo = messageTypeLabels[msg.message_type]
    const isPending = (msg as any)._pending
    const isFailed = (msg as any)._failed

    return (
      <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
        {!isOwn && (
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>{getInitials(msg)}</Text>
          </View>
        )}

        <View style={[
          styles.messageBubble,
          isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
          isPending && styles.messageBubblePending,
          isFailed && styles.messageBubbleFailed,
        ]}>
          {!isOwn && <Text style={styles.authorName}>{getAuthorName(msg)}</Text>}

          {msg.message_type !== 'general' && (
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
              <Text style={styles.typeBadgeIcon}>{typeInfo.icon}</Text>
              <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
            </View>
          )}

          {msg.attachments && msg.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {msg.attachments.map((att) => (
                <View key={att.id} style={styles.attachmentItem}>
                  {att.file_type === 'photo' && (
                    <Image
                      source={{ uri: supabase.storage.from('conversation-attachments').getPublicUrl(att.file_url).data.publicUrl }}
                      style={styles.attachmentImage}
                      resizeMode="cover"
                    />
                  )}
                  {att.file_type === 'pdf' && (
                    <View style={styles.pdfPlaceholder}>
                      <Text style={styles.pdfIcon}>📄</Text>
                      <Text style={styles.pdfName} numberOfLines={1}>{att.file_name || 'Document PDF'}</Text>
                    </View>
                  )}
                  {att.file_type === 'audio' && (
                    <View style={styles.audioPlaceholder}>
                      <Text style={styles.audioIcon}>🎵</Text>
                      <Text style={styles.audioDuration}>{att.duration ? formatDuration(att.duration) : 'Audio'}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {msg.content && <Text style={styles.messageText}>{msg.content}</Text>}

          <View style={styles.messageFooter}>
            {msg.latitude && <Text style={styles.locationIndicator}>📍</Text>}
            {isPending && <Text style={styles.pendingIndicator}>⏳</Text>}
            {isFailed && <Text style={styles.failedIndicator}>❌</Text>}
            <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
              {isPending ? 'Envoi...' : isFailed ? 'Échec' : formatTime(msg.created_at)}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const isClosed = conversation?.status !== 'ouverte'

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        keyboardShouldPersistTaps="handled"
      />

      {showMentions && filteredEmployees.length > 0 && (
        <View style={styles.mentionsList}>
          <FlatList
            data={filteredEmployees.slice(0, 5)}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.mentionItem} onPress={() => insertMention(item)}>
                <View style={styles.mentionAvatar}>
                  <Text style={styles.mentionAvatarText}>{(item.first_name || item.email).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionName}>{item.first_name ? `${item.first_name} ${item.last_name || ''}` : item.email.split('@')[0]}</Text>
                  <Text style={styles.mentionEmail}>{item.email}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedText}>🔒 Cette conversation est fermée</Text>
        </View>
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom + 8, 20), marginBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={[styles.typeButton, { backgroundColor: messageTypeLabels[selectedType].color }]}
            onPress={() => setShowTypeSelector(true)}
          >
            <Text style={styles.typeButtonText}>{messageTypeLabels[selectedType].icon}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachmentOptions(true)}>
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>

          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={newMessage}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder="Écrire un message..."
            multiline
            maxLength={2000}
          />

          {newMessage.trim() ? (
            <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(newMessage)} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendButtonText}>➤</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Text style={styles.voiceButtonText}>{isRecording ? '⏹️' : '🎤'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Enregistrement... {formatDuration(recordingDuration)}</Text>
        </View>
      )}

      {/* Type selector modal */}
      <Modal visible={showTypeSelector} transparent animationType="fade" onRequestClose={() => setShowTypeSelector(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTypeSelector(false)}>
          <View style={styles.typeModal}>
            <Text style={styles.typeModalTitle}>Type de message</Text>
            {(Object.keys(messageTypeLabels) as MessageType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeOption, selectedType === type && styles.typeOptionSelected]}
                onPress={() => { setSelectedType(type); setShowTypeSelector(false) }}
              >
                <Text style={styles.typeOptionIcon}>{messageTypeLabels[type].icon}</Text>
                <Text style={styles.typeOptionLabel}>{messageTypeLabels[type].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Attachment options modal */}
      <Modal visible={showAttachmentOptions} transparent animationType="slide" onRequestClose={() => setShowAttachmentOptions(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachmentOptions(false)}>
          <View style={styles.attachmentModal}>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(true)}>
              <Text style={styles.attachmentOptionIcon}>📷</Text>
              <Text style={styles.attachmentOptionText}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(false)}>
              <Text style={styles.attachmentOptionIcon}>🖼️</Text>
              <Text style={styles.attachmentOptionText}>Galerie photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
              <Text style={styles.attachmentOptionIcon}>📄</Text>
              <Text style={styles.attachmentOptionText}>Document PDF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  messagesList: {
    padding: 12,
    paddingBottom: 80,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageContainerOwn: {
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarSmallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageBubblePending: {
    opacity: 0.7,
  },
  messageBubbleFailed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64191E',
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  typeBadgeIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  attachmentsContainer: {
    marginBottom: 6,
  },
  attachmentItem: {
    marginBottom: 6,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  pdfPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
  },
  pdfIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  pdfName: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
  },
  audioPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 20,
  },
  audioIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  audioDuration: {
    color: '#666',
    fontSize: 13,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  messageTimeOwn: {
    color: '#7CB342',
  },
  locationIndicator: {
    fontSize: 10,
    marginRight: 4,
  },
  pendingIndicator: {
    fontSize: 10,
    marginRight: 4,
  },
  failedIndicator: {
    fontSize: 10,
    marginRight: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  typeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  typeButtonText: {
    fontSize: 16,
  },
  attachButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 6,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: '#DC2626',
  },
  voiceButtonText: {
    fontSize: 18,
  },
  closedBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    alignItems: 'center',
  },
  closedText: {
    color: '#DC2626',
    fontWeight: '500',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 8,
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    marginRight: 8,
  },
  recordingText: {
    color: '#DC2626',
    fontWeight: '500',
  },
  mentionsList: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mentionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mentionAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mentionInfo: {
    flex: 1,
  },
  mentionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  mentionEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  typeModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  typeModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  typeOptionSelected: {
    backgroundColor: '#f0f0f0',
  },
  typeOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  typeOptionLabel: {
    fontSize: 16,
  },
  attachmentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attachmentOptionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  attachmentOptionText: {
    fontSize: 16,
  },
})
