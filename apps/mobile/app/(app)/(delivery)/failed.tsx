import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';

interface FailureReason {
  code: string;
  label: string;
}

const DEFAULT_DELIVERY_REASONS: FailureReason[] = [
  { code: 'CONSIGNEE_NOT_AVAILABLE', label: 'Consignee not available' },
  { code: 'WRONG_ADDRESS', label: 'Wrong address' },
  { code: 'REFUSED_BY_CONSIGNEE', label: 'Refused by consignee' },
  { code: 'INCOMPLETE_ADDRESS', label: 'Incomplete address' },
  { code: 'CONSIGNEE_OUT_OF_TOWN', label: 'Consignee out of town' },
  { code: 'COD_NOT_READY', label: 'COD not ready' },
  { code: 'RESCHEDULE_REQUESTED', label: 'Reschedule requested' },
  { code: 'VEHICLE_BREAKDOWN', label: 'Vehicle breakdown' },
  { code: 'WEATHER_CONDITIONS', label: 'Weather conditions' },
  { code: 'OTHER', label: 'Other' },
];

const DEFAULT_PICKUP_REASONS: FailureReason[] = [
  { code: 'SHIPPER_NOT_AVAILABLE', label: 'Shipper not available' },
  { code: 'WRONG_ADDRESS', label: 'Wrong address' },
  { code: 'PACKAGE_NOT_READY', label: 'Package not ready' },
  { code: 'SHIPPER_REFUSED', label: 'Shipper refused' },
  { code: 'VEHICLE_BREAKDOWN', label: 'Vehicle breakdown' },
  { code: 'WEATHER_CONDITIONS', label: 'Weather conditions' },
  { code: 'OTHER', label: 'Other' },
];

export default function FailedDeliveryScreen() {
  const { taskId, taskType } = useLocalSearchParams<{
    taskId: string;
    taskType: string;
  }>();

  const [reasons, setReasons] = useState<FailureReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadReasons = useCallback(async () => {
    if (!taskId) {
      // Use default reasons
      setReasons(taskType === 'PICKUP' ? DEFAULT_PICKUP_REASONS : DEFAULT_DELIVERY_REASONS);
      setLoading(false);
      return;
    }

    try {
      await api.loadToken();
      const type = taskType === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
      const response = await api.getFailureReasons(taskId, type);

      if (response.success && response.data) {
        setReasons(response.data);
      } else {
        // Fallback to defaults
        setReasons(taskType === 'PICKUP' ? DEFAULT_PICKUP_REASONS : DEFAULT_DELIVERY_REASONS);
      }
    } catch (error) {
      // Fallback to defaults
      setReasons(taskType === 'PICKUP' ? DEFAULT_PICKUP_REASONS : DEFAULT_DELIVERY_REASONS);
    }

    setLoading(false);
  }, [taskId, taskType]);

  useEffect(() => {
    loadReasons();
  }, [loadReasons]);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a failure reason');
      return;
    }

    if (selectedReason === 'OTHER' && !notes.trim()) {
      Alert.alert('Error', 'Please provide details for "Other" reason');
      return;
    }

    if (!taskId) {
      Alert.alert('Error', 'Task ID is missing');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.failTask(taskId, {
        reason: selectedReason,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        const message = response.message || 'Task marked as failed';
        Alert.alert('Done', message, [
          {
            text: 'OK',
            onPress: () => {
              // Go back twice to return to the task list
              router.back();
              router.back();
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to update task');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonIcon = (code: string): string => {
    switch (code) {
      case 'CONSIGNEE_NOT_AVAILABLE':
      case 'SHIPPER_NOT_AVAILABLE':
        return 'person-outline';
      case 'WRONG_ADDRESS':
      case 'INCOMPLETE_ADDRESS':
        return 'location-outline';
      case 'REFUSED_BY_CONSIGNEE':
      case 'SHIPPER_REFUSED':
        return 'hand-left-outline';
      case 'CONSIGNEE_OUT_OF_TOWN':
        return 'airplane-outline';
      case 'COD_NOT_READY':
        return 'cash-outline';
      case 'RESCHEDULE_REQUESTED':
        return 'calendar-outline';
      case 'PACKAGE_NOT_READY':
        return 'cube-outline';
      case 'VEHICLE_BREAKDOWN':
        return 'car-outline';
      case 'WEATHER_CONDITIONS':
        return 'rainy-outline';
      default:
        return 'help-circle-outline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {taskType === 'PICKUP' ? 'Pickup Failed' : 'Delivery Failed'}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content}>
        {/* Reason Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Reason *</Text>
          <View style={styles.reasonsList}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.code}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.code && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(reason.code)}
              >
                <View style={styles.reasonContent}>
                  <View
                    style={[
                      styles.reasonIcon,
                      selectedReason === reason.code && styles.reasonIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={getReasonIcon(reason.code) as any}
                      size={20}
                      color={selectedReason === reason.code ? '#fff' : '#666'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.code && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </View>
                {selectedReason === reason.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#ef4444" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Additional Notes {selectedReason === 'OTHER' && '*'}
          </Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Enter additional details..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            This will mark the {taskType?.toLowerCase() || 'delivery'} as failed.
            {taskType === 'DELIVERY' && ' If attempts remaining, a new task will be created for rescheduled deliveries.'}
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="close-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Confirm Failed</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    width: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  reasonItemSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  reasonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reasonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonIconSelected: {
    backgroundColor: '#ef4444',
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: '#991b1b',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
