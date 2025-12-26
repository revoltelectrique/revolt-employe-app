import React, { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native'
import * as Notifications from 'expo-notifications'

import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import { registerForPushNotificationsAsync, savePushToken } from './src/lib/notifications'
import LoginScreen from './src/screens/LoginScreen'
import HomeScreen from './src/screens/HomeScreen'
import BonsCommandeScreen from './src/screens/BonsCommandeScreen'
import RequisitionsScreen from './src/screens/RequisitionsScreen'
import NouveauBCScreen from './src/screens/NouveauBCScreen'
import NouvelleRequisitionScreen from './src/screens/NouvelleRequisitionScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import DetailsBCScreen from './src/screens/DetailsBCScreen'
import DetailsRequisitionScreen from './src/screens/DetailsRequisitionScreen'
import ConversationsListScreen from './src/screens/ConversationsListScreen'
import NouvelleConversationScreen from './src/screens/NouvelleConversationScreen'
import ConversationDetailScreen from './src/screens/ConversationDetailScreen'
import ModifierRequisitionScreen from './src/screens/ModifierRequisitionScreen'
import ModifierBCScreen from './src/screens/ModifierBCScreen'
import TachesScreen from './src/screens/TachesScreen'
import DetailsTacheScreen from './src/screens/DetailsTacheScreen'
import NouvelleTacheScreen from './src/screens/NouvelleTacheScreen'
import MesRecusScreen from './src/screens/MesRecusScreen'
import NouveauRecuScreen from './src/screens/NouveauRecuScreen'
import DetailsRecuScreen from './src/screens/DetailsRecuScreen'
import CommandesFournisseursScreen from './src/screens/CommandesFournisseursScreen'
import DetailsCommandeSupplierScreen from './src/screens/DetailsCommandeSupplierScreen'
import ScanQRScreen from './src/screens/ScanQRScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Accueil: '🏠',
    Tâches: '✓',
    Chantiers: '💬',
    'Bons de commande': '📄',
    Réquisitions: '📦',
    Reçus: '🧾',
    Commandes: '🚚',
    Profil: '👤',
  }
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[name] || '📋'}
    </Text>
  )
}

function MainTabs() {
  const { profile } = useAuth()

  // Admin a acces a tout
  const isAdmin = profile?.role === 'admin'

  // Permissions (admin = tout, sinon verifier les permissions)
  const canAccessTasks = isAdmin || profile?.can_access_tasks
  const canAccessConversations = isAdmin || profile?.can_access_conversations
  const canAccessRequisitions = isAdmin || profile?.can_access_requisitions
  const canAccessReceipts = isAdmin || profile?.can_access_receipts
  const canAccessInventory = isAdmin || profile?.can_access_inventory

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#64191E',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle: { backgroundColor: '#64191E' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      {canAccessTasks && (
        <Tab.Screen
          name="Tâches"
          component={TachesScreen}
          options={{ title: 'Mes tâches' }}
        />
      )}
      {canAccessConversations && (
        <Tab.Screen
          name="Chantiers"
          component={ConversationsListScreen}
          options={{ title: 'Chantiers' }}
        />
      )}
      {canAccessRequisitions && (
        <Tab.Screen
          name="Réquisitions"
          component={RequisitionsScreen}
          options={{ title: 'Réquisitions' }}
        />
      )}
      {canAccessReceipts && (
        <Tab.Screen
          name="Reçus"
          component={MesRecusScreen}
          options={{ title: 'Mes reçus' }}
        />
      )}
      {canAccessInventory && (
        <Tab.Screen
          name="Commandes"
          component={CommandesFournisseursScreen}
          options={{ title: 'Commandes fournisseurs' }}
        />
      )}
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  )
}

function AppNavigator({ navigationRef }: { navigationRef: any }) {
  const { session, loading, isEmployee, user } = useAuth()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  // Configuration des notifications push
  useEffect(() => {
    if (session && user?.id && isEmployee) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          savePushToken(user.id, token)
        }
      })

      // Listener pour les notifications reçues
      notificationListener.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log('Notification reçue:', notification)
        }
      )

      // Listener pour les réponses aux notifications (quand on clique)
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log('Réponse notification:', response)
          const data = response.notification.request.content.data

          // Naviguer vers la conversation si c'est une notification de message
          if (data?.type === 'conversation_message' && data?.conversationId) {
            navigationRef.current?.navigate('ConversationChat', {
              conversationId: data.conversationId,
            })
          }
        }
      )

      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current)
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current)
        }
      }
    }
  }, [session, user?.id, isEmployee, navigationRef])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#64191E" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    )
  }

  // Si pas connecté ou pas employé -> Login
  if (!session || !isEmployee) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    )
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#64191E' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Retour',
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NouveauBC"
        component={NouveauBCScreen}
        options={{ title: 'Nouveau bon de commande' }}
      />
      <Stack.Screen
        name="NouvelleRequisition"
        component={NouvelleRequisitionScreen}
        options={{ title: 'Nouvelle réquisition' }}
      />
      <Stack.Screen
        name="DetailsBC"
        component={DetailsBCScreen}
        options={{ title: 'Détails du BC' }}
      />
      <Stack.Screen
        name="DetailsRequisition"
        component={DetailsRequisitionScreen}
        options={{ title: 'Détails de la réquisition' }}
      />
      <Stack.Screen
        name="NouvelleConversation"
        component={NouvelleConversationScreen}
        options={{ title: 'Nouvelle conversation' }}
      />
      <Stack.Screen
        name="ConversationChat"
        component={ConversationDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ModifierRequisition"
        component={ModifierRequisitionScreen}
        options={{ title: 'Modifier la réquisition' }}
      />
      <Stack.Screen
        name="ModifierBC"
        component={ModifierBCScreen}
        options={{ title: 'Modifier le BC' }}
      />
      <Stack.Screen
        name="DetailsTache"
        component={DetailsTacheScreen}
        options={{ title: 'Détails de la tâche' }}
      />
      <Stack.Screen
        name="NouvelleTache"
        component={NouvelleTacheScreen}
        options={{ title: 'Nouvelle tâche' }}
      />
      <Stack.Screen
        name="BonsCommande"
        component={BonsCommandeScreen}
        options={{ title: 'Bons de commande' }}
      />
      <Stack.Screen
        name="NouveauRecu"
        component={NouveauRecuScreen}
        options={{ title: 'Nouveau reçu' }}
      />
      <Stack.Screen
        name="DetailsRecu"
        component={DetailsRecuScreen}
        options={{ title: 'Détails du reçu' }}
      />
      <Stack.Screen
        name="DetailsCommandeSupplier"
        component={DetailsCommandeSupplierScreen}
        options={{ title: 'Détails de la commande' }}
      />
      <Stack.Screen
        name="ScanQR"
        component={ScanQRScreen}
        options={{ title: 'Scanner QR code' }}
      />
    </Stack.Navigator>
  )
}

export default function App() {
  const navigationRef = useNavigationContainerRef()

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        <AppNavigator navigationRef={navigationRef} />
      </NavigationContainer>
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
})
