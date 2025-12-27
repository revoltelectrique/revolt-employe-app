import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type RootStackParamList = {
  ErpAppels: undefined
  ErpNouvelAppel: undefined
  ErpFeuilleTemps: undefined
  ErpInventaire: undefined
}

interface MenuItem {
  id: string
  title: string
  subtitle: string
  icon: string
  color: string
  route: keyof RootStackParamList
}

const menuItems: MenuItem[] = [
  {
    id: 'appels',
    title: 'Appels de service',
    subtitle: 'Gérer les appels et bons de travail',
    icon: '📞',
    color: '#8B5CF6',
    route: 'ErpAppels',
  },
  {
    id: 'temps',
    title: 'Feuille de temps',
    subtitle: 'Saisir et consulter les heures',
    icon: '⏱️',
    color: '#059669',
    route: 'ErpFeuilleTemps',
  },
  {
    id: 'inventaire',
    title: 'Inventaire',
    subtitle: 'Produits et matériel',
    icon: '📦',
    color: '#D97706',
    route: 'ErpInventaire',
  },
]

export default function ErpHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleMenuPress = (item: MenuItem) => {
    navigation.navigate(item.route)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>ERP</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Gestion des opérations</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Action */}
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('ErpNouvelAppel')}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionEmoji}>➕</Text>
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Nouvel appel de service</Text>
            <Text style={styles.quickActionSubtitle}>Créer un nouvel appel rapidement</Text>
          </View>
          <Text style={styles.quickActionArrow}>›</Text>
        </TouchableOpacity>

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>Modules</Text>

        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleMenuPress(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
              <Text style={styles.menuEmoji}>{item.icon}</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={[styles.menuArrow, { color: item.color }]}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Module en développement</Text>
            <Text style={styles.infoText}>
              Le module ERP est en version bêta. Certaines fonctionnalités peuvent être limitées.
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    marginTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  betaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 10,
  },
  betaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  quickAction: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    flex: 1,
    marginLeft: 14,
  },
  quickActionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  quickActionArrow: {
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '300',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuEmoji: {
    fontSize: 24,
  },
  menuText: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    fontWeight: '300',
  },
  infoBox: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginTop: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5B21B6',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B21A8',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 40,
  },
})
