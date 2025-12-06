import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MessageAttachment } from '../../types'

const { width: screenWidth } = Dimensions.get('window')
const photoSize = (screenWidth - 48) / 3

interface DocumentCategory {
  id: string
  conversation_id: string
  name: string
  created_by: string | null
  created_at: string
}

interface ConversationDocument {
  id: string
  conversation_id: string
  category_id: string | null
  file_url: string
  file_name: string
  file_type: string
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

interface ConversationDossierTabProps {
  conversationId: string
  photosFromChat: MessageAttachment[]
  documentsFromChat: MessageAttachment[]
}

export default function ConversationDossierTab({
  conversationId,
  photosFromChat,
  documentsFromChat,
}: ConversationDossierTabProps) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [documents, setDocuments] = useState<ConversationDocument[]>([])

  // Modals
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  // Form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [conversationId])

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('conversation_document_categories')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('name', { ascending: true })

      if (catError) throw catError
      setCategories(catData || [])

      // Fetch documents
      const { data: docData, error: docError } = await supabase
        .from('conversation_documents')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })

      if (docError) throw docError
      setDocuments(docData || [])
    } catch (error) {
      console.error('Erreur fetch dossier:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPhotoUrl = (attachment: MessageAttachment) => {
    return supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(attachment.file_url).data.publicUrl
  }

  const getDocumentUrl = (doc: ConversationDocument) => {
    return supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(doc.file_url).data.publicUrl
  }

  const openPhotoViewer = (url: string) => {
    setSelectedPhoto(url)
    setShowPhotoViewer(true)
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de catégorie')
      return
    }

    try {
      const { data, error } = await supabase
        .from('conversation_document_categories')
        .insert({
          conversation_id: conversationId,
          name: newCategoryName.trim(),
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      setCategories([...categories, data])
      setNewCategoryName('')
      setShowAddCategoryModal(false)
    } catch (error: any) {
      if (error.code === '23505') {
        Alert.alert('Erreur', 'Cette catégorie existe déjà')
      } else {
        Alert.alert('Erreur', 'Impossible de créer la catégorie')
      }
    }
  }

  const handlePickDocument = async () => {
    setShowAddDocumentModal(false)

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      })

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0])
      }
    } catch (error) {
      console.error('Erreur pick document:', error)
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier')
    }
  }

  const handlePickImage = async () => {
    setShowAddDocumentModal(false)

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        await uploadDocument({
          uri: asset.uri,
          name: `image_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: undefined,
        })
      }
    } catch (error) {
      console.error('Erreur pick image:', error)
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image')
    }
  }

  const uploadDocument = async (file: { uri: string; name: string; mimeType?: string; size?: number }) => {
    setUploading(true)

    try {
      const fileName = `${conversationId}/dossier/${Date.now()}_${file.name}`
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64' as any,
      })
      const fileData = decode(base64)

      const { error: uploadError } = await supabase.storage
        .from('conversation-attachments')
        .upload(fileName, fileData, {
          contentType: file.mimeType || 'application/octet-stream',
        })

      if (uploadError) throw uploadError

      const fileType = file.mimeType?.includes('pdf') ? 'pdf' : 'image'

      const { data, error: insertError } = await supabase
        .from('conversation_documents')
        .insert({
          conversation_id: conversationId,
          category_id: selectedCategoryId,
          file_url: fileName,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size || null,
          uploaded_by: user?.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setDocuments([data, ...documents])
      setSelectedCategoryId(null)
      Alert.alert('Succès', 'Document ajouté avec succès')
    } catch (error) {
      console.error('Erreur upload:', error)
      Alert.alert('Erreur', 'Impossible d\'uploader le fichier')
    } finally {
      setUploading(false)
    }
  }

  const getDocumentsForCategory = (categoryId: string) => {
    return documents.filter(d => d.category_id === categoryId)
  }

  const getUncategorizedDocuments = () => {
    return documents.filter(d => !d.category_id)
  }

  // Combiner photos du chat et photos du dossier
  const allPhotos = [
    ...photosFromChat.map(p => ({
      id: p.id,
      url: getPhotoUrl(p),
      isFromChat: true,
    })),
    ...documents.filter(d => d.file_type === 'image').map(d => ({
      id: d.id,
      url: getDocumentUrl(d),
      isFromChat: false,
    })),
  ]

  // Combiner PDFs du chat et PDFs du dossier
  const allPdfs = [
    ...documentsFromChat.map(d => ({
      id: d.id,
      name: d.file_name || 'Document',
      url: getPhotoUrl(d),
      isFromChat: true,
    })),
    ...documents.filter(d => d.file_type === 'pdf').map(d => ({
      id: d.id,
      name: d.file_name,
      url: getDocumentUrl(d),
      isFromChat: false,
    })),
  ]

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64191E" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Section Galeries */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Galeries</Text>

        <TouchableOpacity style={styles.galleryItem}>
          <View style={styles.galleryIcon}>
            <Text style={styles.galleryIconText}>📷</Text>
          </View>
          <View style={styles.galleryInfo}>
            <Text style={styles.galleryName}>Toutes les photos</Text>
            <Text style={styles.galleryCount}>{allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.galleryArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.galleryItem}>
          <View style={styles.galleryIcon}>
            <Text style={styles.galleryIconText}>📄</Text>
          </View>
          <View style={styles.galleryInfo}>
            <Text style={styles.galleryName}>Tous les documents</Text>
            <Text style={styles.galleryCount}>{allPdfs.length} document{allPdfs.length !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.galleryArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Photos du chat - Aperçu en grille */}
      {allPhotos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos récentes</Text>
          <View style={styles.photoGrid}>
            {allPhotos.slice(0, 6).map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoThumbnail}
                onPress={() => openPhotoViewer(photo.url)}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
            {allPhotos.length > 6 && (
              <View style={styles.photoMoreOverlay}>
                <Text style={styles.photoMoreText}>+{allPhotos.length - 6}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Section Documents avec catégories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddCategoryModal(true)}
          >
            <Text style={styles.addButtonText}>+ Catégorie</Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 && documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>Aucune catégorie de documents</Text>
            <Text style={styles.emptySubtext}>Créez une catégorie pour organiser vos documents</Text>
          </View>
        ) : (
          <>
            {/* Catégories */}
            {categories.map((category) => (
              <View key={category.id} style={styles.categoryCard}>
                <TouchableOpacity style={styles.categoryHeader}>
                  <View style={styles.categoryIcon}>
                    <Text style={styles.categoryIconText}>📂</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryCount}>
                      {getDocumentsForCategory(category.id).length} fichier(s)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.categoryAddBtn}
                    onPress={() => {
                      setSelectedCategoryId(category.id)
                      setShowAddDocumentModal(true)
                    }}
                  >
                    <Text style={styles.categoryAddBtnText}>+</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Documents dans la catégorie */}
                {getDocumentsForCategory(category.id).map((doc) => (
                  <TouchableOpacity key={doc.id} style={styles.documentItem}>
                    <Text style={styles.documentIcon}>
                      {doc.file_type === 'pdf' ? '📄' : '🖼️'}
                    </Text>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.file_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Documents sans catégorie */}
            {getUncategorizedDocuments().length > 0 && (
              <View style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryIcon}>
                    <Text style={styles.categoryIconText}>📁</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>Sans catégorie</Text>
                    <Text style={styles.categoryCount}>
                      {getUncategorizedDocuments().length} fichier(s)
                    </Text>
                  </View>
                </View>
                {getUncategorizedDocuments().map((doc) => (
                  <TouchableOpacity key={doc.id} style={styles.documentItem}>
                    <Text style={styles.documentIcon}>
                      {doc.file_type === 'pdf' ? '📄' : '🖼️'}
                    </Text>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.file_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Bouton ajouter sans catégorie */}
        <TouchableOpacity
          style={styles.addDocumentBtn}
          onPress={() => {
            setSelectedCategoryId(null)
            setShowAddDocumentModal(true)
          }}
        >
          <Text style={styles.addDocumentBtnText}>+ Ajouter un document</Text>
        </TouchableOpacity>
      </View>

      {/* Section Formulaires (grisée) */}
      <View style={[styles.section, styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, styles.textDisabled]}>Formulaires</Text>
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>🔒</Text>
          <Text style={styles.comingSoonText}>Prochainement disponible</Text>
        </View>
        <View style={styles.formulairesPreview}>
          <View style={styles.formulaireItem}>
            <Text style={[styles.formulaireIcon, styles.textDisabled]}>✓</Text>
            <Text style={[styles.formulaireName, styles.textDisabled]}>Tâches</Text>
          </View>
          <View style={styles.formulaireItem}>
            <Text style={[styles.formulaireIcon, styles.textDisabled]}>⚠️</Text>
            <Text style={[styles.formulaireName, styles.textDisabled]}>Aléas</Text>
          </View>
        </View>
      </View>

      {/* Modal visionneuse photo */}
      <Modal
        visible={showPhotoViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoViewer(false)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setShowPhotoViewer(false)}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Modal ajouter catégorie */}
      <Modal
        visible={showAddCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle catégorie</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nom de la catégorie (ex: Plans, DICT...)"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setNewCategoryName('')
                  setShowAddCategoryModal(false)
                }}
              >
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleAddCategory}
              >
                <Text style={styles.modalBtnConfirmText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal ajouter document */}
      <Modal
        visible={showAddDocumentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddDocumentModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddDocumentModal(false)}
        >
          <View style={styles.attachmentModal}>
            <Text style={styles.attachmentModalTitle}>Ajouter un document</Text>
            <TouchableOpacity style={styles.attachmentOption} onPress={handlePickDocument}>
              <Text style={styles.attachmentOptionIcon}>📄</Text>
              <Text style={styles.attachmentOptionText}>Document PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
              <Text style={styles.attachmentOptionIcon}>🖼️</Text>
              <Text style={styles.attachmentOptionText}>Image / Photo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Loading overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingBox}>
            <ActivityIndicator size="large" color="#64191E" />
            <Text style={styles.uploadingText}>Upload en cours...</Text>
          </View>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionDisabled: {
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textDisabled: {
    color: '#999',
  },
  addButton: {
    backgroundColor: '#64191E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Galeries
  galleryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  galleryIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  galleryIconText: {
    fontSize: 20,
  },
  galleryInfo: {
    flex: 1,
  },
  galleryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  galleryCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  galleryArrow: {
    fontSize: 20,
    color: '#ccc',
  },
  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnail: {
    width: photoSize,
    height: photoSize,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoMoreOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: photoSize,
    height: photoSize,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMoreText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Catégories et documents
  categoryCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 18,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#64191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryAddBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  documentIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  addDocumentBtn: {
    borderWidth: 1,
    borderColor: '#64191E',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addDocumentBtnText: {
    color: '#64191E',
    fontSize: 14,
    fontWeight: '500',
  },
  // Empty state
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
  // Formulaires section
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  comingSoonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  comingSoonText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  formulairesPreview: {
    gap: 8,
  },
  formulaireItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  formulaireIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  formulaireName: {
    fontSize: 14,
  },
  // Photo viewer modal
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerCloseText: {
    color: '#fff',
    fontSize: 24,
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  modalBtnConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#64191E',
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  attachmentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
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
  // Upload overlay
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#333',
  },
})
