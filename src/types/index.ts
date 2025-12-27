export type UserRole = 'admin' | 'contremaitre' | 'employe' | 'client' | 'entrepot'

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
  // Permissions modules
  can_access_purchase_orders: boolean
  can_access_requisitions: boolean
  can_access_inventory: boolean
  can_access_tasks: boolean
  can_access_conversations: boolean
  can_access_receipts: boolean
  can_access_erp_beta: boolean
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

// =============================================
// REÇUS D'ACHAT
// =============================================

export type ReceiptStatus = 'en_attente' | 'approuve' | 'refuse'
export type PaymentMethod = 'carte_credit' | 'carte_debit' | 'cash'

export interface ReceiptCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Receipt {
  id: string
  receipt_number: string
  submitted_by: string
  submission_date: string
  vendor_name: string | null
  receipt_date: string | null
  receipt_reference: string | null
  subtotal: number | null
  tax_amount: number | null
  total_amount: number
  category_id: string | null
  payment_method: PaymentMethod
  project_name: string | null
  notes: string | null
  image_url: string
  ocr_raw_data: Record<string, unknown> | null
  ocr_confidence: number | null
  is_manually_entered: boolean
  status: ReceiptStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // Relations
  category?: ReceiptCategory
}

// Interface pour les données OCR extraites
export interface OCRData {
  vendor_name: string | null
  subtotal: number | null
  tax_amount: number | null
  total_amount: number | null
  receipt_date: string | null
  receipt_reference: string | null
  raw_text: string
  confidence: number
}

// =============================================
// MODULE INVENTAIRE
// =============================================

export type InventoryItemStatus =
  | 'en_stock'
  | 'reserve'
  | 'en_transit'
  | 'sur_chantier'
  | 'utilise'
  | 'retourne'
  | 'perdu'
  | 'defectueux'

export type InventoryMovementType =
  | 'reception'
  | 'transfert'
  | 'sortie'
  | 'utilisation'
  | 'retour'
  | 'ajustement'
  | 'perte'
  | 'defectueux'

export type KitStatus = 'brouillon' | 'pret' | 'en_transit' | 'sur_chantier' | 'utilise' | 'partiel'

export type SupplierOrderStatus = 'en_attente' | 'partiel' | 'recu' | 'annule'

export interface Supplier {
  id: string
  name: string
  display_name: string
  is_active: boolean
}

export interface Product {
  id: string
  sku: string | null
  name: string
  description: string | null
  category: string | null
  default_unit: string
}

export interface SupplierOrder {
  id: string
  purchase_order_id: string | null
  supplier_id: string | null
  supplier_order_number: string | null
  po_reference: string | null
  servicentre_call_number: string | null
  client_name: string | null
  status: SupplierOrderStatus
  expected_delivery_date: string | null
  delivery_location: string
  created_at: string
  supplier?: Supplier
  items?: SupplierOrderItem[]
}

export interface SupplierOrderItem {
  id: string
  order_id: string
  supplier_sku: string | null
  description: string
  quantity_ordered: number
  quantity_received: number
  unit_price: number | null
  unit: string
  product?: Product
}

export interface InventoryItem {
  id: string
  qr_code: string
  supplier_order_item_id: string | null
  product_id: string | null
  servicentre_call_number: string | null
  client_name: string | null
  purchase_order_id: string | null
  description: string
  quantity: number
  unit: string
  unit_cost: number | null
  location: string
  storage_zone: string | null
  status: InventoryItemStatus
  photo_url: string | null
  label_printed: boolean
  created_at: string
  updated_at: string
  product?: Product
  purchase_order?: { id: string; po_number: string }
}

export interface InventoryMovement {
  id: string
  inventory_item_id: string
  movement_type: InventoryMovementType
  from_location: string | null
  to_location: string | null
  quantity: number | null
  servicentre_call_number: string | null
  client_name: string | null
  performed_by: string
  gps_latitude: number | null
  gps_longitude: number | null
  photo_url: string | null
  notes: string | null
  created_at: string
  performer?: { id: string; email: string; first_name?: string; last_name?: string }
}

export interface Kit {
  id: string
  qr_code: string
  name: string
  description: string | null
  servicentre_call_number: string | null
  client_name: string | null
  status: KitStatus
  location: string
  label_printed: boolean
  created_at: string
  items?: KitItem[]
}

export interface KitItem {
  id: string
  kit_id: string
  inventory_item_id: string
  quantity: number
  inventory_item?: InventoryItem
}

export interface InventoryLocation {
  id: string
  code: string
  name: string
  city: string | null
  is_warehouse: boolean
  is_active: boolean
}

