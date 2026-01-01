import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../../stores/auth';
import api from '../../../services/api';

interface Task {
  id: string;
  taskNumber: string;
  awbNumber: string;
  type: string;
  status: string;
  address: string;
  pincode: string;
  city: string;
  contactName: string;
  contactPhone: string;
  isCod: boolean;
  codAmount: number;
  sequence: number;
  scheduledDate: string;
  timeSlotStart?: string;
  timeSlotEnd?: string;
  attemptNumber: number;
  maxAttempts: number;
}

export default function PickupDashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'failed'>('pending');

  useEffect(() => {
    api.loadToken();
  }, []);

  const getFilterStatus = () => {
    switch (filter) {
      case 'pending':
        return 'PENDING,IN_PROGRESS';
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
    }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pickup-tasks', filter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.getTasks({
        type: 'PICKUP',
        date: today,
        status: getFilterStatus(),
        pageSize: 100,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch tasks');
      }

      return response.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleTaskPress = (task: Task) => {
    router.push({
      pathname: '/(app)/(pickup)/pickup/[taskId]',
      params: { taskId: task.id },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return '#f59e0b';
      case 'IN_PROGRESS':
        return '#3b82f6';
      case 'COMPLETED':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const tasks = data?.items || [];

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    failed: tasks.filter((t) => t.status === 'FAILED').length,
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity style={styles.taskCard} onPress={() => handleTaskPress(item)}>
      <View style={styles.taskHeader}>
        <Text style={styles.awbNumber}>{item.awbNumber || item.taskNumber}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.contactName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText} numberOfLines={1}>
            {item.address}, {item.city} - {item.pincode}
          </Text>
        </View>
        {item.timeSlotStart && item.timeSlotEnd && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              {item.timeSlotStart} - {item.timeSlotEnd}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.taskFooter}>
        <View style={styles.callButton}>
          <Ionicons name="call-outline" size={16} color="#3b82f6" />
          <Text style={styles.callText}>{item.contactPhone}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({
    label,
    value,
    count,
  }: {
    label: string;
    value: typeof filter;
    count: number;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading pickups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeCard}>
        <Ionicons name="sunny-outline" size={24} color="#f59e0b" />
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeTitle}>
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Agent'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            You have {stats.pending} pickups scheduled today
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FilterButton label="Pending" value="pending" count={stats.pending} />
        <FilterButton label="Completed" value="completed" count={stats.completed} />
        <FilterButton label="Failed" value="failed" count={stats.failed} />
      </View>

      {/* Task List */}
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={filter === 'pending' ? 'checkmark-circle-outline' : 'cube-outline'}
              size={48}
              color={filter === 'pending' ? '#10b981' : '#9ca3af'}
            />
            <Text style={[styles.emptyText, filter === 'pending' && { color: '#10b981' }]}>
              {filter === 'pending' ? 'All pickups completed!' : `No ${filter} pickups`}
            </Text>
          </View>
        }
      />
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#b45309',
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  awbNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
});
