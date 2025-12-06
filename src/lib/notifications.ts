import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null

  // Vérifier si c'est un appareil physique
  if (!Device.isDevice) {
    console.log('Les notifications push nécessitent un appareil physique')
    return null
  }

  // Vérifier les permissions existantes
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  // Demander les permissions si pas encore accordées
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permission de notification refusée')
    return null
  }

  // Obtenir le token Expo Push
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'fd220489-4272-42e4-968f-c12d9f9e8711',
    })
    token = pushToken.data
    console.log('Push token:', token)
  } catch (error) {
    console.error('Erreur obtention token:', error)
    return null
  }

  // Configuration spécifique Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#64191E',
    })
  }

  return token
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId)

    if (error) throw error
    console.log('Token push sauvegardé')
  } catch (error) {
    console.error('Erreur sauvegarde token:', error)
  }
}

export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: null })
      .eq('id', userId)

    if (error) throw error
  } catch (error) {
    console.error('Erreur suppression token:', error)
  }
}

// Envoyer une notification (côté serveur normalement, mais utile pour tests)
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
}

// Notifier les employés d'un nouveau message dans une conversation
export async function notifyConversationMessage(
  conversationId: string,
  conversationName: string,
  senderName: string,
  messagePreview: string,
  senderId: string,
  mentionedUserIds?: string[]
): Promise<void> {
  try {
    // Récupérer tous les tokens des employés (sauf l'expéditeur)
    const { data: employees, error } = await supabase
      .from('users')
      .select('id, expo_push_token, first_name')
      .in('role', ['employe', 'employé', 'contremaitre', 'contremaître', 'admin'])
      .neq('id', senderId)
      .not('expo_push_token', 'is', null)

    if (error) throw error
    if (!employees || employees.length === 0) return

    // Envoyer les notifications
    const notifications = employees.map(async (employee) => {
      if (!employee.expo_push_token) return

      // Vérifier si l'employé est mentionné
      const isMentioned = mentionedUserIds?.includes(employee.id)
      const title = isMentioned
        ? `${senderName} vous a mentionné`
        : `Nouveau message - ${conversationName}`
      const body = messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : '')

      await sendPushNotification(employee.expo_push_token, title, body, {
        type: 'conversation_message',
        conversationId,
        isMentioned,
      })
    })

    await Promise.allSettled(notifications)
  } catch (error) {
    console.error('Erreur notification conversation:', error)
  }
}
