import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface PhotoCaptureProps {
  visible: boolean;
  onCapture: (photoUri: string, photoBase64?: string) => void;
  onClose: () => void;
  title?: string;
  instructions?: string;
}

export function PhotoCapture({
  visible,
  onCapture,
  onClose,
  title = 'Capture Photo',
  instructions = 'Take a clear photo of the package/POD',
}: PhotoCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });
        if (photo) {
          setCapturedPhoto(photo.uri);
        }
      } catch (error) {
        console.error('Error capturing photo:', error);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      setCapturedPhoto(null);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleClose = () => {
    setCapturedPhoto(null);
    onClose();
  };

  if (!visible) return null;

  // Show preview if photo is captured
  if (capturedPhoto) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Preview</Text>
            <View style={styles.headerButton} />
          </View>

          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.button, styles.retakeButton]}
              onPress={handleRetake}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Camera permission check
  if (!permission?.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off-outline" size={64} color="#666" />
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={requestPermission}
          >
            <Text style={styles.confirmButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.galleryButton]}
            onPress={handlePickFromGallery}
          >
            <Ionicons name="images-outline" size={20} color="#3b82f6" />
            <Text style={styles.galleryButtonText}>Pick from Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={handleClose}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Camera view
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={flashOn}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setFlashOn(!flashOn)}
            >
              <Ionicons
                name={flashOn ? 'flash' : 'flash-off'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cameraOverlay}>
            <View style={styles.frameGuide}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>{instructions}</Text>
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.galleryPickButton}
              onPress={handlePickFromGallery}
            >
              <Ionicons name="images-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={styles.galleryPickButton} />
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    padding: 8,
    width: 44,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameGuide: {
    width: '80%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#fff',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryPickButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40,
    gap: 12,
    backgroundColor: '#000',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginTop: 12,
  },
  galleryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  cancelLink: {
    marginTop: 24,
    padding: 12,
  },
  cancelLinkText: {
    color: '#666',
    fontSize: 14,
  },
});

export default PhotoCapture;
