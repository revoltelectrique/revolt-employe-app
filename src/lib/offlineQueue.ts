/**
 * Offline Queue - Manages pending mutations when offline
 * Uses Zustand for state management with MMKV persistence
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storage } from './storage'
import { supabase } from './supabase'
import { checkIsOnline } from './networkStatus'

// ==================== TYPES ====================

export type MutationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'upload'

export type MutationTable =
  | 'tasks'
  | 'task_comments'
  | 'task_subtasks'
  | 'task_attachments'
  | 'purchase_orders'
  | 'purchase_order_items'
  | 'material_requests'
  | 'material_request_items'
  | 'receipts'
  | 'conversations'
  | 'conversation_messages'
  | 'message_attachments'
  | 'inventory_movements'

export type MutationStatus =
  | 'pending'
  | 'processing'
  | 'failed'
  | 'completed'

export interface PendingMutation {
  id: string
  type: MutationType
  table: MutationTable
  data: Record<string, unknown>
  tempId?: string // Temporary ID for optimistic updates
  relatedId?: string // Related entity ID (e.g., task_id for comments)
  status: MutationStatus
  retryCount: number
  maxRetries: number
  createdAt: number
  lastAttempt?: number
  error?: string
  // For file uploads
  fileUri?: string
  fileBucket?: string
  filePath?: string
}

interface OfflineQueueState {
  mutations: PendingMutation[]
  isSyncing: boolean
  lastSyncAt: number | null

  // Actions
  addMutation: (mutation: Omit<PendingMutation, 'id' | 'status' | 'retryCount' | 'createdAt'>) => string
  removeMutation: (id: string) => void
  updateMutationStatus: (id: string, status: MutationStatus, error?: string) => void
  clearCompletedMutations: () => void
  clearAllMutations: () => void
  setIsSyncing: (isSyncing: boolean) => void
  setLastSyncAt: (timestamp: number) => void

  // Getters
  getPendingCount: () => number
  getFailedMutations: () => PendingMutation[]
  getMutationsByTable: (table: MutationTable) => PendingMutation[]
}

// ==================== MMKV STORAGE ADAPTER ====================

const mmkvStorage = {
  getItem: (name: string): string | null => {
    const value = storage.getString(name)
    return value ?? null
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value)
  },
  removeItem: (name: string): void => {
    storage.delete(name)
  },
}

// ==================== ZUSTAND STORE ====================

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      mutations: [],
      isSyncing: false,
      lastSyncAt: null,

      addMutation: (mutation) => {
        const id = `mut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const newMutation: PendingMutation = {
          ...mutation,
          id,
          status: 'pending',
          retryCount: 0,
          maxRetries: mutation.maxRetries ?? 3,
          createdAt: Date.now(),
        }

        set((state) => ({
          mutations: [...state.mutations, newMutation],
        }))

        console.log(`[OfflineQueue] Added mutation: ${id} (${mutation.type} on ${mutation.table})`)
        return id
      },

      removeMutation: (id) => {
        set((state) => ({
          mutations: state.mutations.filter((m) => m.id !== id),
        }))
      },

      updateMutationStatus: (id, status, error) => {
        set((state) => ({
          mutations: state.mutations.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status,
                  error,
                  lastAttempt: Date.now(),
                  retryCount: status === 'failed' ? m.retryCount + 1 : m.retryCount,
                }
              : m
          ),
        }))
      },

      clearCompletedMutations: () => {
        set((state) => ({
          mutations: state.mutations.filter((m) => m.status !== 'completed'),
        }))
      },

      clearAllMutations: () => {
        set({ mutations: [] })
      },

      setIsSyncing: (isSyncing) => set({ isSyncing }),

      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

      getPendingCount: () => {
        return get().mutations.filter((m) => m.status === 'pending').length
      },

      getFailedMutations: () => {
        return get().mutations.filter((m) => m.status === 'failed')
      },

      getMutationsByTable: (table) => {
        return get().mutations.filter((m) => m.table === table)
      },
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        mutations: state.mutations,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
)

// ==================== SYNC FUNCTIONS ====================

/**
 * Process a single mutation
 */
async function processMutation(mutation: PendingMutation): Promise<boolean> {
  const { type, table, data, fileUri, fileBucket, filePath } = mutation

  try {
    switch (type) {
      case 'create': {
        const { error } = await supabase.from(table).insert(data)
        if (error) throw error
        break
      }

      case 'update': {
        const { id, ...updateData } = data as { id: string; [key: string]: unknown }
        const { error } = await supabase.from(table).update(updateData).eq('id', id)
        if (error) throw error
        break
      }

      case 'delete': {
        const { id } = data as { id: string }
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) throw error
        break
      }

      case 'upload': {
        if (!fileUri || !fileBucket || !filePath) {
          throw new Error('Missing file upload parameters')
        }
        // File upload logic would go here
        // This is complex and depends on expo-file-system
        console.log(`[OfflineQueue] File upload: ${filePath} to ${fileBucket}`)
        break
      }

      default:
        throw new Error(`Unknown mutation type: ${type}`)
    }

    return true
  } catch (error) {
    console.error(`[OfflineQueue] Mutation failed:`, error)
    throw error
  }
}

/**
 * Sync all pending mutations
 */
export async function syncPendingMutations(): Promise<{
  success: number
  failed: number
  remaining: number
}> {
  const store = useOfflineQueue.getState()

  // Check if already syncing
  if (store.isSyncing) {
    console.log('[OfflineQueue] Already syncing, skipping...')
    return { success: 0, failed: 0, remaining: store.getPendingCount() }
  }

  // Check network
  const isOnline = await checkIsOnline()
  if (!isOnline) {
    console.log('[OfflineQueue] Offline, skipping sync')
    return { success: 0, failed: 0, remaining: store.getPendingCount() }
  }

  store.setIsSyncing(true)
  console.log('[OfflineQueue] Starting sync...')

  let success = 0
  let failed = 0

  // Get pending mutations sorted by creation time
  const pendingMutations = store.mutations
    .filter((m) => m.status === 'pending' || (m.status === 'failed' && m.retryCount < m.maxRetries))
    .sort((a, b) => a.createdAt - b.createdAt)

  for (const mutation of pendingMutations) {
    store.updateMutationStatus(mutation.id, 'processing')

    try {
      await processMutation(mutation)
      store.updateMutationStatus(mutation.id, 'completed')
      success++
      console.log(`[OfflineQueue] Mutation ${mutation.id} completed`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      store.updateMutationStatus(mutation.id, 'failed', errorMessage)
      failed++
      console.error(`[OfflineQueue] Mutation ${mutation.id} failed:`, errorMessage)
    }
  }

  // Clean up completed mutations
  store.clearCompletedMutations()
  store.setIsSyncing(false)
  store.setLastSyncAt(Date.now())

  const remaining = store.getPendingCount()
  console.log(`[OfflineQueue] Sync complete: ${success} success, ${failed} failed, ${remaining} remaining`)

  return { success, failed, remaining }
}

/**
 * Retry failed mutations
 */
export async function retryFailedMutations(): Promise<void> {
  const store = useOfflineQueue.getState()
  const failedMutations = store.getFailedMutations()

  for (const mutation of failedMutations) {
    if (mutation.retryCount < mutation.maxRetries) {
      store.updateMutationStatus(mutation.id, 'pending')
    }
  }

  await syncPendingMutations()
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a temporary ID for optimistic updates
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if an ID is a temporary ID
 */
export function isTempId(id: string): boolean {
  return id.startsWith('temp_')
}

export default useOfflineQueue
