import React, { useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import {
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  TouchableWithoutFeedback
} from 'react-native'
import * as Notifications from 'expo-notifications'

import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import { OfflineProvider } from './src/contexts/OfflineContext'
import { OfflineBanner } from './src/components/OfflineBanner'
import { registerForPushNotificationsAsync, savePushToken } from './src/lib/notifications'
import { initStorage } from './src/lib/storage'
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
// ERP Beta
import ErpHomeScreen from './src/screens/ErpHomeScreen'
import ErpAppelsScreen from './src/screens/ErpAppelsScreen'
import ErpNouvelAppelScreen from './src/screens/ErpNouvelAppelScreen'
import ErpDetailsAppelScreen from './src/screens/ErpDetailsAppelScreen'
import ErpFeuilleTempsScreen from './src/screens/ErpFeuilleTempsScreen'
import ErpInventaireScreen from './src/screens/ErpInventaireScreen'
// Inspections / Formulaires
import InspectionsScreen from './src/screens/InspectionsScreen'
import NouvelleInspectionScreen from './src/screens/NouvelleInspectionScreen'
import DetailsInspectionScreen from './src/screens/DetailsInspectionScreen'
import NouvelleInspectionElectriqueScreen from './src/screens/NouvelleInspectionElectriqueScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8

// Context pour le drawer
const DrawerContext = React.createContext<{
  openDrawer: () => void
  closeDrawer: () => void
}>({
  openDrawer: () => {},
  closeDrawer: () => {},
})

// Icônes pour les onglets principaux
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Accueil: '🏠',
    Tâches: '✓',
    Chantiers: '💬',
    Profil: '👤',
  }
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[name] || '📋'}
    </Text>
  )
}

