import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  scanType?: string;
  allowManualEntry?: boolean;
  continuousMode?: boolean;
  title?: string;
}

export function BarcodeScanner({
  onScan,
  onClose,
  scanType = 'SCAN',
  allowManualEntry = true,
  continuousMode = false,
  title,
}: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAwb, setManualAwb] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned && !continuousMode) return;

    const { data } = result;

    // Prevent duplicate scans in continuous mode
    if (continuousMode && data === lastScannedCode) return;

    setScanned(true);
    setLastScannedCode(data);

    // Vibrate feedback
    // Vibration.vibrate(100);

    onScan(data);

    if (continuousMode) {
      // Reset after delay for next scan
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  };

  const handleManualSubmit = () => {
    if (!manualAwb.trim()) {
      Alert.alert('Error', 'Please enter an AWB number');
      return;
    }

    onScan(manualAwb.trim().toUpperCase());
    setManualAwb('');
    setShowManualEntry(false);

    if (!continuousMode) {
      setScanned(true);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setLastScannedCode(null);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off-outline" size={64} color="#666" />
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        {allowManualEntry && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Enter Manually
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix'],
        }}
        onBarcodeScanned={scanned && !continuousMode ? undefined : handleBarCodeScanned}
      >
        {/* Header */}
        <View style={styles.header}>
          {onClose && (
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{title || scanType}</Text>
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

        {/* Scan Area Overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayRow}>
            <View style={styles.overlaySection} />
            <View style={styles.scanAreaColumn}>
              <View style={styles.overlaySection} />
              <View style={styles.scanArea}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                {scanned && (
                  <View style={styles.scannedOverlay}>
                    <Ionicons name="checkmark-circle" size={48} color="#4ade80" />
                  </View>
                )}
              </View>
              <View style={styles.overlaySection} />
            </View>
            <View style={styles.overlaySection} />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {continuousMode
              ? 'Point camera at barcode. Scanning continuously...'
              : 'Position barcode within the frame'}
          </Text>
          {lastScannedCode && (
            <Text style={styles.lastScanned}>Last: {lastScannedCode}</Text>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {scanned && !continuousMode ? (
            <TouchableOpacity style={styles.scanAgainButton} onPress={resetScanner}>
              <Ionicons name="scan-outline" size={24} color="#fff" />
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </TouchableOpacity>
          ) : (
            allowManualEntry && (
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setShowManualEntry(true)}
              >
                <Ionicons name="keypad-outline" size={20} color="#fff" />
                <Text style={styles.manualButtonText}>Enter Manually</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </CameraView>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter AWB Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., AWB1234567890"
              value={manualAwb}
              onChangeText={setManualAwb}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualAwb('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayRow: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanAreaColumn: {
    width: SCAN_AREA_SIZE,
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#3b82f6',
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
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  lastScanned: {
    color: '#4ade80',
    fontSize: 12,
    marginTop: 8,
  },
  bottomControls: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  text: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  secondaryButtonText: {
    color: '#3b82f6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default BarcodeScanner;
