import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../../stores/auth';

export default function HubDashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Mock data
  const { data: stats, refetch } = useQuery({
    queryKey: ['hub-stats'],
    queryFn: async () => ({
      pendingInscan: 45,
      pendingOutscan: 32,
      activeTrips: 3,
      totalShipments: 156,
      readyForDispatch: 28,
      handoverPending: 12,
    }),
  });

  const { data: recentScans } = useQuery({
    queryKey: ['recent-scans'],
    queryFn: async () => [
      { id: '1', awb: 'AWB001234567', type: 'INSCAN', time: '5 min ago' },
      { id: '2', awb: 'AWB001234568', type: 'OUTSCAN', time: '12 min ago' },
      { id: '3', awb: 'AWB001234569', type: 'LOAD', time: '15 min ago' },
      { id: '4', awb: 'AWB001234570', type: 'INSCAN', time: '22 min ago' },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getScanTypeColor = (type: string) => {
    switch (type) {
      case 'INSCAN': return '#3B82F6';
      case 'OUTSCAN': return '#10B981';
      case 'LOAD': return '#8B5CF6';
      case 'UNLOAD': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="business" size={32} color="#F59E0B" />
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Welcome, {user?.name?.split(' ')[0] || 'Operator'}!</Text>
            <Text style={styles.welcomeSubtitle}>Hub: {user?.hubCode || 'DEL'} - Delhi Hub</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="enter-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats?.pendingInscan || 0}</Text>
            <Text style={styles.statLabel}>Pending Inscan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="exit-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{stats?.pendingOutscan || 0}</Text>
            <Text style={styles.statLabel}>Pending Outscan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="car-outline" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats?.activeTrips || 0}</Text>
            <Text style={styles.statLabel}>Active Trips</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="cube-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{stats?.totalShipments || 0}</Text>
            <Text style={styles.statLabel}>Total Shipments</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="scan" size={28} color="#3B82F6" />
              </View>
              <Text style={styles.actionText}>INSCAN</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="scan-outline" size={28} color="#10B981" />
              </View>
              <Text style={styles.actionText}>OUTSCAN</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="arrow-up-circle" size={28} color="#8B5CF6" />
              </View>
              <Text style={styles.actionText}>LOAD</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="arrow-down-circle" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>UNLOAD</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="swap-horizontal" size={28} color="#EC4899" />
              </View>
              <Text style={styles.actionText}>HANDOVER</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#CFFAFE' }]}>
                <Ionicons name="analytics" size={28} color="#06B6D4" />
              </View>
              <Text style={styles.actionText}>REPORTS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Optimizer Card */}
        <TouchableOpacity
          style={styles.optimizerCard}
          onPress={() => router.push('/(app)/(hub)/routes')}
        >
          <View style={styles.optimizerHeader}>
            <View style={styles.optimizerIcon}>
              <Ionicons name="map" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.optimizerText}>
              <Text style={styles.optimizerTitle}>Route Optimizer</Text>
              <Text style={styles.optimizerSubtitle}>
                {stats?.readyForDispatch || 0} shipments ready for dispatch
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Recent Scans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.recentList}>
            {recentScans?.map((scan) => (
              <View key={scan.id} style={styles.scanItem}>
                <View style={[styles.scanTypeBadge, { backgroundColor: getScanTypeColor(scan.type) + '20' }]}>
                  <Text style={[styles.scanTypeText, { color: getScanTypeColor(scan.type) }]}>
                    {scan.type}
                  </Text>
                </View>
                <Text style={styles.scanAwb}>{scan.awb}</Text>
                <Text style={styles.scanTime}>{scan.time}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#B45309',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '30%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  optimizerCard: {
    backgroundColor: '#4F46E5',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
  },
  optimizerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optimizerIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizerText: {
    flex: 1,
  },
  optimizerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optimizerSubtitle: {
    fontSize: 14,
    color: '#C7D2FE',
    marginTop: 2,
  },
  recentList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  scanTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scanTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scanAwb: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'monospace',
  },
  scanTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
