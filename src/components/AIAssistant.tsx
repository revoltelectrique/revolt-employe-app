import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'

const PORTAL_URL = process.env.EXPO_PUBLIC_PORTAL_URL || ''

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function AIAssistant() {
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)
  const loadingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  const setLoadingState = (val: boolean) => {
    loadingRef.current = val
    setLoading(val)
  }
  const setMessagesState = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof updater === 'function') {
      setMessages(prev => {
        const next = updater(prev)
        messagesRef.current = next
        return next
      })
    } else {
      messagesRef.current = updater
      setMessages(updater)
    }
  }

  const getAccessToken = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const sendTextToAI = async (text: string) => {
    if (!text.trim() || loadingRef.current) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() }
    const updatedMessages = [...messagesRef.current, userMsg]
    setMessagesState(updatedMessages)
    setInput('')
    setLoadingState(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        setMessagesState(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Session expirée. Veuillez vous reconnecter.',
        }])
        return
      }

      const history = updatedMessages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch(`${PORTAL_URL}/api/ai/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.trim(), history }),
      })

      const data = await response.json()
      setMessagesState(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || data.error || 'Aucune réponse.',
      }])
    } catch (error) {
      console.error('[AI Assistant] Fetch error:', error)
      setMessagesState(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erreur: ${error instanceof Error ? error.message : 'Connexion impossible'}`,
      }])
    } finally {
      setLoadingState(false)
    }
  }

  const sendCommand = () => {
    sendTextToAI(input)
  }

  // Voice recording with expo-av
  const startRecording = async () => {
    if (loadingRef.current || isRecording) return
    try {
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission refusée', "L'accès au microphone est requis pour la commande vocale.")
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: false,
        android: {
          extension: '.amr',
          outputFormat: Audio.AndroidOutputFormat.THREE_GPP,
          audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
          sampleRate: 8000,
          numberOfChannels: 1,
          bitRate: 12200,
        },
        ios: {
          extension: '.amr',
          outputFormat: Audio.IOSOutputFormat.AMR,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 8000,
          numberOfChannels: 1,
          bitRate: 12200,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      })
      recordingRef.current = recording
      durationRef.current = 0
      setRecordingDuration(0)
      setIsRecording(true)
      recordingInterval.current = setInterval(() => {
        durationRef.current += 1
        setRecordingDuration(durationRef.current)
      }, 1000)
    } catch (error) {
      console.error('[AI Assistant] Record start error:', error)
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement.")
    }
  }

  const stopRecording = async () => {
    if (!isRecording || !recordingRef.current) return
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current)
      recordingInterval.current = null
    }
    setIsRecording(false)

    const recording = recordingRef.current
    recordingRef.current = null

    let uri: string | null = null
    try {
      await recording.stopAndUnloadAsync()
      uri = recording.getURI()
    } catch (e) {
      console.warn('[AI Assistant] Stop error:', e)
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    })

    if (!uri) {
      setMessagesState(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Erreur: impossible de récupérer l'enregistrement. Réessayez.",
      }])
      return
    }

    if (durationRef.current < 1) {
      setMessagesState(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Enregistrement trop court. Parlez plus longtemps.',
      }])
      return
    }

    setLoadingState(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        setMessagesState(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Session expirée. Veuillez vous reconnecter.',
        }])
        setLoadingState(false)
        return
      }

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      })

      const transcribeResponse = await fetch(`${PORTAL_URL}/api/ai/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ audio: base64Audio }),
      })

      const transcribeData = await transcribeResponse.json()

      if (!transcribeData.text) {
        setMessagesState(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: transcribeData.error || 'Aucune parole détectée. Réessayez.',
        }])
        setLoadingState(false)
        return
      }

      setLoadingState(false)
      await sendTextToAI(transcribeData.text)
    } catch (error) {
      console.error('[AI Assistant] Voice error:', error)
      setMessagesState(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erreur vocale: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      }])
      setLoadingState(false)
    }
  }

  const clearConversation = () => {
    setMessagesState([])
    setInput('')
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          {!isUser && <Text style={styles.aiLabel}>Assistant IA</Text>}
          <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { bottom: 90 + insets.bottom }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>AI</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Assistant IA</Text>
            <TouchableOpacity onPress={clearConversation} style={styles.headerButton}>
              <Text style={styles.clearText}>Effacer</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🤖</Text>
                <Text style={styles.emptyTitle}>Assistant IA ReVolt</Text>
                <Text style={styles.emptyText}>
                  Tapez ou appuyez sur le micro pour parler:{'\n\n'}
                  • Créer un bon de commande{'\n'}
                  • Ajouter un événement au calendrier{'\n'}
                  • Créer une tâche{'\n'}
                  • Ouvrir une conversation{'\n'}
                  • Créer une réquisition{'\n'}
                  • Ajouter un prospect CRM
                </Text>
              </View>
            }
          />

          {isRecording && (
            <View style={styles.recordingBar}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Écoute en cours... {recordingDuration}s
              </Text>
            </View>
          )}

          {loading && !isRecording && (
            <View style={styles.loadingBar}>
              <ActivityIndicator size="small" color="#64191E" />
              <Text style={styles.loadingText}>Traitement en cours...</Text>
            </View>
          )}

          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.micButtonRecording]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={loading}
            >
              <Text style={styles.micButtonText}>{isRecording ? '⏹️' : '🎤'}</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Tapez ou appuyez 🎤..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              editable={!loading && !isRecording}
              onSubmitEditing={sendCommand}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
              onPress={sendCommand}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  fabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#64191E',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  clearText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'right',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64191E',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 21,
  },
  messageTextUser: {
    color: '#1a1a1a',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    textAlign: 'left',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  recordingText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  loadingText: {
    fontSize: 13,
    color: '#666',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#FEE2E2',
  },
  micButtonText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
  },
})
