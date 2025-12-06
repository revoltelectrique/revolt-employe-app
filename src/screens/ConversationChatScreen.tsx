import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Location from 'expo-location'
import * as FileSystem from 'expo-file-system'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { notifyConversationMessage } from '../lib/notifications'
import { Conversation, ConversationMessage, MessageType, User, PurchaseOrder, MaterialRequest } from '../types'

const messageTypeLabels: Record<MessageType, { label: string; color: string; icon: string }> = {
  general: { label: 'Message', color: '#6B7280', icon: '💬' },
  observation: { label: 'Observation', color: '#3B82F6', icon: '👁️' },
  probleme: { label: 'Problème', color: '#EF4444', icon: '⚠️' },
  directive: { label: 'Directive', color: '#8B5CF6', icon: '📋' },
  materiel: { label: 'Matériel', color: '#F59E0B', icon: '🔧' },
}

export default function ConversationChatScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { user, profile } = useAuth()
  const flatListRef = useRef<FlatList>(null)

  const conversationId = route.params?.conversationId
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedType, setSelectedType] = useState<MessageType>('general')
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

  // Liens BC/Réquisitions
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkedItems, setLinkedItems] = useState<{type: string, id: string, number: string}[]>([])
  const [availableBCs, setAvailableBCs] = useState<PurchaseOrder[]>([])
  const [availableReqs, setAvailableReqs] = useState<MaterialRequest[]>([])

  // Keyboard height pour ajuster l'affichage
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const fetchData = async () => {
    try {
      // Fetch conversation
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          creator:users!created_by(email, first_name, last_name)
        `)
        .eq('id', conversationId)
        .single()

      if (convError) throw convError
      setConversation(convData)

      // Set navigation title (headerRight sera défini après le render)
      navigation.setOptions({
        title: convData.client_name,
      })

      // Fetch linked items
      const { data: linksData } = await supabase
        .from('conversation_linked_items')
        .select('*')
        .eq('conversation_id', conversationId)

      if (linksData) {
        const items = await Promise.all(
          linksData.map(async (link) => {
            if (link.item_type === 'purchase_order') {
              const { data: bc } = await supabase
                .from('purchase_orders')
                .select('po_number')
                .eq('id', link.item_id)
                .single()
              return { type: 'purchase_order', id: link.item_id, number: bc?.po_number || '' }
            } else {
              const { data: req } = await supabase
                .from('material_requests')
                .select('request_number')
                .eq('id', link.item_id)
                .single()
              return { type: 'material_request', id: link.item_id, number: req?.request_number || '' }
            }
          })
        )
        setLinkedItems(items)
      }

      // Fetch messages
      const { data: msgData, error: msgError } = await supabase
        .from('conversation_messages')
        .select(`
          *,
          author:users!author_id(id, email, first_name, last_name),
          attachments:message_attachments(*)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (msgError) throw msgError
      setMessages(msgData || [])
    } catch (error) {
      console.error('Erreur fetch:', error)
      Alert.alert('Erreur', 'Impossible de charger la conversation')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role')
        .in('role', ['employe', 'employé', 'contremaitre', 'contremaître', 'admin'])
        .order('first_name', { ascending: true })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur fetch employees:', error)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
      fetchEmployees()
    }, [conversationId])
  )

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the complete message with relations
          const { data } = await supabase
            .from('conversation_messages')
            .select(`
              *,
              author:users!author_id(id, email, first_name, last_name),
              attachments:message_attachments(*)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            // Éviter les doublons (le message peut avoir été ajouté localement)
            setMessages((prev) => {
              const exists = prev.some(m => m.id === data.id)
              if (exists) return prev
              return [...prev, data]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Définir le bouton header après le montage
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={openLinkModal}
          style={{ marginRight: 8 }}
        >
          <Text style={{ fontSize: 18 }}>🔗</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  // Écouter le clavier pour ajuster l'affichage
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

  // Filtrer les employés pour les suggestions de mentions
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

  // Détecter le @ dans le texte
  const handleTextChange = (text: string) => {
    setNewMessage(text)

    // Trouver si on est en train de taper une mention
    const textBeforeCursor = text.substring(0, cursorPosition + (text.length - newMessage.length))
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // S'il n'y a pas d'espace après le @, on est en train de taper une mention
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

  // Insérer une mention dans le texte
  const insertMention = (employee: User) => {
    const name = employee.first_name
      ? `${employee.first_name} ${employee.last_name || ''}`.trim()
      : employee.email.split('@')[0]

    // Trouver où commençait le @
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

  // Extraire les mentions d'un message
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

  // Ouvrir le modal de liens et charger les données
  const openLinkModal = async () => {
    setShowLinkModal(true)

    // Charger les BC récents
    const { data: bcs } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (bcs) setAvailableBCs(bcs)

    // Charger les réquisitions récentes
    const { data: reqs } = await supabase
      .from('material_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (reqs) setAvailableReqs(reqs)
  }

  // Lier un BC ou une réquisition
  const linkItem = async (itemType: 'purchase_order' | 'material_request', itemId: string, itemNumber: string) => {
    try {
      // Vérifier si déjà lié
      const alreadyLinked = linkedItems.some(i => i.type === itemType && i.id === itemId)
      if (alreadyLinked) {
        Alert.alert('Déjà lié', 'Cet élément est déjà lié à cette conversation')
        return
      }

      await supabase.from('conversation_linked_items').insert({
        conversation_id: conversationId,
        item_type: itemType,
        item_id: itemId,
        linked_by: user?.id,
      })

      setLinkedItems([...linkedItems, { type: itemType, id: itemId, number: itemNumber }])

      // Envoyer un message système
      await supabase.from('conversation_messages').insert({
        conversation_id: conversationId,
        author_id: user?.id,
        message_type: 'general',
        content: `📎 ${itemType === 'purchase_order' ? 'Bon de commande' : 'Réquisition'} ${itemNumber} lié à cette conversation`,
      })

      setShowLinkModal(false)
      Alert.alert('Succès', 'Élément lié à la conversation')
    } catch (error) {
      console.error('Erreur liaison:', error)
      Alert.alert('Erreur', 'Impossible de lier cet élément')
    }
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return null

      const loc = await Location.getCurrentPositionAsync({})
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }
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

    try {
      const location = await getCurrentLocation()
      const mentionedUserIds = extractMentions(content)

      const { data: msg, error: msgError } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          author_id: user?.id,
          message_type: selectedType,
          content: content.trim() || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Ajouter le message localement immédiatement (le real-time peut avoir du délai)
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
      setMessages((prev) => [...prev, newMsg])

      // Sauvegarder les mentions
      if (mentionedUserIds.length > 0) {
        const mentionsToInsert = mentionedUserIds.map(userId => ({
          message_id: msg.id,
          mentioned_user_id: userId,
          notified: false,
        }))

        await supabase.from('conversation_mentions').insert(mentionsToInsert)
      }

      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          await uploadAttachment(msg.id, att)
        }
      }

      // Envoyer les notifications push
      if (conversation && user) {
        const senderName = profile?.first_name || user.email?.split('@')[0] || 'Quelqu\'un'
        const messagePreview = content.trim() || (attachments?.[0]?.type === 'photo' ? '📷 Photo' : attachments?.[0]?.type === 'video' ? '🎬 Vidéo' : attachments?.[0]?.type === 'audio' ? '🎵 Note vocale' : '📄 Document')

        // Notifications en arrière-plan (ne pas bloquer l'envoi)
        notifyConversationMessage(
          conversationId,
          conversation.client_name,
          senderName,
          messagePreview,
          user.id,
          mentionedUserIds
        ).catch(console.error)
      }

      setNewMessage('')
      setSelectedType('general')
    } catch (error) {
      console.error('Erreur envoi:', error)
      Alert.alert('Erreur', "Impossible d'envoyer le message")
    } finally {
      setSending(false)
    }
  }

  const uploadAttachment = async (messageId: string, attachment: any) => {
    try {
      const fileName = `${conversationId}/${messageId}/${Date.now()}_${attachment.name || 'file'}`

      let fileData
      if (attachment.uri) {
        const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        fileData = decode(base64)
      }

      const { error: uploadError } = await supabase.storage
        .from('conversation-attachments')
        .upload(fileName, fileData, {
          contentType: attachment.mimeType || 'application/octet-stream',
        })

      if (uploadError) throw uploadError

      // Save attachment metadata
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
        width: asset.width,
        height: asset.height,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }])
    }
  }

  const pickVideo = async () => {
    setShowAttachmentOptions(false)

    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la caméra requis')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      quality: 0.7,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      await sendMessage('', [{
        uri: asset.uri,
        type: 'video',
        name: `video_${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        duration: asset.duration ? Math.round(asset.duration / 1000) : null,
      }])
    }
  }

  const pickDocument = async () => {
    setShowAttachmentOptions(false)

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    })

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

      // Timer for duration
      recordingInterval.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 120) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
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
    if (msg.author?.email) {
      return msg.author.email.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  // Rendre le contenu du message avec les mentions colorées
  const renderMessageContent = (content: string, isOwn: boolean) => {
    // Regex pour trouver les mentions @NomPrenom
    const mentionRegex = /@[\w\s]+(?=\s|$|[.,!?])/g
    const parts = content.split(mentionRegex)
    const mentions = content.match(mentionRegex) || []

    const elements: React.ReactNode[] = []
    parts.forEach((part, index) => {
      elements.push(part)
      if (mentions[index]) {
        elements.push(
          <Text key={`mention-${index}`} style={styles.mentionText}>
            {mentions[index]}
          </Text>
        )
      }
    })

    return elements
  }

  const renderMessage = ({ item: msg }: { item: ConversationMessage }) => {
    const isOwn = msg.author_id === user?.id
    const typeInfo = messageTypeLabels[msg.message_type]

    return (
      <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
        {!isOwn && (
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {getInitials(msg)}
            </Text>
          </View>
        )}

        <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
          {!isOwn && (
            <Text style={styles.authorName}>{getAuthorName(msg)}</Text>
          )}

          {msg.message_type !== 'general' && (
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
              <Text style={styles.typeBadgeIcon}>{typeInfo.icon}</Text>
              <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
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
                  {att.file_type === 'video' && (
                    <View style={styles.videoPlaceholder}>
                      <Text style={styles.videoIcon}>🎬</Text>
                      <Text style={styles.videoDuration}>
                        {att.duration ? formatDuration(att.duration) : 'Vidéo'}
                      </Text>
                    </View>
                  )}
                  {att.file_type === 'audio' && (
                    <View style={styles.audioPlaceholder}>
                      <Text style={styles.audioIcon}>🎵</Text>
                      <Text style={styles.audioDuration}>
                        {att.duration ? formatDuration(att.duration) : 'Audio'}
                      </Text>
                    </View>
                  )}
                  {att.file_type === 'pdf' && (
                    <View style={styles.pdfPlaceholder}>
                      <Text style={styles.pdfIcon}>📄</Text>
                      <Text style={styles.pdfName} numberOfLines={1}>
                        {att.file_name || 'Document PDF'}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {msg.content && (
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
              {renderMessageContent(msg.content, isOwn)}
            </Text>
          )}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
              {formatTime(msg.created_at)}
            </Text>
            {msg.latitude && (
              <Text style={[styles.locationIndicator, isOwn && styles.messageTimeOwn]}>
                📍
              </Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  const isClosed = conversation?.status !== 'ouverte'

  return (
    <View style={styles.container}>
      {/* Header info */}
      <View style={styles.headerInfo}>
        <Text style={styles.headerServicentre}>{conversation?.servicentre_number}</Text>
        {conversation?.location && (
          <Text style={styles.headerLocation}>📍 {conversation.location}</Text>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* Mentions suggestions */}
      {showMentions && filteredEmployees.length > 0 && (
        <View style={styles.mentionsList}>
          <FlatList
            data={filteredEmployees.slice(0, 5)}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mentionItem}
                onPress={() => insertMention(item)}
              >
                <View style={styles.mentionAvatar}>
                  <Text style={styles.mentionAvatarText}>
                    {(item.first_name || item.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionName}>
                    {item.first_name
                      ? `${item.first_name} ${item.last_name || ''}`
                      : item.email.split('@')[0]}
                  </Text>
                  <Text style={styles.mentionEmail}>{item.email}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input area - positionné de manière absolue pour rester au-dessus du clavier */}
      {isClosed ? (
        <View style={[styles.closedBanner, { paddingBottom: Math.max(insets.bottom + 8, 20), marginBottom: keyboardHeight }]}>
          <Text style={styles.closedText}>🔒 Cette conversation est fermée</Text>
        </View>
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom + 8, 20), marginBottom: keyboardHeight }]}>
          {/* Type selector */}
          <TouchableOpacity
            style={[styles.typeButton, { backgroundColor: messageTypeLabels[selectedType].color }]}
            onPress={() => setShowTypeSelector(true)}
          >
            <Text style={styles.typeButtonText}>{messageTypeLabels[selectedType].icon}</Text>
          </TouchableOpacity>

          {/* Attachment button */}
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttachmentOptions(true)}
          >
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={newMessage}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder="Écrire un message... (@ pour mentionner)"
            multiline
            maxLength={2000}
          />

          {/* Send / Voice button */}
          {newMessage.trim() ? (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => sendMessage(newMessage)}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>➤</Text>
              )}
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

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Enregistrement... {formatDuration(recordingDuration)}
          </Text>
        </View>
      )}

      {/* Type selector modal */}
      <Modal
        visible={showTypeSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeSelector(false)}
        >
          <View style={styles.typeModal}>
            <Text style={styles.typeModalTitle}>Type de message</Text>
            {(Object.keys(messageTypeLabels) as MessageType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeOption,
                  selectedType === type && styles.typeOptionSelected,
                ]}
                onPress={() => {
                  setSelectedType(type)
                  setShowTypeSelector(false)
                }}
              >
                <Text style={styles.typeOptionIcon}>{messageTypeLabels[type].icon}</Text>
                <Text style={styles.typeOptionLabel}>{messageTypeLabels[type].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Attachment options modal */}
      <Modal
        visible={showAttachmentOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentOptions(false)}
        >
          <View style={styles.attachmentModal}>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(true)}>
              <Text style={styles.attachmentOptionIcon}>📷</Text>
              <Text style={styles.attachmentOptionText}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(false)}>
              <Text style={styles.attachmentOptionIcon}>🖼️</Text>
              <Text style={styles.attachmentOptionText}>Galerie photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={pickVideo}>
              <Text style={styles.attachmentOptionIcon}>🎬</Text>
              <Text style={styles.attachmentOptionText}>Vidéo (max 30s)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={pickDocument}>
              <Text style={styles.attachmentOptionIcon}>📄</Text>
              <Text style={styles.attachmentOptionText}>Document PDF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Link BC/Requisition modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLinkModal(false)}
        >
          <View style={styles.linkModal}>
            <Text style={styles.linkModalTitle}>Lier à cette conversation</Text>

            {/* Items déjà liés */}
            {linkedItems.length > 0 && (
              <View style={styles.linkedSection}>
                <Text style={styles.linkedSectionTitle}>Éléments liés</Text>
                {linkedItems.map((item, index) => (
                  <View key={index} style={styles.linkedItem}>
                    <Text style={styles.linkedItemIcon}>
                      {item.type === 'purchase_order' ? '📄' : '📦'}
                    </Text>
                    <Text style={styles.linkedItemText}>{item.number}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Section BC */}
            <Text style={styles.linkSectionTitle}>Bons de commande récents</Text>
            <FlatList
              data={availableBCs.slice(0, 5)}
              keyExtractor={(item) => item.id}
              style={styles.linkList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => linkItem('purchase_order', item.id, item.po_number)}
                >
                  <Text style={styles.linkItemIcon}>📄</Text>
                  <View style={styles.linkItemInfo}>
                    <Text style={styles.linkItemNumber}>{item.po_number}</Text>
                    <Text style={styles.linkItemDesc} numberOfLines={1}>
                      {item.supplier_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyLinkText}>Aucun BC disponible</Text>
              }
            />

            {/* Section Réquisitions */}
            <Text style={styles.linkSectionTitle}>Réquisitions récentes</Text>
            <FlatList
              data={availableReqs.slice(0, 5)}
              keyExtractor={(item) => item.id}
              style={styles.linkList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.linkItem}
                  onPress={() => linkItem('material_request', item.id, item.request_number)}
                >
                  <Text style={styles.linkItemIcon}>📦</Text>
                  <View style={styles.linkItemInfo}>
                    <Text style={styles.linkItemNumber}>{item.request_number}</Text>
                    <Text style={styles.linkItemDesc} numberOfLines={1}>
                      {item.client_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyLinkText}>Aucune réquisition disponible</Text>
              }
            />

            <TouchableOpacity
              style={styles.closeLinkButton}
              onPress={() => setShowLinkModal(false)}
            >
              <Text style={styles.closeLinkButtonText}>Fermer</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerServicentre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64191E',
  },
  headerLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    fontSize: 12,
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
  videoPlaceholder: {
    width: 200,
    height: 120,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 32,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
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
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#333',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: '#fff',
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
  // Styles pour les mentions
  mentionText: {
    color: '#3B82F6',
    fontWeight: '600',
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
  // Styles pour le modal de liens
  linkModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  linkedSection: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  linkedSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  linkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkedItemIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  linkedItemText: {
    fontSize: 14,
    color: '#0369a1',
    fontWeight: '500',
  },
  linkSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  linkList: {
    maxHeight: 120,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  linkItemInfo: {
    flex: 1,
  },
  linkItemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  linkItemDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyLinkText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    padding: 12,
  },
  closeLinkButton: {
    backgroundColor: '#64191E',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeLinkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