// Type pour le contenu scanne du QR code
export interface ScannedQRContent {
  t: 'inv' | 'kit'  // type: inventory_item ou kit
  id: string        // UUID de l'item
  q: string         // QR code lisible (INV-... ou KIT-...)
}

// Type pour les actions apres scan
export type ScanAction =
  | 'view_details'
  | 'confirm_receipt'
  | 'checkout_to_site'
  | 'confirm_use'
  | 'return_to_inventory'
  | 'report_issue'

export interface ScanActionOption {
  action: ScanAction
  label: string
  icon: string
  available: boolean
  description?: string
}

// Type pour creer un mouvement depuis l'app mobile
export interface CreateMovementInput {
  inventory_item_id: string
  movement_type: InventoryMovementType
  to_location?: string
  servicentre_call_number?: string
  client_name?: string
  quantity?: number
  gps_latitude?: number
  gps_longitude?: number
  photo_url?: string
  notes?: string
}

// =============================================
// MODULE ERP BETA
// =============================================

export type ErpServiceCallStatus = 'ouvert' | 'en_cours' | 'termine' | 'facture' | 'annule'
export type ErpServiceCallPriority = 'normale' | 'urgente' | 'planifiee'
export type ErpRateType = 'regulier' | 'temps_demi' | 'double' | 'forfait'

export const ERP_LOCATIONS = [
  'Forestville',
  'Pessamit',
  'Baie-Comeau',
  'Fermont',
  'Riviere-du-Loup',
] as const

export const ERP_RATES: { value: ErpRateType; label: string; multiplier: number }[] = [
  { value: 'regulier', label: 'Régulier', multiplier: 1 },
  { value: 'temps_demi', label: 'Temps et demi', multiplier: 1.5 },
  { value: 'double', label: 'Temps double', multiplier: 2 },
  { value: 'forfait', label: 'Forfait', multiplier: 1 },
]

export interface ErpClient {
  id: string
  numero: string
  nom: string
  adresse: string | null
  ville: string | null
  province: string | null
  code_postal: string | null
  telephone: string | null
  courriel: string | null
  type: 'principal' | 'succursale' | 'contact'
  est_principal: boolean
  synced_at: string | null
}

export interface ErpServiceCall {
  id: string
  numero: number
  client_facture_a_id: string | null
  client_effectue_pour_id: string | null
  localisation: string | null
  description: string | null
  statut: ErpServiceCallStatus
  priorite: ErpServiceCallPriority
  taux_applicable: ErpRateType
  po_client: string | null
  created_by: string
  created_at: string
  updated_at: string
  closed_at: string | null
  // Relations
  client_facture_a?: ErpClient
  client_effectue_pour?: ErpClient
  creator?: { id: string; email: string; first_name?: string; last_name?: string }
  segments?: ErpWorkOrderSegment[]
  time_entries?: ErpTimeEntry[]
  materials?: ErpMaterial[]
}

export interface ErpWorkOrderSegment {
  id: string
  service_call_id: string
  segment_number: number
  description: string | null
  created_at: string
}

export interface ErpTimeEntry {
  id: string
  service_call_id: string
  segment_id: string | null
  employee_id: string
  work_date: string
  hours: number
  rate_type: ErpRateType
  rate_multiplier: number
  description: string | null
  created_at: string
  updated_at: string
  // Relations
  employee?: { id: string; email: string; first_name?: string; last_name?: string }
  segment?: ErpWorkOrderSegment
}

export interface ErpMaterial {
  id: string
  service_call_id: string
  segment_id: string | null
  product_code: string
  description: string
  quantity: number
  unit_price: number
  created_at: string
  // Relations
  segment?: ErpWorkOrderSegment
}

// Produit Avantage (inventaire)
export interface AvantageProduct {
  id: string
  code: string
  description: string
  prix_coutant: number
  prix_vente: number
  unite: string
  categorie: string | null
  fournisseur: string | null
  quantite_stock: number
  gl_ventes: string | null
  gl_stock: string | null
  gl_achats: string | null
  taxable_federal: boolean
  taxable_provincial: boolean
  localisation: string | null
  code_fabricant: string | null
  synced_at: string | null
}

// Input pour creer un appel de service
export interface CreateErpServiceCallInput {
  client_facture_a_id: string
  client_effectue_pour_id?: string
  localisation: string
  description: string
  priorite: ErpServiceCallPriority
  taux_applicable: ErpRateType
  po_client?: string
}

// Input pour ajouter du temps
export interface CreateErpTimeEntryInput {
  service_call_id: string
  segment_id?: string
  employee_id: string
  work_date: string
  hours: number
  rate_type: ErpRateType
  description?: string
}

// Input pour ajouter du materiel
export interface CreateErpMaterialInput {
  service_call_id: string
  segment_id?: string
  product_code: string
  description: string
  quantity: number
  unit_price: number
}
