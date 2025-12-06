import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native'
import * as ExpoImagePicker from 'expo-image-picker'

interface ImagePickerProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  label?: string
}

export default function ImagePicker({
  images,
  onImagesChange,
  maxImages = 5,
  label = 'Photos',
}: ImagePickerProps) {
  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ExpoImagePicker.requestCameraPermissionsAsync()
    const { status: libraryStatus } =
      await ExpoImagePicker.requestMediaLibraryPermissionsAsync()

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissions requises',
        'Veuillez autoriser l\'accès à la caméra et à la galerie dans les paramètres.'
      )
      return false
    }
    return true
  }

  const pickImage = async (useCamera: boolean) => {
    if (images.length >= maxImages) {
      Alert.alert('Limite atteinte', `Maximum ${maxImages} photos autorisées.`)
      return
    }

    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    const options: ExpoImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    }

    let result
    if (useCamera) {
      result = await ExpoImagePicker.launchCameraAsync(options)
    } else {
      result = await ExpoImagePicker.launchImageLibraryAsync(options)
    }

    if (!result.canceled && result.assets[0]) {
      const newImage = result.assets[0].uri
      onImagesChange([...images, newImage])
    }
  }

  const showPickerOptions = () => {
    Alert.alert('Ajouter une photo', 'Choisissez une option', [
      { text: 'Prendre une photo', onPress: () => pickImage(true) },
      { text: 'Choisir de la galerie', onPress: () => pickImage(false) },
      { text: 'Annuler', style: 'cancel' },
    ])
  }

  const removeImage = (index: number) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cette photo?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          const newImages = images.filter((_, i) => i !== index)
          onImagesChange(newImages)
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} ({images.length}/{maxImages})
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((uri, index) => (
          <TouchableOpacity
            key={index}
            style={styles.imageContainer}
            onPress={() => removeImage(index)}
          >
            <Image source={{ uri }} style={styles.image} />
            <View style={styles.removeButton}>
              <Text style={styles.removeText}>×</Text>
            </View>
          </TouchableOpacity>
        ))}

        {images.length < maxImages && (
          <TouchableOpacity style={styles.addButton} onPress={showPickerOptions}>
            <Text style={styles.addIcon}>📷</Text>
            <Text style={styles.addText}>Ajouter</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {images.length === 0 && (
        <Text style={styles.hint}>
          Appuyez sur "Ajouter" pour joindre des photos
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#DC2626',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  removeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -2,
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  addIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  addText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
})
