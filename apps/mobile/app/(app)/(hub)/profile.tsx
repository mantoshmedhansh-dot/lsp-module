import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../../../stores/auth';

export default function HubProfile() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#F59E0B" />
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.role}>Hub Operator</Text>
          <View style={styles.hubBadge}>
            <Ionicons name="business" size={16} color="#F59E0B" />
            <Text style={styles.hubText}>{user?.hubCode || 'DEL'} - Delhi Hub</Text>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#6B7280" />
              <Text style={styles.infoLabel}>Email</Text>
            </View>
            <Text style={styles.infoValue}>{user?.email || '-'}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#6B7280" />
              <Text style={styles.infoLabel}>Phone</Text>
            </View>
            <Text style={styles.infoValue}>{user?.phone || '-'}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Operations</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>156</Text>
              <Text style={styles.statLabel}>Inscans</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>142</Text>
              <Text style={styles.statLabel}>Outscans</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#8B5CF6' }]}>8</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#EC4899' }]}>3</Text>
              <Text style={styles.statLabel}>Handovers</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="time-outline" size={20} color="#4B5563" />
            <Text style={styles.actionText}>Activity Log</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="settings-outline" size={20} color="#4B5563" />
            <Text style={styles.actionText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="help-circle-outline" size={20} color="#4B5563" />
            <Text style={styles.actionText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  role: {
    fontSize: 16,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '500',
  },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  hubText: {
    fontSize: 14,
    color: '#B45309',
    fontWeight: '500',
  },
  infoSection: {
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#4B5563',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
});
