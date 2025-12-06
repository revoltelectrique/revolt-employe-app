export type UserRole = 'admin' | 'contremaitre' | 'employe' | 'client'

export type PurchaseOrderStatus = 'en_attente' | 'traite'
export type MaterialRequestStatus = 'en_attente' | 'traite'
export type NewsCategory = 'info' | 'urgent' | 'evenement'

export interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  organization_id: string | null
  role: UserRole
  can_view_client_portal: boolean
  created_at: string
  expo_push_token?: string | null
}

export interface PurchaseOrder {
  id: string
  po_number: string
  requester_id: string
  supplier_name: string
  is_billable: boolean
  servicentre_call_number: string | null
  client_name: string | null
  attachment_url: string | null
  status: PurchaseOrderStatus
  created_at: string
  updated_at: string
  requester?: { email: string; first_name?: string; last_name?: string }
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  description: string
  quantity: number
  price: number | null
  created_at: string
}

export interface MaterialRequest {
  id: string
  request_number: string
  requester_id: string
  client_name: string
  servicentre_call_number: string
  delivery_location: string
  special_notes: string | null
  status: MaterialRequestStatus
  created_at: string
  updated_at: string
  requester?: { email: string; first_name?: string; last_name?: string }
  items?: MaterialRequestItem[]
}

export interface MaterialRequestItem {
  id: string
  material_request_id: string
  description: string
  quantity: number
  attachment_url: string | null
  created_at: string
}

export interface CompanyNews {
  id: string
  title: string
  content: string
  category: NewsCategory
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  created_by: string
}

// =============================================
// CONVERSATION CHANTIER
// =============================================

export type ConversationStatus = 'ouverte' | 'fermee' | 'archivee'
export type MessageType = 'observation' | 'probleme' | 'directive' | 'materiel' | 'general'
export type AttachmentType = 'photo' | 'video' | 'pdf' | 'audio'

export interface Conversation {
  id: string
  servicentre_number: string
  client_name: string
  location: string | null
  description: string | null
  status: ConversationStatus
  created_by: string
  created_at: string
  updated_at: string
  closed_at: string | null
  closed_by: string | null
  // Relations
  creator?: { email: string; first_name?: string; last_name?: string }
  last_message?: ConversationMessage
  unread_count?: number
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  author_id: string
  message_type: MessageType
  content: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  // Relations
  author?: { id: string; email: string; first_name?: string; last_name?: string }
  attachments?: MessageAttachment[]
  mentions?: ConversationMention[]
}

export interface MessageAttachment {
  id: string
  message_id: string
  file_type: AttachmentType
  file_url: string
  file_name: string | null
  file_size: number | null
  thumbnail_url: string | null
  duration: number | null
  width: number | null
  height: number | null
  latitude: number | null
  longitude: number | null
  captured_at: string | null
  created_at: string
}

export interface ConversationMention {
  id: string
  message_id: string
  mentioned_user_id: string
  notified: boolean
  created_at: string
  mentioned_user?: { email: string; first_name?: string; last_name?: string }
}

export interface ConversationLinkedItem {
  id: string
  conversation_id: string
  item_type: 'purchase_order' | 'material_request'
  item_id: string
  linked_at: string
  linked_by: string | null
}

// =============================================
// TÂCHES
// =============================================

export type TaskStatus = 'a_faire' | 'en_cours' | 'termine' | 'bloque' | 'annule'
export type TaskPriority = 'basse' | 'normale' | 'haute' | 'urgente'

export interface Task {
  id: string
  task_number: string
  title: string
  description: string | null
  created_by: string
  assigned_to: string | null
  status: TaskStatus
  priority: TaskPriority
  linked_requisition_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  // Relations
  creator?: { id: string; email: string; first_name?: string; last_name?: string }
  assignee?: { id: string; email: string; first_name?: string; last_name?: string }
  linked_requisition?: { id: string; request_number: string; client_name: string }
  subtasks?: TaskSubtask[]
  comments?: TaskComment[]
  attachments?: TaskAttachment[]
}

export interface TaskSubtask {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  position: number
  created_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: { id: string; email: string; first_name?: string; last_name?: string }
}

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  created_at: string
}

// =============================================
// COMMENTAIRES DE DOCUMENTS (BC & Réquisitions)
// =============================================

export type DocumentType = 'purchase_order' | 'material_request'

export interface DocumentComment {
  id: string
  document_type: DocumentType
  document_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: { id: string; email: string; first_name?: string; last_name?: string }
}
