import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ErpTimeEntry, ErpRateType, ERP_RATES } from '../types'

interface DayEntries {
  date: string
  dayName: string
  entries: ErpTimeEntry[]
  totalHours: number
}

export default function ErpFeuilleTempsScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [weekEntries, setWeekEntries] = useState<DayEntries[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [totalWeekHours, setTotalWeekHours] = useState(0)

  const getWeekDates = (offset: number) => {
    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - currentDay + 1 + offset * 7)

    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const getDayName = (date: Date) => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    return days[date.getDay()]
  }

  const loadEntries = useCallback(async () => {
    try {
      const dates = getWeekDates(weekOffset)
      const startDate = formatDate(dates[0])
      const endDate = formatDate(dates[6])

      const { data, error } = await supabase
        .from('erp_time_entries')
        .select(`
          *,
          employee:users!erp_time_entries_employee_id_fkey(id, email, first_name, last_name),
          service_call:erp_service_calls!erp_time_entries_service_call_id_fkey(id, numero, client_facture_a_id)
        `)
        .eq('employee_id', user?.id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: true })

      if (error) throw error

      // Group by day
      const entriesByDay: DayEntries[] = dates.map((date) => ({
        date: formatDate(date),
        dayName: getDayName(date),
        entries: [],
        totalHours: 0,
      }))

      let total = 0
      data?.forEach((entry) => {
        const dayIndex = entriesByDay.findIndex((d) => d.date === entry.work_date)
        if (dayIndex >= 0) {
          entriesByDay[dayIndex].entries.push(entry)
          entriesByDay[dayIndex].totalHours += entry.hours
          total += entry.hours
        }
      })

      setWeekEntries(entriesByDay)
      setTotalWeekHours(total)
    } catch (error) {
      console.error('Erreur chargement feuille de temps:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [weekOffset, user?.id])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const onRefresh = () => {
    setRefreshing(true)
    loadEntries()
  }

  const getRateLabel = (rate: ErpRateType) => {
    return ERP_RATES.find((r) => r.value === rate)?.label || rate
  }

  const getWeekLabel = () => {
    const dates = getWeekDates(weekOffset)
    const start = dates[0]
    const end = dates[6]
    const months = [
      'jan',
      'fév',
      'mar',
      'avr',
      'mai',
      'juin',
      'juil',
      'août',
      'sep',
      'oct',
      'nov',
      'déc',
    ]
    return `${start.getDate()} ${months[start.getMonth()]} - ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`
  }

  const isToday = (date: string) => {
    return date === formatDate(new Date())
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feuille de temps</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity
          style={styles.weekNavButton}
          onPress={() => setWeekOffset((w) => w - 1)}
        >
          <Text style={styles.weekNavArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.weekNavCenter}>
          <Text style={styles.weekLabel}>{getWeekLabel()}</Text>
          {weekOffset !== 0 && (
            <TouchableOpacity onPress={() => setWeekOffset(0)}>
              <Text style={styles.todayLink}>Aujourd'hui</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.weekNavButton}
          onPress={() => setWeekOffset((w) => w + 1)}
        >
          <Text style={styles.weekNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Week Total */}
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total semaine</Text>
        <Text style={styles.totalValue}>{totalWeekHours.toFixed(1)} heures</Text>
      </View>

      {/* Days */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
        }
      >
        {weekEntries.map((day) => (
          <View key={day.date} style={[styles.dayCard, isToday(day.date) && styles.dayCardToday]}>
            <View style={styles.dayHeader}>
              <View style={styles.dayInfo}>
                <Text style={[styles.dayName, isToday(day.date) && styles.dayNameToday]}>
                  {day.dayName}
                </Text>
                <Text style={styles.dayDate}>
                  {new Date(day.date + 'T12:00:00').toLocaleDateString('fr-CA', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <Text
                style={[styles.dayTotal, day.totalHours > 0 && styles.dayTotalActive]}
              >
                {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '-'}
              </Text>
            </View>

            {day.entries.length > 0 ? (
              <View style={styles.entriesList}>
                {day.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryCall}>
                        Appel #{(entry as any).service_call?.numero || '?'}
                      </Text>
                      {entry.description && (
                        <Text style={styles.entryDesc} numberOfLines={1}>
                          {entry.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.entryHours}>{entry.hours}h</Text>
                      <Text style={styles.entryRate}>{getRateLabel(entry.rate_type)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noEntries}>Aucune entrée</Text>
            )}
          </View>
        ))}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  weekNav: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  weekNavButton: {
    padding: 12,
    paddingHorizontal: 16,
  },
  weekNavArrow: {
    fontSize: 28,
    color: '#059669',
    fontWeight: '300',
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayLink: {
    fontSize: 13,
    color: '#059669',
    marginTop: 4,
  },
  totalBar: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  totalLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  dayNameToday: {
    color: '#059669',
  },
  dayDate: {
    fontSize: 14,
    color: '#666',
  },
  dayTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ccc',
  },
  dayTotalActive: {
    color: '#059669',
  },
  entriesList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryCall: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  entryDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  entryHours: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  entryRate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  noEntries: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
})
