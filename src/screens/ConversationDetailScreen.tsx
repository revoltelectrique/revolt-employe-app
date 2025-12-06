import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Conversation, ConversationMessage } from '../types'

// Import des onglets
import ConversationInfoTab from '../components/conversation/ConversationInfoTab'
import ConversationChatTab from '../components/conversation/ConversationChatTab'
import ConversationDossierTab from '../components/conversation/ConversationDossierTab'

type TabType = 'info' | 'chat' | 'dossier'

export default function ConversationDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { user, profile } = useAuth()
  const insets = useSafeAreaInsets()

  const conversationId = route.params?.conversationId

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])

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
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [conversationId])
  )

  // Real-time subscription pour les messages
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-detail-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
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

  // Extraire les photos des messages pour l'onglet Dossier
  const photosFromChat = messages
    .flatMap(msg => msg.attachments || [])
    .filter(att => att.file_type === 'photo')

  const documentsFromChat = messages
    .flatMap(msg => msg.attachments || [])
    .filter(att => att.file_type === 'pdf')

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  if (!conversation) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Conversation introuvable</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header avec info client */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerNumber}>{conversation.servicentre_number}</Text>
          <Text style={styles.headerClient} numberOfLines={1}>{conversation.client_name}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.memberCount}>👥 4</Text>
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.tabActive]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabIcon, activeTab === 'info' && styles.tabIconActive]}>ℹ️</Text>
          <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Infos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabIcon, activeTab === 'chat' && styles.tabIconActive]}>💬</Text>
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'dossier' && styles.tabActive]}
          onPress={() => setActiveTab('dossier')}
        >
          <Text style={[styles.tabIcon, activeTab === 'dossier' && styles.tabIconActive]}>📁</Text>
          <Text style={[styles.tabText, activeTab === 'dossier' && styles.tabTextActive]}>Dossier</Text>
        </TouchableOpacity>
      </View>

      {/* Contenu des onglets */}
      <View style={styles.content}>
        {activeTab === 'info' && (
          <ConversationInfoTab
            conversation={conversation}
            onUpdate={(updated) => setConversation(updated)}
          />
        )}

        {activeTab === 'chat' && (
          <ConversationChatTab
            conversation={conversation}
            messages={messages}
            setMessages={setMessages}
            currentUserId={user?.id || ''}
            currentUserName={profile?.first_name || user?.email?.split('@')[0] || 'Utilisateur'}
          />
        )}

        {activeTab === 'dossier' && (
          <ConversationDossierTab
            conversationId={conversationId}
            photosFromChat={photosFromChat}
            documentsFromChat={documentsFromChat}
          />
        )}
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#64191E',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  headerInfo: {
    flex: 1,
  },
  headerNumber: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  headerClient: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    marginLeft: 12,
  },
  memberCount: {
    color: '#fff',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#64191E',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabIconActive: {
    // Icône active
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#64191E',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
})
