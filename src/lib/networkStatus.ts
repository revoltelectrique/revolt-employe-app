/**
 * Network status detection using NetInfo
 * Provides hooks and utilities for online/offline detection
 */

import { useEffect, useState, useCallback } from 'react'
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo'
import { create } from 'zustand'

// ==================== ZUSTAND STORE ====================

interface NetworkState {
  isOnline: boolean
  isInternetReachable: boolean | null
  connectionType: string | null
  setNetworkState: (state: Partial<NetworkState>) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true, // Assume online initially
  isInternetReachable: null,
  connectionType: null,
  setNetworkState: (state) => set(state),
}))

// ==================== HOOK ====================

/**
 * Hook to get current network status
 * Subscribes to network changes and updates automatically
 */
export function useNetworkStatus() {
  const { isOnline, isInternetReachable, connectionType, setNetworkState } = useNetworkStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    let subscription: NetInfoSubscription

    const handleNetworkChange = (state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false

      setNetworkState({
        isOnline: online,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      })

      if (!isInitialized) {
        setIsInitialized(true)
      }
    }

    // Get initial state
    NetInfo.fetch().then(handleNetworkChange)

    // Subscribe to changes
    subscription = NetInfo.addEventListener(handleNetworkChange)

    return () => {
      subscription()
    }
  }, [setNetworkState, isInitialized])

  return {
    isOnline,
    isInternetReachable,
    connectionType,
    isInitialized,
  }
}

// ==================== UTILITIES ====================

/**
 * Check if currently online (one-time check)
 */
export async function checkIsOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return state.isConnected === true && state.isInternetReachable !== false
  } catch (error) {
    console.error('[NetworkStatus] Error checking network:', error)
    return false
  }
}

/**
 * Wait for network to become available
 * Returns true when online, or false after timeout
 */
export function waitForNetwork(timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      subscription()
      resolve(false)
    }, timeoutMs)

    const subscription = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        clearTimeout(timeout)
        subscription()
        resolve(true)
      }
    })

    // Check immediately
    NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable) {
        clearTimeout(timeout)
        subscription()
        resolve(true)
      }
    })
  })
}

/**
 * Subscribe to network changes
 * Returns unsubscribe function
 */
export function onNetworkChange(
  callback: (isOnline: boolean) => void
): () => void {
  const subscription = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false
    callback(isOnline)
  })

  return subscription
}

export default useNetworkStatus
