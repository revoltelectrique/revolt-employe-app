/**
 * OfflineContext - Global provider for offline state management
 * Handles network detection, sync status, and pending mutations
 */

import React, { createContext, useContext, useEffect, useCallback, useState, ReactNode } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { useNetworkStatus } from '../lib/networkStatus'
import { useOfflineQueue, syncPendingMutations } from '../lib/offlineQueue'

// ==================== TYPES ====================

interface OfflineContextType {
  // Network state
  isOnline: boolean
  isInitialized: boolean

  // Sync state
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null

  // Actions
  syncNow: () => Promise<void>
  clearQueue: () => void
}

// ==================== CONTEXT ====================

const OfflineContext = createContext<OfflineContextType | undefined>(undefined)

// ==================== PROVIDER ====================

interface OfflineProviderProps {
  children: ReactNode
  // Auto-sync when coming back online
  autoSyncOnReconnect?: boolean
  // Auto-sync when app comes to foreground
  autoSyncOnForeground?: boolean
  // Sync interval in ms (0 = disabled)
  syncInterval?: number
}

export function OfflineProvider({
  children,
  autoSyncOnReconnect = true,
  autoSyncOnForeground = true,
  syncInterval = 0,
}: OfflineProviderProps) {
  const { isOnline, isInitialized } = useNetworkStatus()
  const { isSyncing, mutations, setIsSyncing, lastSyncAt, clearAllMutations } = useOfflineQueue()
  const [wasOffline, setWasOffline] = useState(false)

  const pendingCount = mutations.filter(
    (m) => m.status === 'pending' || m.status === 'failed'
  ).length

  // Sync function
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return

    console.log('[OfflineContext] Starting sync...')
    try {
      await syncPendingMutations()
    } catch (error) {
      console.error('[OfflineContext] Sync error:', error)
    }
  }, [isOnline, isSyncing])

  // Clear queue
  const clearQueue = useCallback(() => {
    clearAllMutations()
  }, [clearAllMutations])

  // Auto-sync when coming back online
  useEffect(() => {
    if (!autoSyncOnReconnect) return

    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline && isOnline && pendingCount > 0) {
      console.log('[OfflineContext] Back online, syncing pending mutations...')
      setWasOffline(false)
      syncNow()
    }
  }, [isOnline, wasOffline, pendingCount, syncNow, autoSyncOnReconnect])

  // Auto-sync when app comes to foreground
  useEffect(() => {
    if (!autoSyncOnForeground) return

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnline && pendingCount > 0) {
        console.log('[OfflineContext] App active, syncing pending mutations...')
        syncNow()
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription.remove()
    }
  }, [isOnline, pendingCount, syncNow, autoSyncOnForeground])

  // Periodic sync
  useEffect(() => {
    if (syncInterval <= 0) return

    const interval = setInterval(() => {
      if (isOnline && pendingCount > 0) {
        console.log('[OfflineContext] Periodic sync...')
        syncNow()
      }
    }, syncInterval)

    return () => clearInterval(interval)
  }, [syncInterval, isOnline, pendingCount, syncNow])

  // Initial sync on mount
  useEffect(() => {
    if (isInitialized && isOnline && pendingCount > 0) {
      console.log('[OfflineContext] Initial sync...')
      syncNow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized])

  const value: OfflineContextType = {
    isOnline,
    isInitialized,
    isSyncing,
    pendingCount,
    lastSyncAt,
    syncNow,
    clearQueue,
  }

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

// ==================== HOOK ====================

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext)
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}

export default OfflineContext
