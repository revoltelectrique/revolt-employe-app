import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

type BadgeVariant = 'pending' | 'success' | 'danger' | 'info' | 'warning'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  success: { bg: '#D1FAE5', text: '#059669' },
  danger: { bg: '#FEE2E2', text: '#DC2626' },
  info: { bg: '#DBEAFE', text: '#2563EB' },
  warning: { bg: '#FED7AA', text: '#EA580C' },
}

export default function Badge({ label, variant = 'info' }: BadgeProps) {
  const colors = variantStyles[variant]

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
})
