import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { CRMDashboardStats, CRM_STATUS_LABELS, CRM_STATUS_COLORS } from '../types'

export default function CRMHomeScreen() {
  const navigation = useNavigation<any>()
  const [stats, setStats] = useState<CRMDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = async () => {
    try {
      // Charger les leads pour calculer les stats
      const { data: leads, error } = await supabase
        .from('crm_leads')
        .select('id, status, estimated_value')

      if (error) throw error

      const allLeads = leads || []

      // Calculer les stats
      const total_leads = allLeads.length
      const active_leads = allLeads.filter(l => !['converti', 'perdu'].includes(l.status)).length
      const converted_leads = allLeads.filter(l => l.status === 'converti').length
      const lost_leads = allLeads.filter(l => l.status === 'perdu').length
      const total_pipeline_value = allLeads
        .filter(l => !['converti', 'perdu'].includes(l.status))
        .reduce((sum, l) => sum + (l.estimated_value || 0), 0)

      const closedLeads = converted_leads + lost_leads
      const conversion_rate = closedLeads > 0 ? Math.round((converted_leads / closedLeads) * 100) : 0

      // Stats par statut
      const statusCounts: Record<string, { count: number; total_value: number }> = {}
      allLeads.forEach(lead => {
        if (!statusCounts[lead.status]) {
          statusCounts[lead.status] = { count: 0, total_value: 0 }
        }
        statusCounts[lead.status].count++
        statusCounts[lead.status].total_value += lead.estimated_value || 0
      })

      const leads_by_status = Object.entries(statusCounts).map(([status, data]) => ({
        status: status as any,
        count: data.count,
        total_value: data.total_value
      }))

      // Rappels
      const { data: reminders } = await supabase
        .from('crm_reminders')
        .select('id, reminder_date, is_completed')
        .eq('is_completed', false)

      const now = new Date()
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const overdue_reminders = (reminders || []).filter(r => new Date(r.reminder_date) < now).length
      const upcoming_reminders = (reminders || []).filter(r => {
        const date = new Date(r.reminder_date)
        return date >= now && date <= weekFromNow
      }).length

      setStats({
        total_leads,
        active_leads,
        converted_leads,
        lost_leads,
        leads_by_status,
        total_pipeline_value,
        conversion_rate,
        overdue_reminders,
        upcoming_reminders
      })
    } catch (error) {
      console.error('Error loading CRM stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadStats()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadStats()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const menuItems = [
    {
      id: 'leads',
      title: 'Prospects',
      subtitle: 'Gérer les prospects et clients potentiels',
      icon: 'people',
      color: '#3B82F6',
      screen: 'CRMLeads',
    },
    {
      id: 'pipeline',
      title: 'Pipeline',
      subtitle: 'Vue du pipeline de ventes',
      icon: 'git-branch',
      color: '#8B5CF6',
      screen: 'CRMLeads',
    },
    {
      id: 'reminders',
      title: 'Rappels',
      subtitle: 'Suivis et relances à effectuer',
      icon: 'notifications',
      color: '#F59E0B',
      screen: 'CRMReminders',
      badge: stats?.overdue_reminders,
    },
  ]

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CRM</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CRMNewLead')}>
            <Ionicons name="add-circle" size={28} color="#10B981" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Gestion des prospects</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* KPIs */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.kpiValue}>{stats?.total_leads || 0}</Text>
              <Text style={styles.kpiLabel}>Total prospects</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.kpiValue, { color: '#22C55E' }]}>{stats?.conversion_rate || 0}%</Text>
              <Text style={styles.kpiLabel}>Taux conversion</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>{stats?.active_leads || 0}</Text>
              <Text style={styles.kpiLabel}>Actifs</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>{formatCurrency(stats?.total_pipeline_value || 0)}</Text>
              <Text style={styles.kpiLabel}>Pipeline</Text>
            </View>
          </View>
        </View>

        {/* Alertes */}
        {(stats?.overdue_reminders || 0) > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => navigation.navigate('CRMReminders')}
          >
            <View style={styles.alertIcon}>
              <Ionicons name="warning" size={24} color="#EF4444" />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{stats?.overdue_reminders} rappel(s) en retard</Text>
              <Text style={styles.alertSubtitle}>Appuyez pour voir les détails</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}

        {/* Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              {item.badge && item.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Pipeline par statut */}
        <View style={styles.pipelineSection}>
          <Text style={styles.sectionTitle}>Pipeline par statut</Text>
          {stats?.leads_by_status.map((item) => (
            <View key={item.status} style={styles.pipelineItem}>
              <View style={styles.pipelineHeader}>
                <View style={[styles.statusDot, { backgroundColor: CRM_STATUS_COLORS[item.status] }]} />
                <Text style={styles.pipelineStatus}>{CRM_STATUS_LABELS[item.status]}</Text>
                <Text style={styles.pipelineCount}>{item.count}</Text>
              </View>
              <Text style={styles.pipelineValue}>{formatCurrency(item.total_value)}</Text>
            </View>
          ))}
        </View>

        {/* Action rapide */}
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('CRMNewLead')}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.quickActionText}>Nouveau prospect</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  kpiContainer: {
    padding: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertIcon: {
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pipelineSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pipelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  pipelineStatus: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  pipelineCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pipelineValue: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
})
