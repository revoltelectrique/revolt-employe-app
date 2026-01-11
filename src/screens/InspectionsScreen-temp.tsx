import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { InspectionForm, InspectionType } from '../types'
import { useAuth } from '../contexts/AuthContext'

export default function InspectionsScreen() {
  const navigation = useNavigation<any>()
  const { profile } = useAuth()
  const [inspections, setInspections] = useState<InspectionForm[]>([])
  const [inspectionTypes, setInspectionTypes] = useState<InspectionType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    try {
      // Load inspection types
      const { data: types } = await supabase
        .from('inspection_types')
        .select('*')
        .eq('is_active', true)
        .order('name')

      setInspectionTypes(types || [])

      // Load recent inspections
      const { data: forms } = await supabase
        .from('inspection_forms')
        .select(`
          *,
          inspection_type:inspection_types(*)
        `)
        .eq('user_id', profile?.id)
        .order('inspection_date', { ascending: false })
        .limit(20)

      setInspections(forms || [])
    } catch (error) {
      console.error('Error loading inspections:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [profile?.id])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e'
      case 'reviewed':
        return '#3b82f6'
      default:
        return '#eab308'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Complété'
      case 'reviewed':
        return 'Révisé'
      default:
        return 'Brouillon'
    }
  }

  const handleNewInspection = (type: InspectionType) => {
    // Route to different screens based on inspection type
    if (type.code === 'ELECTRICAL' || type.code === 'ELECTRIQUE') {
      navigation.navigate('NouvelleInspectionElectrique', { typeCode: type.code, typeId: type.id })
    } else {
      navigation.navigate('NouvelleInspection', { typeCode: type.code, typeId: type.id })
    }
  }

  const handleViewInspection = (inspection: InspectionForm) => {
    // Route to different detail screens based on inspection type
    const typeCode = inspection.inspection_type?.code
    if (typeCode === 'ELECTRICAL' || typeCode === 'ELECTRIQUE') {
      navigation.navigate('DetailsInspectionElectrique', { inspectionId: inspection.id })
    } else {
      navigation.navigate('DetailsInspection', { inspectionId: inspection.id })
    }
  }

  const renderInspectionType = ({ item }: { item: InspectionType }) => (
    <TouchableOpacity
      style={[styles.typeCard, (item.code === 'ELECTRICAL' || item.code === 'ELECTRIQUE') && styles.typeCardElectrical]}
      onPress={() => handleNewInspection(item)}
    >
      <Text style={styles.typeIcon}>{item.icon || '📋'}</Text>
      <View style={styles.typeInfo}>
        <Text style={styles.typeName}>{item.name}</Text>
        <Text style={styles.typeDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )

  const renderInspection = ({ item }: { item: InspectionForm }) => (
    <TouchableOpacity
      style={styles.inspectionCard}
      onPress={() => handleViewInspection(item)}
    >
      <View style={styles.inspectionHeader}>
        <Text style={styles.inspectionIcon}>{item.inspection_type?.icon || '📋'}</Text>
        <View style={styles.inspectionInfo}>
          <Text style={styles.inspectionDate}>
            {new Date(item.inspection_date).toLocaleDateString('fr-CA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </Text>
          <Text style={styles.inspectionModel}>
            {item.equipment_model || 'Équipement non spécifié'}
          </Text>
          {item.location && (
            <Text style={styles.inspectionLocation}>{item.location}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inspections</Text>
        <Text style={styles.headerSubtitle}>Formulaires d'inspection quotidiens</Text>
      </View>

      <FlatList
        data={[{ key: 'types' }, { key: 'history' }]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.key === 'types') {
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nouvelle inspection</Text>
                {inspectionTypes.map((type) => (
                  <View key={type.id}>
                    {renderInspectionType({ item: type })}
                  </View>
                ))}
              </View>
            )
          }
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Historique récent</Text>
              {inspections.length === 0 ? (
                <Text style={styles.emptyText}>Aucune inspection trouvée</Text>
              ) : (
                inspections.map((inspection) => (
                  <View key={inspection.id}>
                    {renderInspection({ item: inspection })}
                  </View>
                ))
              )}
            </View>
          )
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#64191E']} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    backgroundColor: '#64191E',
    padding: 16,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  typeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#f472b6',
  },
  typeCardElectrical: {
    borderLeftColor: '#eab308',
  },
  typeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  typeDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
  inspectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inspectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  inspectionInfo: {
    flex: 1,
  },
  inspectionDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  inspectionModel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  inspectionLocation: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
})
