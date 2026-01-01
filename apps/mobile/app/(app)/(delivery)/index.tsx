import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
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
  attemptNumber: number;
  maxAttempts: number;
}

export default function DeliveryDashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('pending');

  // Load auth token on mount
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
      default:
        return undefined;
    }
  };

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['delivery-tasks', filter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.getTasks({
        type: 'DELIVERY',
        date: today,
        status: filter !== 'all' ? getFilterStatus() : undefined,
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
      pathname: '/(app)/(delivery)/delivery/[taskId]',
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
    codPending: tasks
      .filter((t) => t.isCod && (t.status === 'PENDING' || t.status === 'IN_PROGRESS'))
      .reduce((sum, t) => sum + (t.codAmount || 0), 0),
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity style={styles.taskCard} onPress={() => handleTaskPress(item)}>
      <View style={styles.taskHeader}>
        <View style={styles.sequenceBadge}>
          <Text style={styles.sequenceText}>#{item.sequence || 1}</Text>
        </View>
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
          <Ionicons name="person-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.contactName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText} numberOfLines={2}>
            {item.address}, {item.city} - {item.pincode}
          </Text>
        </View>
        {item.attemptNumber > 0 && (
          <View style={styles.detailRow}>
            <Ionicons name="refresh-outline" size={16} color="#f59e0b" />
            <Text style={[styles.detailText, { color: '#f59e0b' }]}>
              Attempt {item.attemptNumber + 1} of {item.maxAttempts}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.taskFooter}>
        {item.isCod && item.codAmount > 0 && (
          <View style={styles.codBadge}>
            <Ionicons name="cash-outline" size={16} color="#f59e0b" />
            <Text style={styles.codText}>COD: ₹{item.codAmount}</Text>
          </View>
        )}
        {(item.status === 'PENDING' || item.status === 'IN_PROGRESS') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.deliverButton}
              onPress={() => handleTaskPress(item)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.deliverText}>Deliver</Text>
            </TouchableOpacity>
          </View>
        )}
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
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* COD Summary */}
      {stats.codPending > 0 && (
        <View style={styles.codSummary}>
          <Ionicons name="cash" size={24} color="#f59e0b" />
          <View style={styles.codInfo}>
            <Text style={styles.codTitle}>COD to Collect</Text>
            <Text style={styles.codAmountLarge}>₹{stats.codPending.toLocaleString()}</Text>
          </View>
        </View>
      )}

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
            {filter === 'pending' ? (
              <>
                <Ionicons name="checkmark-done-circle-outline" size={48} color="#10b981" />
                <Text style={styles.emptyText}>All deliveries completed!</Text>
              </>
            ) : (
              <>
                <Ionicons name="cube-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyTextGray}>No {filter} deliveries</Text>
              </>
            )}
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
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  codSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  codInfo: {
    flex: 1,
  },
  codTitle: {
    fontSize: 14,
    color: '#92400e',
  },
  codAmountLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#b45309',
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
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sequenceBadge: {
    backgroundColor: '#4f46e5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sequenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  awbNumber: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'monospace',
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
    alignItems: 'flex-start',
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
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  codText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b45309',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deliverText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#10b981',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyTextGray: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
});
