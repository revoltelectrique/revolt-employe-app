import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { DocumentComment, DocumentType } from '../types'
import { Card } from './Card'

interface CommentsSectionProps {
  documentType: DocumentType
  documentId: string
  currentUserId: string
}

export function CommentsSection({
  documentType,
  documentId,
  currentUserId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    fetchComments()
  }, [documentId])

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .select(`
          *,
          author:users!author_id(id, email, first_name, last_name)
        `)
        .eq('document_type', documentType)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Erreur chargement commentaires:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleDateString('fr-CA', { month: 'short' })
    const year = date.getFullYear()
    const time = date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
    return `${day} ${month} ${year}, ${time}`
  }

  const getAuthorName = (author: DocumentComment['author']) => {
    if (author?.first_name) {
      return `${author.first_name} ${author.last_name || ''}`.trim()
    }
    return author?.email?.split('@')[0] || 'Inconnu'
  }

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .insert({
          document_type: documentType,
          document_id: documentId,
          author_id: currentUserId,
          content: newComment.trim(),
        })
        .select(`
          *,
          author:users!author_id(id, email, first_name, last_name)
        `)
        .single()

      if (error) throw error

      setComments([data, ...comments])
      setNewComment('')
      Alert.alert('Succès', 'Commentaire ajouté')
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible d\'ajouter le commentaire')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return

    try {
      const { error } = await supabase
        .from('document_comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId)

      if (error) throw error

      setComments(comments.map(c =>
        c.id === commentId
          ? { ...c, content: editContent.trim(), updated_at: new Date().toISOString() }
          : c
      ))
      setEditingId(null)
      setEditContent('')
      Alert.alert('Succès', 'Commentaire modifié')
    } catch (error) {
      console.error('Erreur:', error)
      Alert.alert('Erreur', 'Impossible de modifier le commentaire')
    }
  }

  const handleDelete = (commentId: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer ce commentaire?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('document_comments')
                .delete()
                .eq('id', commentId)

              if (error) throw error

              setComments(comments.filter(c => c.id !== commentId))
            } catch (error) {
              console.error('Erreur:', error)
              Alert.alert('Erreur', 'Impossible de supprimer le commentaire')
            }
          },
        },
      ]
    )
  }

  const startEdit = (comment: DocumentComment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>Commentaires ({comments.length})</Text>

      {/* Formulaire d'ajout */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.submitButton, (!newComment.trim() || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Envoyer</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Liste des commentaires */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#64191E" />
        </View>
      ) : comments.length === 0 ? (
        <Text style={styles.emptyText}>Aucun commentaire pour le moment</Text>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              {editingId === comment.id ? (
                <View>
                  <TextInput
                    style={styles.editInput}
                    value={editContent}
                    onChangeText={setEditContent}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleEdit(comment.id)}
                    >
                      <Text style={styles.saveButtonText}>Sauvegarder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelEdit}
                    >
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentDate}>
                      {formatDate(comment.created_at)} - {getAuthorName(comment.author)}
                      {comment.updated_at !== comment.created_at && (
                        <Text style={styles.editedLabel}> (modifié)</Text>
                      )}
                    </Text>
                    {comment.author_id === currentUserId && (
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          onPress={() => startEdit(comment)}
                          style={styles.actionButton}
                        >
                          <Text style={styles.editIcon}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(comment.id)}
                          style={styles.actionButton}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#64191E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  commentsList: {
    gap: 12,
  },
  commentCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  commentContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  editedLabel: {
    fontStyle: 'italic',
    color: '#999',
  },
  commentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  editIcon: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 14,
  },
  editInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#64191E',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#64191E',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
})
