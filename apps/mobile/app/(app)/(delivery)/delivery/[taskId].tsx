import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SignatureCapture } from '../../../../components/pod/SignatureCapture';
import { PhotoCapture } from '../../../../components/pod/PhotoCapture';
import api from '../../../../services/api';

interface Task {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  awbNumber: string;
  address: string;
  pincode: string;
  city: string;
  contactName: string;
  contactPhone: string;
  isCod: boolean;
  codAmount: number;
  latitude?: number;
  longitude?: number;
  timeSlotStart?: string;
  timeSlotEnd?: string;
  notes?: string;
  attemptNumber: number;
  maxAttempts: number;
}

export default function DeliveryTaskDetail() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // POD fields
  const [receiverName, setReceiverName] = useState('');
  const [receiverRelation, setReceiverRelation] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [codCollected, setCodCollected] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [notes, setNotes] = useState('');

  // Modal states
  const [showSignature, setShowSignature] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  const loadTask = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    await api.loadToken();
    const response = await api.getTask(taskId);

    if (response.success && response.data) {
      setTask(response.data);
      if (response.data.isCod && response.data.codAmount) {
        setCodCollected(response.data.codAmount.toString());
      }
    } else {
      Alert.alert('Error', response.error || 'Failed to load task');
      router.back();
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleCall = () => {
    if (task?.contactPhone) {
      Linking.openURL(`tel:${task.contactPhone}`);
    }
  };

  const handleNavigate = () => {
    if (task?.latitude && task?.longitude) {
      const url = `https://maps.google.com/maps?daddr=${task.latitude},${task.longitude}`;
      Linking.openURL(url);
    } else if (task?.address) {
      const url = `https://maps.google.com/maps?daddr=${encodeURIComponent(task.address)}`;
      Linking.openURL(url);
    }
  };

  const handleFailed = () => {
    router.push({
      pathname: '/(app)/(delivery)/failed',
      params: { taskId: task?.id, taskType: task?.type },
    });
  };

  const validatePOD = (): boolean => {
    if (!receiverName.trim()) {
      Alert.alert('Error', 'Please enter receiver name');
      return false;
    }

    if (!signature) {
      Alert.alert('Error', 'Please capture signature');
      return false;
    }

    if (task?.isCod && task.codAmount > 0) {
      const collected = parseFloat(codCollected) || 0;
      if (collected < task.codAmount) {
        Alert.alert('Error', `Full COD amount (${task.codAmount}) must be collected`);
        return false;
      }
    }

    return true;
  };

  const handleComplete = async () => {
    if (!validatePOD() || !task) return;

    setSubmitting(true);

    try {
      // Get current location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          location = await Location.getCurrentPositionAsync({});
        }
      } catch (e) {
        console.log('Location error:', e);
      }

      const response = await api.completeTask(task.id, {
        podReceiverName: receiverName.trim(),
        podRelation: receiverRelation.trim() || undefined,
        podSignature: signature || undefined,
        podPhoto: photo || undefined,
        codCollected: parseFloat(codCollected) || 0,
        paymentMode: task.isCod ? paymentMode : undefined,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'Delivery completed successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to complete delivery');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading task...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Task Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.taskNumber}>{task.taskNumber}</Text>
              <Text style={styles.awbNumber}>{task.awbNumber}</Text>
            </View>
            <View style={[styles.statusBadge, task.status === 'IN_PROGRESS' && styles.statusInProgress]}>
              <Text style={styles.statusText}>{task.status}</Text>
            </View>
          </View>
          {task.attemptNumber > 0 && (
            <Text style={styles.attemptText}>
              Attempt {task.attemptNumber + 1} of {task.maxAttempts}
            </Text>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consignee</Text>
          <View style={styles.card}>
            <View style={styles.contactInfo}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <Text style={styles.contactName}>{task.contactName}</Text>
            </View>
            <TouchableOpacity style={styles.contactAction} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#3b82f6" />
              <Text style={styles.contactActionText}>{task.contactPhone}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TouchableOpacity style={styles.card} onPress={handleNavigate}>
            <View style={styles.addressContent}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <View style={styles.addressText}>
                <Text style={styles.address}>{task.address}</Text>
                <Text style={styles.pincode}>{task.city} - {task.pincode}</Text>
              </View>
            </View>
            <Ionicons name="navigate" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        {/* COD Section */}
        {task.isCod && task.codAmount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COD Collection</Text>
            <View style={styles.card}>
              <View style={styles.codHeader}>
                <Text style={styles.codLabel}>Amount to Collect</Text>
                <Text style={styles.codAmount}>₹{task.codAmount}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter collected amount"
                keyboardType="numeric"
                value={codCollected}
                onChangeText={setCodCollected}
              />
              <View style={styles.paymentModes}>
                {(['CASH', 'UPI', 'CARD'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.paymentMode, paymentMode === mode && styles.paymentModeActive]}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Ionicons
                      name={mode === 'CASH' ? 'cash-outline' : mode === 'UPI' ? 'phone-portrait-outline' : 'card-outline'}
                      size={20}
                      color={paymentMode === mode ? '#fff' : '#666'}
                    />
                    <Text style={[styles.paymentModeText, paymentMode === mode && styles.paymentModeTextActive]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* POD Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proof of Delivery</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Receiver Name *"
              value={receiverName}
              onChangeText={setReceiverName}
            />
            <TextInput
              style={styles.input}
              placeholder="Relation (Self, Guard, Family, etc.)"
              value={receiverRelation}
              onChangeText={setReceiverRelation}
            />

            <View style={styles.podButtons}>
              <TouchableOpacity
                style={[styles.podButton, signature && styles.podButtonComplete]}
                onPress={() => setShowSignature(true)}
              >
                <Ionicons
                  name={signature ? 'checkmark-circle' : 'pencil-outline'}
                  size={24}
                  color={signature ? '#10b981' : '#666'}
                />
                <Text style={[styles.podButtonText, signature && styles.podButtonTextComplete]}>
                  {signature ? 'Signature Captured' : 'Capture Signature'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.podButton, photo && styles.podButtonComplete]}
                onPress={() => setShowPhoto(true)}
              >
                <Ionicons
                  name={photo ? 'checkmark-circle' : 'camera-outline'}
                  size={24}
                  color={photo ? '#10b981' : '#666'}
                />
                <Text style={[styles.podButtonText, photo && styles.podButtonTextComplete]}>
                  {photo ? 'Photo Captured' : 'Capture Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add delivery notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Spacer for bottom buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.failButton} onPress={handleFailed}>
          <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
          <Text style={styles.failButtonText}>Failed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.completeButton, submitting && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>Complete Delivery</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <SignatureCapture
        visible={showSignature}
        onCapture={(sig) => {
          setSignature(sig);
          setShowSignature(false);
        }}
        onClose={() => setShowSignature(false)}
        receiverName={receiverName || undefined}
      />

      <PhotoCapture
        visible={showPhoto}
        onCapture={(uri) => {
          setPhoto(uri);
          setShowPhoto(false);
        }}
        onClose={() => setShowPhoto(false)}
        title="Capture POD Photo"
        instructions="Take a clear photo of the delivered package"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  awbNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusInProgress: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  attemptText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  contactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
  },
  contactActionText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  addressContent: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  addressText: {
    flex: 1,
  },
  address: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
  },
  pincode: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  codHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codLabel: {
    fontSize: 14,
    color: '#666',
  },
  codAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paymentModes: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  paymentModeActive: {
    backgroundColor: '#3b82f6',
  },
  paymentModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  paymentModeTextActive: {
    color: '#fff',
  },
  podButtons: {
    gap: 12,
  },
  podButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  podButtonComplete: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderStyle: 'solid',
  },
  podButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  podButtonTextComplete: {
    color: '#059669',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 32,
  },
  failButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  failButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
