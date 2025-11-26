import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Bell,
  Moon,
  Globe,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Cloud,
} from 'lucide-react-native';

import { useAuth } from '~/hooks/useAuth';
import { useSettings } from '~/hooks/useSettings';
import { useSyncStatus } from '~/hooks/useSync';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { status, pendingCount } = useSyncStatus();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>
                {user?.roles?.includes('immersion') ? 'Immersion' :
                 user?.roles?.includes('learner') ? 'Learner' : 'Free'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.syncCard}>
          <Cloud size={24} color="#6366f1" />
          <View style={styles.syncInfo}>
            <Text style={styles.syncStatus}>
              {status === 'syncing' ? 'Syncing...' :
               status === 'error' ? 'Sync Error' :
               pendingCount > 0 ? `${pendingCount} changes pending` : 'All synced'}
            </Text>
            <Text style={styles.syncSubtext}>Last sync: Just now</Text>
          </View>
        </View>
      </View>

      {/* Learning Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Learning</Text>

        <SettingItem
          icon={<Globe size={22} color="#6b7280" />}
          title="Target HSK Level"
          value={`HSK ${settings.targetHskLevel}`}
          onPress={() => {}}
        />

        <SettingToggle
          icon={<Moon size={22} color="#6b7280" />}
          title="Show Pinyin"
          value={settings.showPinyin}
          onValueChange={(value) => updateSettings({ showPinyin: value })}
        />

        <SettingToggle
          icon={<Bell size={22} color="#6b7280" />}
          title="Daily Reminder"
          value={settings.dailyReminder}
          onValueChange={(value) => updateSettings({ dailyReminder: value })}
        />
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <SettingItem
          icon={<User size={22} color="#6b7280" />}
          title="Edit Profile"
          onPress={() => {}}
        />

        <SettingItem
          icon={<CreditCard size={22} color="#6b7280" />}
          title="Subscription"
          value={user?.roles?.includes('immersion') ? 'Immersion' :
                 user?.roles?.includes('learner') ? 'Learner' : 'Free'}
          onPress={() => {}}
        />

        <SettingItem
          icon={<HelpCircle size={22} color="#6b7280" />}
          title="Help & Support"
          onPress={() => {}}
        />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={22} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Kairos v0.1.0</Text>
    </ScrollView>
  );
}

function SettingItem({
  icon,
  title,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.settingTitle}>{title}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <ChevronRight size={20} color="#6b7280" />
    </TouchableOpacity>
  );
}

function SettingToggle({
  icon,
  title,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingItem}>
      {icon}
      <Text style={styles.settingTitle}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#374151', true: '#6366f1' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  profileEmail: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  tierBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  tierText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  syncInfo: {
    marginLeft: 12,
    flex: 1,
  },
  syncStatus: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  syncSubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 32,
  },
});
