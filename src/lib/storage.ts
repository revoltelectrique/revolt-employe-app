/**
 * Storage module using MMKV for fast, persistent local storage
 * Used for offline cache and sync queue
 */

import { MMKV } from 'react-native-mmkv'

// Create MMKV instance
export const storage = new MMKV({
  id: 'revolt-offline-storage',
})

// Cache entry with metadata
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

/**
 * Get item from storage with automatic JSON parsing
 */
export function getItem<T>(key: string): T | null {
  try {
    const value = storage.getString(key)
    if (!value) return null
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`[Storage] Error getting item ${key}:`, error)
    return null
  }
}

/**
 * Set item in storage with automatic JSON serialization
 */
export function setItem<T>(key: string, value: T): void {
  try {
    storage.set(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[Storage] Error setting item ${key}:`, error)
  }
}

/**
 * Remove item from storage
 */
export function removeItem(key: string): void {
  try {
    storage.delete(key)
  } catch (error) {
    console.error(`[Storage] Error removing item ${key}:`, error)
  }
}

/**
 * Clear all items from storage
 */
export function clearAll(): void {
  try {
    storage.clearAll()
  } catch (error) {
    console.error('[Storage] Error clearing storage:', error)
  }
}

/**
 * Get all keys matching a prefix
 */
export function getKeysByPrefix(prefix: string): string[] {
  try {
    const allKeys = storage.getAllKeys()
    return allKeys.filter(key => key.startsWith(prefix))
  } catch (error) {
    console.error(`[Storage] Error getting keys by prefix ${prefix}:`, error)
    return []
  }
}

// ==================== CACHE FUNCTIONS ====================

/**
 * Default TTL values in milliseconds
 */
export const CacheTTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes - for details
  MEDIUM: 5 * 60 * 1000,     // 5 minutes - for lists
  LONG: 30 * 60 * 1000,      // 30 minutes - for news
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours - for static data
}

/**
 * Set cached data with TTL
 */
export function setCachedData<T>(key: string, data: T, ttl: number = CacheTTL.MEDIUM): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  }
  setItem(key, entry)
}

/**
 * Get cached data if not expired
 * Returns null if cache is expired or not found
 */
export function getCachedData<T>(key: string): T | null {
  const entry = getItem<CacheEntry<T>>(key)
  if (!entry) return null

  const isExpired = Date.now() - entry.timestamp > entry.ttl
  if (isExpired) {
    // Don't delete - we might need stale data when offline
    return null
  }

  return entry.data
}

/**
 * Get cached data even if stale (for offline use)
 * Returns { data, isStale } or null if not found
 */
export function getStaleOrFreshData<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = getItem<CacheEntry<T>>(key)
  if (!entry) return null

  const isStale = Date.now() - entry.timestamp > entry.ttl
  return { data: entry.data, isStale }
}

/**
 * Check if cache entry exists (even if stale)
 */
export function hasCachedData(key: string): boolean {
  return storage.contains(key)
}

/**
 * Invalidate cache for a specific key
 */
export function invalidateCache(key: string): void {
  removeItem(key)
}

/**
 * Invalidate all cache entries matching a prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
  const keys = getKeysByPrefix(prefix)
  keys.forEach(key => removeItem(key))
}

// ==================== CACHE KEYS ====================

export const CacheKeys = {
  // User
  userProfile: (userId: string) => `user:profile:${userId}`,

  // Tasks
  tasksList: (userId: string) => `tasks:list:${userId}`,
  taskDetail: (taskId: string) => `task:detail:${taskId}`,

  // Conversations
  conversationsList: (userId: string) => `conversations:list:${userId}`,
  conversationDetail: (convId: string) => `conversation:detail:${convId}`,
  conversationMessages: (convId: string) => `conversation:messages:${convId}`,

  // Receipts
  receiptsList: (userId: string) => `receipts:list:${userId}`,
  receiptCategories: () => `receipts:categories`,

  // Requisitions
  requisitionsList: (userId: string) => `requisitions:list:${userId}`,
  requisitionDetail: (reqId: string) => `requisition:detail:${reqId}`,

  // Purchase Orders
  purchaseOrdersList: (userId: string) => `purchase_orders:list:${userId}`,
  purchaseOrderDetail: (poId: string) => `purchase_order:detail:${poId}`,

  // News
  companyNews: () => `news:company`,

  // Inventory
  supplierOrders: () => `inventory:supplier_orders`,
  inventoryItems: () => `inventory:items`,
}

export default storage
