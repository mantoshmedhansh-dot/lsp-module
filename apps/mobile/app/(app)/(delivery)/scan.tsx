import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarcodeScanner } from '../../../components/scanner/BarcodeScanner';
import api from '../../../services/api';

type ScanMode = 'OFD' | 'DELIVERED' | 'FAILED';

interface ScannedItem {
  awbNumber: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export default function DeliveryScan() {
  const [scanMode, setScanMode] = useState<ScanMode>('OFD');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.loadToken();
  }, []);

  const getScanType = () => {
    switch (scanMode) {
      case 'OFD':
        return 'OFD_SCAN';
      case 'DELIVERED':
        return 'DELIVERY_SCAN';
      case 'FAILED':
        return 'RETURN_SCAN';
      default:
        return 'OFD_SCAN';
    }
  };

  const handleScan = (barcode: string) => {
    const upperBarcode = barcode.toUpperCase();

    if (scannedItems.some((item) => item.awbNumber === upperBarcode)) {
      Alert.alert('Duplicate', 'This AWB has already been scanned');
      return;
    }

    setScannedItems((prev) => [
      ...prev,
      { awbNumber: upperBarcode, status: 'pending' },
    ]);

    // Close scanner after single scan in non-continuous mode
    setShowScanner(false);
  };

  const handleRemoveItem = (awbNumber: string) => {
    setScannedItems((prev) => prev.filter((item) => item.awbNumber !== awbNumber));
  };

  const handleSubmit = async () => {
    if (scannedItems.length === 0) {
      Alert.alert('Error', 'Please scan at least one item');
      return;
    }

    const actionLabel =
      scanMode === 'OFD'
        ? 'mark Out For Delivery'
        : scanMode === 'DELIVERED'
        ? 'mark as Delivered'
        : 'mark as Failed';

    Alert.alert(
      'Confirm Action',
      `Confirm ${actionLabel} for ${scannedItems.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);

            try {
              const scans = scannedItems.map((item) => ({
                awbNumber: item.awbNumber,
                scanType: getScanType(),
              }));

              const response = await api.submitBulkScans(scans);

              if (response.success && response.data) {
                const { results } = response.data;

                // Update item statuses
                setScannedItems((prev) =>
                  prev.map((item) => {
                    const result = results.find(
                      (r: any) => r.awbNumber === item.awbNumber
                    );
                    return {
                      ...item,
                      status: result?.success ? 'success' : 'error',
                      message: result?.error,
                    };
                  })
                );

                const successCount = results.filter((r: any) => r.success).length;
                const failCount = results.filter((r: any) => !r.success).length;

                if (failCount === 0) {
                  Alert.alert('Success', `All ${successCount} items processed successfully!`, [
                    {
                      text: 'OK',
                      onPress: () => setScannedItems([]),
                    },
                  ]);
                } else {
                  Alert.alert(
                    'Partial Success',
                    `${successCount} succeeded, ${failCount} failed. Check errors below.`
                  );
                }
              } else {
                Alert.alert('Error', response.error || 'Failed to submit scans');
              }
            } catch (error) {
              Alert.alert('Error', 'An error occurred while submitting');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getModeColor = (mode: ScanMode) => {
    switch (mode) {
      case 'OFD':
        return '#3b82f6';
      case 'DELIVERED':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
    }
  };

  const getStatusIcon = (status: ScannedItem['status']) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
    }
  };

  const getStatusColor = (status: ScannedItem['status']) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
    }
  };

  if (showScanner) {
    return (
      <BarcodeScanner
        onScan={handleScan}
        onClose={() => setShowScanner(false)}
        scanType={scanMode === 'OFD' ? 'OFD Scan' : scanMode}
        title={`${scanMode === 'OFD' ? 'Out For Delivery' : scanMode} Scan`}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content}>
        {/* Scan Mode Selector */}
        <View style={styles.modeSelector}>
          {(['OFD', 'DELIVERED', 'FAILED'] as ScanMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                scanMode === mode && { backgroundColor: getModeColor(mode) },
              ]}
              onPress={() => {
                setScanMode(mode);
                setScannedItems([]);
              }}
            >
              <Text
                style={[
                  styles.modeText,
                  scanMode === mode && { color: '#fff' },
                ]}
              >
                {mode === 'OFD' ? 'Out For Delivery' : mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Open Scanner Button */}
        <TouchableOpacity
          style={[styles.scannerButton, { backgroundColor: getModeColor(scanMode) }]}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="scan-outline" size={32} color="#fff" />
          <Text style={styles.scannerButtonText}>Open Scanner</Text>
          <Text style={styles.scannerButtonSubtext}>
            Tap to scan barcodes or enter manually
          </Text>
        </TouchableOpacity>

        {/* Scanned Items */}
        <View style={styles.scannedSection}>
          <Text style={styles.sectionTitle}>
            Scanned for {scanMode === 'OFD' ? 'OFD' : scanMode} ({scannedItems.length})
          </Text>
          {scannedItems.length === 0 ? (
            <View style={styles.emptyScanned}>
              <Ionicons name="barcode-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyText}>No items scanned yet</Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {scannedItems.map((item, index) => (
                <View key={index} style={styles.scannedItem}>
                  <View style={styles.itemInfo}>
                    <Ionicons
                      name={getStatusIcon(item.status) as any}
                      size={20}
                      color={getStatusColor(item.status)}
                    />
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemText}>{item.awbNumber}</Text>
                      {item.message && (
                        <Text style={styles.itemError}>{item.message}</Text>
                      )}
                    </View>
                  </View>
                  {item.status === 'pending' && (
                    <TouchableOpacity onPress={() => handleRemoveItem(item.awbNumber)}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      {scannedItems.filter((i) => i.status === 'pending').length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: getModeColor(scanMode) },
              submitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitText}>
                  {scanMode === 'OFD'
                    ? 'Mark Out For Delivery'
                    : scanMode === 'DELIVERED'
                    ? 'Mark Delivered'
                    : 'Mark Failed'}
                  {' '}({scannedItems.filter((i) => i.status === 'pending').length} items)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  scannerButton: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  scannerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  scannerButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  scannedSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyScanned: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    padding: 48,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  itemsList: {
    gap: 8,
  },
  scannedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'monospace',
  },
  itemError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 2,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 56,
    gap: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
