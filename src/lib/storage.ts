/**
 * Storage module using AsyncStorage for persistent local storage
 * Compatible with Expo Go (unlike MMKV which requires native modules)
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

// In-memory cache for faster synchronous access
const memoryCache: Map<string, string> = new Map()

// Cache entry with metadata
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

/**
 * Initialize storage - load all keys into memory cache
 */
export async function initStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const filteredKeys = keys.filter(k => k.startsWith('revolt:'))
    if (filteredKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(filteredKeys)
      pairs.forEach(([key, value]) => {
        if (value) memoryCache.set(key, value)
      })
    }
    console.log(`[Storage] Initialized with ${memoryCache.size} cached items`)
  } catch (error) {
    console.error('[Storage] Error initializing:', error)
  }
}

/**
 * Get item from storage with automatic JSON parsing (sync from memory)
 */
export function getItem<T>(key: string): T | null {
  try {
    const prefixedKey = `revolt:${key}`
    const value = memoryCache.get(prefixedKey)
    if (!value) return null
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`[Storage] Error getting item ${key}:`, error)
    return null
  }
}

/**
 * Get item async (directly from AsyncStorage)
 */
export async function getItemAsync<T>(key: string): Promise<T | null> {
  try {
    const prefixedKey = `revolt:${key}`
    const value = await AsyncStorage.getItem(prefixedKey)
    if (!value) return null
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`[Storage] Error getting item async ${key}:`, error)
    return null
  }
}

/**
 * Set item in storage with automatic JSON serialization
 */
export function setItem<T>(key: string, value: T): void {
  try {
    const prefixedKey = `revolt:${key}`
    const stringValue = JSON.stringify(value)
    memoryCache.set(prefixedKey, stringValue)
    // Persist async (fire and forget)
    AsyncStorage.setItem(prefixedKey, stringValue).catch(err => {
      console.error(`[Storage] Error persisting item ${key}:`, err)
    })
  } catch (error) {
    console.error(`[Storage] Error setting item ${key}:`, error)
  }
}

/**
 * Set item async (wait for persistence)
 */
export async function setItemAsync<T>(key: string, value: T): Promise<void> {
  try {
    const prefixedKey = `revolt:${key}`
    const stringValue = JSON.stringify(value)
    memoryCache.set(prefixedKey, stringValue)
    await AsyncStorage.setItem(prefixedKey, stringValue)
  } catch (error) {
    console.error(`[Storage] Error setting item async ${key}:`, error)
  }
}

/**
 * Remove item from storage
 */
export function removeItem(key: string): void {
  try {
    const prefixedKey = `revolt:${key}`
    memoryCache.delete(prefixedKey)
    AsyncStorage.removeItem(prefixedKey).catch(err => {
      console.error(`[Storage] Error removing item ${key}:`, err)
    })
  } catch (error) {
    console.error(`[Storage] Error removing item ${key}:`, error)
  }
}

/**
 * Clear all revolt items from storage
 */
export async function clearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const revoltKeys = keys.filter(k => k.startsWith('revolt:'))
    if (revoltKeys.length > 0) {
      await AsyncStorage.multiRemove(revoltKeys)
    }
    memoryCache.clear()
  } catch (error) {
    console.error('[Storage] Error clearing storage:', error)
  }
}

/**
 * Get all keys matching a prefix
 */
export function getKeysByPrefix(prefix: string): string[] {
  try {
    const fullPrefix = `revolt:${prefix}`
    const keys: string[] = []
    memoryCache.forEach((_, key) => {
      if (key.startsWith(fullPrefix)) {
        keys.push(key.replace('revolt:', ''))
      }
    })
    return keys
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
  const prefixedKey = `revolt:${key}`
  return memoryCache.has(prefixedKey)
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
  news: () => `news:company`,
  companyNews: () => `news:company`,

  // Inventory
  supplierOrders: () => `inventory:supplier_orders`,
  inventoryItems: () => `inventory:items`,
}

// Dummy storage object for compatibility
export const storage = {
  getString: (key: string) => memoryCache.get(`revolt:${key}`),
  set: (key: string, value: string) => {
    memoryCache.set(`revolt:${key}`, value)
    AsyncStorage.setItem(`revolt:${key}`, value)
  },
  delete: (key: string) => {
    memoryCache.delete(`revolt:${key}`)
    AsyncStorage.removeItem(`revolt:${key}`)
  },
  contains: (key: string) => memoryCache.has(`revolt:${key}`),
  getAllKeys: () => Array.from(memoryCache.keys()).map(k => k.replace('revolt:', '')),
  clearAll: () => clearAll(),
}

export default storage
