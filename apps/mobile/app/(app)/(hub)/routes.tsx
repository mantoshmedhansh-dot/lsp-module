import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

interface DeliveryStop {
  id: string;
  sequence: number;
  awbNumber: string;
  consigneeName: string;
  address: string;
  pincode: string;
  isCod: boolean;
  codAmount: number;
  weight: number;
}

interface Vehicle {
  id: string;
  number: string;
  type: string;
  capacity: number;
  available: boolean;
  utilization: number;
}

export default function RouteOptimizer() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Mock data
  const { data: stops } = useQuery({
    queryKey: ['delivery-stops'],
    queryFn: async (): Promise<DeliveryStop[]> => [
      { id: '1', sequence: 1, awbNumber: 'AWB001234567', consigneeName: 'Rahul Sharma', address: '101 MG Road', pincode: '560001', isCod: true, codAmount: 1500, weight: 2.5 },
      { id: '2', sequence: 2, awbNumber: 'AWB001234568', consigneeName: 'Priya Patel', address: '45 Green Valley', pincode: '560034', isCod: false, codAmount: 0, weight: 1.2 },
      { id: '3', sequence: 3, awbNumber: 'AWB001234569', consigneeName: 'Amit Kumar', address: '78 Tech Park', pincode: '560066', isCod: true, codAmount: 2500, weight: 4.0 },
      { id: '4', sequence: 4, awbNumber: 'AWB001234570', consigneeName: 'Sneha Reddy', address: '23 Lake View', pincode: '560102', isCod: false, codAmount: 0, weight: 0.8 },
      { id: '5', sequence: 5, awbNumber: 'AWB001234571', consigneeName: 'Vijay Singh', address: '56 Brigade Road', pincode: '560025', isCod: true, codAmount: 3200, weight: 3.5 },
    ],
  });

  const { data: vehicles } = useQuery({
    queryKey: ['available-vehicles'],
    queryFn: async (): Promise<Vehicle[]> => [
      { id: '1', number: 'KA-01-AB-1234', type: 'BIKE', capacity: 25, available: true, utilization: 48 },
      { id: '2', number: 'KA-01-CD-5678', type: 'TEMPO', capacity: 500, available: true, utilization: 24 },
      { id: '3', number: 'KA-01-EF-9012', type: 'EECO', capacity: 250, available: false, utilization: 0 },
    ],
  });

  const totalWeight = stops?.reduce((sum, s) => sum + s.weight, 0) || 0;
  const totalCod = stops?.reduce((sum, s) => sum + s.codAmount, 0) || 0;

  const handleOptimize = () => {
    setIsOptimizing(true);
    // Simulate optimization
    setTimeout(() => {
      setIsOptimizing(false);
      Alert.alert('Route Optimized', 'Delivery sequence has been optimized for minimum travel distance.');
    }, 1500);
  };

  const handleCreateRun = () => {
    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    Alert.alert(
      'Create Delivery Run',
      `Create delivery run with ${stops?.length} stops?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => {
            Alert.alert('Success', 'Delivery run created successfully!');
          },
        },
      ]
    );
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'BIKE': return 'bicycle';
      case 'TEMPO': return 'car';
      case 'EECO': return 'bus';
      default: return 'car';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Ionicons name="cube-outline" size={24} color="#4F46E5" />
            <Text style={styles.summaryValue}>{stops?.length || 0}</Text>
            <Text style={styles.summaryLabel}>Stops</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="scale-outline" size={24} color="#10B981" />
            <Text style={styles.summaryValue}>{totalWeight.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>kg Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="cash-outline" size={24} color="#F59E0B" />
            <Text style={styles.summaryValue}>₹{(totalCod/1000).toFixed(1)}K</Text>
            <Text style={styles.summaryLabel}>COD</Text>
          </View>
        </View>

        {/* Vehicle Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Vehicle</Text>
          <View style={styles.vehicleList}>
            {vehicles?.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={[
                  styles.vehicleCard,
                  selectedVehicle === vehicle.id && styles.vehicleCardSelected,
                  !vehicle.available && styles.vehicleCardDisabled,
                ]}
                onPress={() => vehicle.available && setSelectedVehicle(vehicle.id)}
                disabled={!vehicle.available}
              >
                <View style={styles.vehicleHeader}>
                  <Ionicons
                    name={getVehicleIcon(vehicle.type) as any}
                    size={24}
                    color={selectedVehicle === vehicle.id ? '#4F46E5' : '#6B7280'}
                  />
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleNumber}>{vehicle.number}</Text>
                    <Text style={styles.vehicleType}>{vehicle.type} - {vehicle.capacity}kg</Text>
                  </View>
                  {selectedVehicle === vehicle.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#4F46E5" />
                  )}
                </View>
                {vehicle.available ? (
                  <View style={styles.utilizationBar}>
                    <View style={styles.utilizationBg}>
                      <View
                        style={[
                          styles.utilizationFill,
                          { width: `${Math.min((totalWeight / vehicle.capacity) * 100, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.utilizationText}>
                      {((totalWeight / vehicle.capacity) * 100).toFixed(0)}% load
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.unavailableText}>Currently in use</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delivery Stops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Sequence</Text>
            <TouchableOpacity
              style={[styles.optimizeButton, isOptimizing && styles.optimizeButtonDisabled]}
              onPress={handleOptimize}
              disabled={isOptimizing}
            >
              <Ionicons name="shuffle" size={16} color="#FFFFFF" />
              <Text style={styles.optimizeText}>
                {isOptimizing ? 'Optimizing...' : 'Optimize'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stopsList}>
            {stops?.map((stop, index) => (
              <View key={stop.id} style={styles.stopCard}>
                <View style={styles.stopSequence}>
                  <Text style={styles.stopSequenceText}>{index + 1}</Text>
                </View>
                <View style={styles.stopContent}>
                  <View style={styles.stopHeader}>
                    <Text style={styles.stopAwb}>{stop.awbNumber}</Text>
                    {stop.isCod && (
                      <View style={styles.codBadge}>
                        <Text style={styles.codBadgeText}>COD ₹{stop.codAmount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.stopName}>{stop.consigneeName}</Text>
                  <Text style={styles.stopAddress}>{stop.address} - {stop.pincode}</Text>
                  <Text style={styles.stopWeight}>{stop.weight} kg</Text>
                </View>
                <TouchableOpacity style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Create Run Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, !selectedVehicle && styles.createButtonDisabled]}
          onPress={handleCreateRun}
          disabled={!selectedVehicle}
        >
          <Ionicons name="rocket" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Delivery Run</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  summary: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  optimizeButtonDisabled: {
    opacity: 0.7,
  },
  optimizeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  vehicleList: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  vehicleCardDisabled: {
    opacity: 0.5,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  vehicleType: {
    fontSize: 14,
    color: '#6B7280',
  },
  utilizationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  utilizationBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  utilizationFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  utilizationText: {
    fontSize: 12,
    color: '#6B7280',
    width: 60,
  },
  unavailableText: {
    fontSize: 12,
    color: '#EF4444',
    fontStyle: 'italic',
  },
  stopsList: {
    gap: 8,
  },
  stopCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  stopSequence: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stopSequenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stopContent: {
    flex: 1,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stopAwb: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  codBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codBadgeText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  stopAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  stopWeight: {
    fontSize: 12,
    color: '#4F46E5',
    marginTop: 4,
  },
  dragHandle: {
    padding: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 56,
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