// Menu drawer personnalisé (sans dépendances natives)
function CustomDrawer({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) {
  const { profile, signOut } = useAuth()
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [visible])

  const isAdmin = profile?.role === 'admin'
  const canAccessTasks = isAdmin || profile?.can_access_tasks
  const canAccessConversations = isAdmin || profile?.can_access_conversations
  const canAccessRequisitions = isAdmin || profile?.can_access_requisitions
  const canAccessReceipts = isAdmin || profile?.can_access_receipts
  const canAccessInventory = isAdmin || profile?.can_access_inventory
  const canAccessErpBeta = isAdmin || profile?.can_access_erp_beta
  const canAccessForms = isAdmin || profile?.can_access_forms

  const menuItems = [
    { label: 'Accueil', icon: '🏠', screen: 'MainTabs', show: true },
    { divider: true, show: true },
    { label: 'Mes tâches', icon: '✓', screen: 'TachesStack', show: canAccessTasks },
    { label: 'Chantiers', icon: '💬', screen: 'ChantiersStack', show: canAccessConversations },
    { divider: true, show: true },
    { label: 'Bons de commande', icon: '📄', screen: 'BonsCommandeStack', show: true },
    { label: 'Réquisitions', icon: '📦', screen: 'RequisitionsStack', show: canAccessRequisitions },
    { label: 'Mes reçus', icon: '🧾', screen: 'RecusStack', show: canAccessReceipts },
    { divider: true, show: canAccessInventory || canAccessForms || canAccessErpBeta },
    { label: 'Commandes fournisseurs', icon: '🚚', screen: 'CommandesStack', show: canAccessInventory },
    { label: 'Inspections', icon: '📋', screen: 'InspectionsStack', show: canAccessForms },
    { label: 'ERP Beta', icon: '⚡', screen: 'ErpStack', show: canAccessErpBeta, beta: true },
  ]

  const handleNavigate = (screen: string) => {
    onClose()
    navigation.navigate(screen)
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
  }

  if (!visible) return null

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={drawerStyles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={drawerStyles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[drawerStyles.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <ScrollView style={drawerStyles.scrollView}>
            {/* Header */}
            <View style={drawerStyles.header}>
              <Text style={drawerStyles.logoText}>ReVolt</Text>
              <Text style={drawerStyles.logoSubtext}>Électrique</Text>
              {profile && (
                <View style={drawerStyles.userInfo}>
                  <Text style={drawerStyles.userName}>
                    {profile.first_name} {profile.last_name}
                  </Text>
                  <Text style={drawerStyles.userRole}>
                    {profile.role === 'admin' ? 'Administrateur' : 'Employé'}
                  </Text>
                </View>
              )}
            </View>

            {/* Menu Items */}
            <View style={drawerStyles.menuContainer}>
              {menuItems.map((item, index) => {
                if (!item.show) return null

                if (item.divider) {
                  return <View key={`divider-${index}`} style={drawerStyles.divider} />
                }

                return (
                  <TouchableOpacity
                    key={item.screen}
                    style={drawerStyles.menuItem}
                    onPress={() => handleNavigate(item.screen!)}
                  >
                    <Text style={drawerStyles.menuIcon}>{item.icon}</Text>
                    <Text style={drawerStyles.menuLabel}>{item.label}</Text>
                    {item.beta && (
                      <View style={drawerStyles.betaBadge}>
                        <Text style={drawerStyles.betaText}>BETA</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Déconnexion */}
            <View style={drawerStyles.footer}>
              <TouchableOpacity style={drawerStyles.logoutButton} onPress={handleSignOut}>
                <Text style={drawerStyles.logoutIcon}>🚪</Text>
                <Text style={drawerStyles.logoutText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

// Onglets principaux (4 max)
function MainTabs({ navigation }: { navigation: any }) {
  const { profile } = useAuth()
  const { openDrawer } = React.useContext(DrawerContext)

  const isAdmin = profile?.role === 'admin'
  const canAccessTasks = isAdmin || profile?.can_access_tasks
  const canAccessConversations = isAdmin || profile?.can_access_conversations

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner position="top" showPendingCount={true} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarActiveTintColor: '#64191E',
          tabBarInactiveTintColor: '#999',
          tabBarLabelStyle: { fontSize: 11 },
          headerStyle: { backgroundColor: '#64191E' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () => (
            <TouchableOpacity onPress={openDrawer} style={{ marginLeft: 15 }}>
              <Text style={{ fontSize: 24, color: '#fff' }}>☰</Text>
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen
          name="Accueil"
          component={HomeScreen}
          options={{ title: 'ReVolt Employé' }}
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
        <Tab.Screen
          name="Profil"
          component={ProfileScreen}
          options={{ title: 'Mon profil' }}
        />
      </Tab.Navigator>
    </View>
  )
}

function AppNavigator({ navigationRef }: { navigationRef: any }) {
  const { session, loading, isEmployee, user } = useAuth()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  const openDrawer = () => setDrawerVisible(true)
  const closeDrawer = () => setDrawerVisible(false)

  useEffect(() => {
    if (session && user?.id && isEmployee) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          savePushToken(user.id, token)
        }
      })

      notificationListener.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log('Notification reçue:', notification)
        }
      )

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log('Réponse notification:', response)
          const data = response.notification.request.content.data

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
        <Text style={styles.loadingText}>Connexion en cours...</Text>
      </View>
    )
  }

  if (!session || !isEmployee) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    )
  }

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <CustomDrawer
        visible={drawerVisible}
        onClose={closeDrawer}
        navigation={navigationRef.current}
      />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#64191E' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerBackTitle: 'Retour',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        {/* Stacks accessibles depuis le drawer */}
        <Stack.Screen name="TachesStack" component={TachesScreen} options={{ title: 'Mes tâches' }} />
        <Stack.Screen name="ChantiersStack" component={ConversationsListScreen} options={{ title: 'Chantiers' }} />
        <Stack.Screen name="BonsCommandeStack" component={BonsCommandeScreen} options={{ title: 'Bons de commande' }} />
        <Stack.Screen name="RequisitionsStack" component={RequisitionsScreen} options={{ title: 'Réquisitions' }} />
        <Stack.Screen name="RecusStack" component={MesRecusScreen} options={{ title: 'Mes reçus' }} />
        <Stack.Screen name="CommandesStack" component={CommandesFournisseursScreen} options={{ title: 'Commandes fournisseurs' }} />
        <Stack.Screen name="InspectionsStack" component={InspectionsScreen} options={{ title: 'Inspections' }} />
        <Stack.Screen name="ErpStack" component={ErpHomeScreen} options={{ headerShown: false }} />
        {/* Écrans de détails */}
        <Stack.Screen name="NouveauBC" component={NouveauBCScreen} options={{ title: 'Nouveau bon de commande' }} />
        <Stack.Screen name="NouvelleRequisition" component={NouvelleRequisitionScreen} options={{ title: 'Nouvelle réquisition' }} />
        <Stack.Screen name="DetailsBC" component={DetailsBCScreen} options={{ title: 'Détails du BC' }} />
        <Stack.Screen name="DetailsRequisition" component={DetailsRequisitionScreen} options={{ title: 'Détails de la réquisition' }} />
        <Stack.Screen name="NouvelleConversation" component={NouvelleConversationScreen} options={{ title: 'Nouvelle conversation' }} />
        <Stack.Screen name="ConversationChat" component={ConversationDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ModifierRequisition" component={ModifierRequisitionScreen} options={{ title: 'Modifier la réquisition' }} />
        <Stack.Screen name="ModifierBC" component={ModifierBCScreen} options={{ title: 'Modifier le BC' }} />
        <Stack.Screen name="DetailsTache" component={DetailsTacheScreen} options={{ title: 'Détails de la tâche' }} />
        <Stack.Screen name="NouvelleTache" component={NouvelleTacheScreen} options={{ title: 'Nouvelle tâche' }} />
        <Stack.Screen name="BonsCommande" component={BonsCommandeScreen} options={{ title: 'Bons de commande' }} />
        <Stack.Screen name="NouveauRecu" component={NouveauRecuScreen} options={{ title: 'Nouveau reçu' }} />
        <Stack.Screen name="DetailsRecu" component={DetailsRecuScreen} options={{ title: 'Détails du reçu' }} />
        <Stack.Screen name="DetailsCommandeSupplier" component={DetailsCommandeSupplierScreen} options={{ title: 'Détails de la commande' }} />
        <Stack.Screen name="ScanQR" component={ScanQRScreen} options={{ title: 'Scanner QR code' }} />
        {/* ERP */}
        <Stack.Screen name="ErpAppels" component={ErpAppelsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ErpNouvelAppel" component={ErpNouvelAppelScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ErpDetailsAppel" component={ErpDetailsAppelScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ErpFeuilleTemps" component={ErpFeuilleTempsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ErpInventaire" component={ErpInventaireScreen} options={{ headerShown: false }} />
        {/* Inspections */}
        <Stack.Screen name="NouvelleInspection" component={NouvelleInspectionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DetailsInspection" component={DetailsInspectionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NouvelleInspectionElectrique" component={NouvelleInspectionElectriqueScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DetailsInspectionElectrique" component={NouvelleInspectionElectriqueScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </DrawerContext.Provider>
  )
}

export default function App() {
  const navigationRef = useNavigationContainerRef()
  const [storageReady, setStorageReady] = React.useState(false)

  React.useEffect(() => {
    initStorage()
      .then(() => setStorageReady(true))
      .catch(() => setStorageReady(true))

    const timeout = setTimeout(() => setStorageReady(true), 3000)
    return () => clearTimeout(timeout)
  }, [])

  if (!storageReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#64191E" />
        <Text style={styles.loadingText}>Initialisation...</Text>
      </View>
    )
  }

  return (
    <AuthProvider>
      <OfflineProvider autoSyncOnReconnect={true} autoSyncOnForeground={true}>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="light" />
          <AppNavigator navigationRef={navigationRef} />
        </NavigationContainer>
      </OfflineProvider>
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

const drawerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e63946',
  },
  logoSubtext: {
    fontSize: 14,
    color: '#aaa',
  },
  userInfo: {
    marginTop: 15,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  userRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  menuContainer: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  betaBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  betaText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  logoutText: {
    fontSize: 16,
    color: '#e63946',
  },
})
