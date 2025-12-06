import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Button from './Button'

interface NetworkErrorProps {
  onRetry?: () => void
  message?: string
}

export default function NetworkError({
  onRetry,
  message = 'Impossible de se connecter au serveur',
}: NetworkErrorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.title}>Erreur de connexion</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title="Réessayer"
          onPress={onRetry}
          variant="outline"
          style={styles.button}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f5f5f5',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    minWidth: 140,
  },
})
