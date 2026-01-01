import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PickupScan() {
  const [awbNumber, setAwbNumber] = useState('');
  const [scannedItems, setScannedItems] = useState<string[]>([]);

  const handleManualEntry = () => {
    if (!awbNumber.trim()) {
      Alert.alert('Error', 'Please enter an AWB number');
      return;
    }

    if (scannedItems.includes(awbNumber.trim())) {
      Alert.alert('Duplicate', 'This AWB has already been scanned');
      return;
    }

    setScannedItems([...scannedItems, awbNumber.trim()]);
    setAwbNumber('');
  };

  const handleRemoveItem = (item: string) => {
    setScannedItems(scannedItems.filter(i => i !== item));
  };

  const handleSubmit = () => {
    if (scannedItems.length === 0) {
      Alert.alert('Error', 'Please scan at least one item');
      return;
    }

    Alert.alert(
      'Confirm Pickup',
      `Confirm pickup of ${scannedItems.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            // TODO: Submit to API
            Alert.alert('Success', 'Pickup confirmed!');
            setScannedItems([]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Camera Placeholder */}
        <View style={styles.cameraPlaceholder}>
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
          <Text style={styles.cameraText}>Camera scanner will be available</Text>
          <Text style={styles.cameraText}>after installing required packages</Text>
        </View>

        {/* Manual Entry */}
        <View style={styles.manualEntry}>
          <Text style={styles.sectionTitle}>Manual Entry</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter AWB Number"
              placeholderTextColor="#9CA3AF"
              value={awbNumber}
              onChangeText={setAwbNumber}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.addButton} onPress={handleManualEntry}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scanned Items */}
        <View style={styles.scannedSection}>
          <Text style={styles.sectionTitle}>
            Scanned Items ({scannedItems.length})
          </Text>
          {scannedItems.length === 0 ? (
            <View style={styles.emptyScanned}>
              <Ionicons name="barcode-outline" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No items scanned yet</Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {scannedItems.map((item, index) => (
                <View key={index} style={styles.scannedItem}>
                  <View style={styles.itemInfo}>
                    <Ionicons name="cube-outline" size={20} color="#4F46E5" />
                    <Text style={styles.itemText}>{item}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveItem(item)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Submit Button */}
      {scannedItems.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <Text style={styles.submitText}>Confirm Pickup ({scannedItems.length} items)</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cameraPlaceholder: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cameraText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
  },
  manualEntry: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedSection: {
    flex: 1,
  },
  emptyScanned: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#9CA3AF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'monospace',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 56,
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
