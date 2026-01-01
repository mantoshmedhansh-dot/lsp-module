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
import { useAuthStore } from '../../../stores/auth';

type ScanType = 'INSCAN' | 'OUTSCAN' | 'LOAD' | 'UNLOAD';

interface ScannedItem {
  awbNumber: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export default function HubScan() {
  const user = useAuthStore((state) => state.user);
  const [scanType, setScanType] = useState<ScanType>('INSCAN');
  const [tripId, setTripId] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.loadToken();
  }, []);

  const getScanApiType = () => {
    switch (scanType) {
      case 'INSCAN':
        return 'INSCAN';
      case 'OUTSCAN':
        return 'OUTSCAN';
      case 'LOAD':
        return 'LOAD_SCAN';
      case 'UNLOAD':
        return 'UNLOAD_SCAN';
    }
  };

  const handleScan = (barcode: string) => {
    const upperBarcode = barcode.toUpperCase();

    if (scannedItems.some((item) => item.awbNumber === upperBarcode)) {
      // In continuous mode, just ignore duplicates silently
      if (!continuousMode) {
        Alert.alert('Duplicate', 'This AWB has already been scanned');
      }
      return;
    }

    setScannedItems((prev) => [
      { awbNumber: upperBarcode, status: 'pending' },
      ...prev,
    ]);

    if (!continuousMode) {
      setShowScanner(false);
    }
  };

  const handleRemoveItem = (awbNumber: string) => {
    setScannedItems((prev) => prev.filter((item) => item.awbNumber !== awbNumber));
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all scanned items?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setScannedItems([]) },
      ]
    );
  };

  const handleSubmit = async () => {
    const pendingItems = scannedItems.filter((i) => i.status === 'pending');

    if (pendingItems.length === 0) {
      Alert.alert('Error', 'No items to submit');
      return;
    }

    if ((scanType === 'LOAD' || scanType === 'UNLOAD') && !tripId) {
      Alert.alert('Error', 'Please select a trip for LOAD/UNLOAD operations');
      return;
    }

    Alert.alert(
      `Confirm ${scanType}`,
      `Confirm ${scanType} for ${pendingItems.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);

            try {
              const scans = pendingItems.map((item) => ({
                awbNumber: item.awbNumber,
                scanType: getScanApiType(),
                hubId: user?.hubId,
                tripId: tripId || undefined,
              }));

              const response = await api.submitBulkScans(scans);

              if (response.success && response.data) {
                const { results } = response.data;

                setScannedItems((prev) =>
                  prev.map((item) => {
                    const result = results.find(
                      (r: any) => r.awbNumber === item.awbNumber
                    );
                    if (!result) return item;
                    return {
                      ...item,
                      status: result.success ? 'success' : 'error',
                      message: result.error,
                    };
                  })
                );

                const successCount = results.filter((r: any) => r.success).length;
                const failCount = results.filter((r: any) => !r.success).length;

                if (failCount === 0) {
                  Alert.alert(
                    'Success',
                    `${scanType} completed for ${successCount} items!`,
                    [
                      {
                        text: 'OK',
                        onPress: () => setScannedItems([]),
                      },
                    ]
                  );
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

  const getScanTypeColor = (type: ScanType) => {
    switch (type) {
      case 'INSCAN':
        return '#3b82f6';
      case 'OUTSCAN':
        return '#10b981';
      case 'LOAD':
        return '#8b5cf6';
      case 'UNLOAD':
        return '#f59e0b';
    }
  };

  const getScanTypeIcon = (type: ScanType) => {
    switch (type) {
      case 'INSCAN':
        return 'enter-outline';
      case 'OUTSCAN':
        return 'exit-outline';
      case 'LOAD':
        return 'arrow-up-circle-outline';
      case 'UNLOAD':
        return 'arrow-down-circle-outline';
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
        scanType={scanType}
        title={`${scanType} Scan`}
        continuousMode={continuousMode}
      />
    );
  }

  const pendingCount = scannedItems.filter((i) => i.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content}>
        {/* Scan Type Selector */}
        <View style={styles.typeSelector}>
          {(['INSCAN', 'OUTSCAN', 'LOAD', 'UNLOAD'] as ScanType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                scanType === type && { backgroundColor: getScanTypeColor(type) },
              ]}
              onPress={() => {
                setScanType(type);
                setScannedItems([]);
              }}
            >
              <Ionicons
                name={getScanTypeIcon(type) as any}
                size={20}
                color={scanType === type ? '#fff' : '#6b7280'}
              />
              <Text
                style={[
                  styles.typeText,
                  scanType === type && { color: '#fff' },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trip Selector for LOAD/UNLOAD */}
        {(scanType === 'LOAD' || scanType === 'UNLOAD') && (
          <View style={styles.tripSection}>
            <Text style={styles.label}>Select Trip</Text>
            <TouchableOpacity style={styles.tripSelector}>
              <Ionicons name="car-outline" size={20} color="#6b7280" />
              <Text style={styles.tripSelectorText}>
                {tripId || 'Select a trip...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Open Scanner Button */}
        <TouchableOpacity
          style={[styles.scannerButton, { backgroundColor: getScanTypeColor(scanType) }]}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="scan-outline" size={32} color="#fff" />
          <Text style={styles.scannerButtonText}>Open Scanner</Text>
          <Text style={styles.scannerButtonSubtext}>
            Tap to scan barcodes or enter manually
          </Text>
        </TouchableOpacity>

        {/* Bulk Mode Toggle */}
        <TouchableOpacity
          style={styles.bulkMode}
          onPress={() => setContinuousMode(!continuousMode)}
        >
          <View style={styles.bulkModeInfo}>
            <Ionicons name="layers-outline" size={20} color="#6b7280" />
            <Text style={styles.bulkModeText}>Continuous Scan Mode</Text>
          </View>
          <View
            style={[
              styles.bulkModeSwitch,
              { backgroundColor: continuousMode ? '#10b981' : '#9ca3af' },
            ]}
          >
            <Text style={styles.bulkModeStatus}>{continuousMode ? 'ON' : 'OFF'}</Text>
          </View>
        </TouchableOpacity>

        {/* Scanned Items */}
        <View style={styles.scannedSection}>
          <View style={styles.scannedHeader}>
            <Text style={styles.sectionTitle}>Scanned ({scannedItems.length})</Text>
            {scannedItems.length > 0 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
          {scannedItems.length === 0 ? (
            <View style={styles.emptyScanned}>
              <Ionicons name="barcode-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyText}>Start scanning items</Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {scannedItems.map((item, index) => (
                <View key={index} style={styles.scannedItem}>
                  <View
                    style={[
                      styles.itemNumber,
                      { backgroundColor: getStatusColor(item.status) },
                    ]}
                  >
                    <Ionicons
                      name={getStatusIcon(item.status) as any}
                      size={14}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.itemTextContainer}>
                    <Text style={styles.itemText}>{item.awbNumber}</Text>
                    {item.message && (
                      <Text style={styles.itemError}>{item.message}</Text>
                    )}
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
      {pendingCount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: getScanTypeColor(scanType) },
              submitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={getScanTypeIcon(scanType) as any} size={24} color="#fff" />
                <Text style={styles.submitText}>
                  Confirm {scanType} ({pendingCount} items)
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
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  tripSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  tripSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tripSelectorText: {
    flex: 1,
    fontSize: 16,
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
  bulkMode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bulkModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkModeText: {
    fontSize: 14,
    color: '#374151',
  },
  bulkModeSwitch: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bulkModeStatus: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scannedSection: {
    flex: 1,
  },
  scannedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  clearText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
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
