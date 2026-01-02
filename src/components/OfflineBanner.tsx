/**
 * OfflineBanner - Visual indicator for offline status
 * Shows when device is offline and displays pending sync count
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useOffline } from '../contexts/OfflineContext'

interface OfflineBannerProps {
  // Position of the banner
  position?: 'top' | 'bottom'
  // Show pending count
  showPendingCount?: boolean
  // Custom style
  style?: object
}

export function OfflineBanner({
  position = 'top',
  showPendingCount = true,
  style,
}: OfflineBannerProps) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline()
  const slideAnim = useRef(new Animated.Value(-60)).current
  const isVisible = !isOnline || isSyncing || pendingCount > 0

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isVisible, slideAnim])

  if (!isVisible) {
    return null
  }

  const getBannerContent = () => {
    if (!isOnline) {
      return {
        icon: '📡',
        text: 'Mode hors ligne',
        subtext: pendingCount > 0 ? `${pendingCount} en attente` : undefined,
        color: '#EF4444',
        bgColor: '#FEE2E2',
      }
    }

    if (isSyncing) {
      return {
        icon: '🔄',
        text: 'Synchronisation...',
        subtext: undefined,
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        showSpinner: true,
      }
    }

    if (pendingCount > 0) {
      return {
        icon: '⏳',
        text: `${pendingCount} modification${pendingCount > 1 ? 's' : ''} en attente`,
        subtext: 'Touchez pour synchroniser',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        onPress: syncNow,
      }
    }

    return null
  }

  const content = getBannerContent()
  if (!content) return null

  const Banner = (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' && styles.containerBottom,
        { backgroundColor: content.bgColor, transform: [{ translateY: slideAnim }] },
        style,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{content.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.text, { color: content.color }]}>{content.text}</Text>
          {content.subtext && showPendingCount && (
            <Text style={[styles.subtext, { color: content.color }]}>{content.subtext}</Text>
          )}
        </View>
        {content.showSpinner && (
          <ActivityIndicator size="small" color={content.color} style={styles.spinner} />
        )}
      </View>
    </Animated.View>
  )

  if (content.onPress) {
    return (
      <TouchableOpacity onPress={content.onPress} activeOpacity={0.8}>
        {Banner}
      </TouchableOpacity>
    )
  }

  return Banner
}

// ==================== COMPACT VERSION ====================

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount } = useOffline()

  if (isOnline && !isSyncing && pendingCount === 0) {
    return null
  }

  return (
    <View style={styles.indicator}>
      {!isOnline && (
        <View style={[styles.dot, styles.dotOffline]} />
      )}
      {isSyncing && (
        <ActivityIndicator size="small" color="#3B82F6" />
      )}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <View style={[styles.dot, styles.dotPending]}>
          <Text style={styles.dotText}>{pendingCount}</Text>
        </View>
      )}
    </View>
  )
}

// ==================== SYNC BUTTON ====================

interface SyncButtonProps {
  style?: object
}

export function SyncButton({ style }: SyncButtonProps) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline()

  if (!isOnline || pendingCount === 0) {
    return null
  }

  return (
    <TouchableOpacity
      style={[styles.syncButton, style]}
      onPress={syncNow}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Text style={styles.syncIcon}>🔄</Text>
          <Text style={styles.syncText}>{pendingCount}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  containerBottom: {
    top: undefined,
    bottom: 0,
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtext: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  spinner: {
    marginLeft: 8,
  },

  // Indicator styles
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  dotPending: {
    backgroundColor: '#F59E0B',
  },
  dotText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Sync button styles
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#64191E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  syncText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})

export default OfflineBanner
