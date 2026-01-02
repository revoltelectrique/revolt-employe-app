/**
 * useOfflineData - Hook for fetching data with offline cache support
 * Implements stale-while-revalidate and other caching strategies
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getCachedData,
  setCachedData,
  getStaleOrFreshData,
  CacheTTL,
  invalidateCache,
} from '../lib/storage'
import { useNetworkStore } from '../lib/networkStatus'

// ==================== TYPES ====================

export type CacheStrategy =
  | 'cache-first'        // Return cache if available, fetch in background
  | 'network-first'      // Try network first, fallback to cache
  | 'stale-while-revalidate' // Return stale cache immediately, revalidate in background
  | 'network-only'       // Never use cache

export interface UseOfflineDataOptions<T> {
  cacheKey: string
  ttl?: number
  strategy?: CacheStrategy
  enabled?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  // For dependent queries
  dependencies?: unknown[]
}

export interface UseOfflineDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  isStale: boolean
  isFromCache: boolean
  refetch: () => Promise<void>
  invalidate: () => void
}

// ==================== HOOK ====================

export function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  options: UseOfflineDataOptions<T>
): UseOfflineDataResult<T> {
  const {
    cacheKey,
    ttl = CacheTTL.MEDIUM,
    strategy = 'stale-while-revalidate',
    enabled = true,
    onSuccess,
    onError,
    dependencies = [],
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)

  const { isOnline } = useNetworkStore()
  const isMounted = useRef(true)
  const fetchInProgress = useRef(false)

  // Fetch from network
  const fetchFromNetwork = useCallback(async (): Promise<T | null> => {
    if (fetchInProgress.current) return null
    fetchInProgress.current = true

    try {
      const result = await fetchFn()

      if (isMounted.current) {
        setData(result)
        setError(null)
        setIsStale(false)
        setIsFromCache(false)

        // Update cache
        setCachedData(cacheKey, result, ttl)

        onSuccess?.(result)
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')

      if (isMounted.current) {
        setError(error)
        onError?.(error)
      }

      throw error
    } finally {
      fetchInProgress.current = false
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, cacheKey, ttl, onSuccess, onError])

  // Load from cache
  const loadFromCache = useCallback((): { data: T | null; isStale: boolean } => {
    const cached = getStaleOrFreshData<T>(cacheKey)
    if (cached) {
      return cached
    }
    return { data: null, isStale: false }
  }, [cacheKey])

  // Main fetch logic based on strategy
  const fetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)

    switch (strategy) {
      case 'cache-first': {
        // Return cache immediately if available
        const cached = loadFromCache()
        if (cached.data) {
          setData(cached.data)
          setIsStale(cached.isStale)
          setIsFromCache(true)
          setLoading(false)

          // Fetch in background if stale and online
          if (cached.isStale && isOnline) {
            fetchFromNetwork().catch(() => {})
          }
        } else if (isOnline) {
          // No cache, fetch from network
          await fetchFromNetwork().catch(() => {})
        } else {
          // Offline and no cache
          setLoading(false)
          setError(new Error('Pas de connexion et aucune donnée en cache'))
        }
        break
      }

      case 'network-first': {
        if (isOnline) {
          try {
            await fetchFromNetwork()
          } catch {
            // Network failed, try cache
            const cached = loadFromCache()
            if (cached.data) {
              setData(cached.data)
              setIsStale(true)
              setIsFromCache(true)
            }
            setLoading(false)
          }
        } else {
          // Offline, use cache
          const cached = loadFromCache()
          if (cached.data) {
            setData(cached.data)
            setIsStale(true)
            setIsFromCache(true)
          } else {
            setError(new Error('Pas de connexion et aucune donnée en cache'))
          }
          setLoading(false)
        }
        break
      }

      case 'stale-while-revalidate': {
        // Always return cache first (even if stale)
        const cached = loadFromCache()
        if (cached.data) {
          setData(cached.data)
          setIsStale(cached.isStale)
          setIsFromCache(true)
          setLoading(false)

          // Revalidate in background if online
          if (isOnline) {
            fetchFromNetwork().catch(() => {})
          }
        } else if (isOnline) {
          // No cache, must fetch
          await fetchFromNetwork().catch(() => setLoading(false))
        } else {
          // Offline and no cache
          setLoading(false)
          setError(new Error('Pas de connexion et aucune donnée en cache'))
        }
        break
      }

      case 'network-only': {
        if (isOnline) {
          await fetchFromNetwork().catch(() => setLoading(false))
        } else {
          setLoading(false)
          setError(new Error('Pas de connexion'))
        }
        break
      }
    }
  }, [enabled, strategy, loadFromCache, fetchFromNetwork, isOnline])

  // Refetch function exposed to consumers
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (isOnline) {
      try {
        await fetchFromNetwork()
      } catch {
        // Error already handled in fetchFromNetwork
      }
    } else {
      const cached = loadFromCache()
      if (cached.data) {
        setData(cached.data)
        setIsStale(true)
        setIsFromCache(true)
      }
      setLoading(false)
    }
  }, [isOnline, fetchFromNetwork, loadFromCache])

  // Invalidate cache
  const invalidate = useCallback(() => {
    invalidateCache(cacheKey)
    setData(null)
    setIsStale(false)
    setIsFromCache(false)
  }, [cacheKey])

  // Initial fetch
  useEffect(() => {
    isMounted.current = true
    fetch()

    return () => {
      isMounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...dependencies])

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && isStale && enabled) {
      fetchFromNetwork().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return {
    data,
    loading,
    error,
    isStale,
    isFromCache,
    refetch,
    invalidate,
  }
}

// ==================== SIMPLIFIED HOOKS ====================

/**
 * Simple hook for list data with stale-while-revalidate
 */
export function useOfflineList<T>(
  fetchFn: () => Promise<T[]>,
  cacheKey: string,
  dependencies: unknown[] = []
): UseOfflineDataResult<T[]> {
  return useOfflineData(fetchFn, {
    cacheKey,
    ttl: CacheTTL.MEDIUM,
    strategy: 'stale-while-revalidate',
    dependencies,
  })
}

/**
 * Simple hook for detail data with network-first
 */
export function useOfflineDetail<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  enabled: boolean = true
): UseOfflineDataResult<T> {
  return useOfflineData(fetchFn, {
    cacheKey,
    ttl: CacheTTL.SHORT,
    strategy: 'network-first',
    enabled,
  })
}

/**
 * Simple hook for static data with cache-first
 */
export function useOfflineStatic<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string
): UseOfflineDataResult<T> {
  return useOfflineData(fetchFn, {
    cacheKey,
    ttl: CacheTTL.VERY_LONG,
    strategy: 'cache-first',
  })
}

export default useOfflineData
