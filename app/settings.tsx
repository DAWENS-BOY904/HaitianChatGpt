import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { tier } = useSubscription();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const handleLogout = async () => {
    showAlert('Confirm', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const checkAdminAccess = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (data?.role === 'admin') {
      router.push('/admin');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      ...Typography.heading,
      color: colors.text,
    },
    profileSection: {
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.heading,
      color: '#FFFFFF',
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      ...Typography.heading,
      color: colors.text,
    },
    profileEmail: {
      ...Typography.body,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginTop: Spacing.xs,
      alignSelf: 'flex-start',
    },
    badgeText: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    section: {
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: Spacing.md,
    },
    settingIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingTextContainer: {
      flex: 1,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
    },
    settingSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    settingValue: {
      ...Typography.body,
      color: colors.textSecondary,
      marginRight: Spacing.sm,
    },
    colorOptions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    colorOption: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: colors.text,
    },
    logoutButton: {
      backgroundColor: '#FF3B30',
      margin: Spacing.md,
      marginTop: Spacing.xl,
      borderRadius: BorderRadius.sm,
      padding: Spacing.md,
      alignItems: 'center',
    },
    logoutText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    versionText: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginVertical: Spacing.lg,
    },
  });

  const SettingRow = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onPress, 
    rightElement 
  }: { 
    icon: string; 
    title: string; 
    subtitle?: string; 
    value?: string; 
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={20} color={colors.text} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (
        <>
          {value && <Text style={styles.settingValue}>{value}</Text>}
          {onPress && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
        </>
      )}
    </TouchableOpacity>
  );

  const appearanceOptions: Array<'System' | 'Light' | 'Dark'> = ['System', 'Light', 'Dark'];
  const accentColors = ['#10A37F', '#0084FF', '#FF3B30', '#FF9500', '#5856D6'];

  const tierNames: Record<string, string> = {
    free: 'Free',
    premium_monthly: 'Premium',
    premium_yearly: 'Premium',
    lifetime: 'Lifetime Pro',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView>
        <TouchableOpacity style={styles.profileSection} onPress={() => router.push('/profile')}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.email?.[0].toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.username || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tierNames[tier]}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SettingRow 
            icon="card-outline" 
            title="Subscription" 
            value={tierNames[tier]}
            onPress={() => router.push('/subscription')}
          />
          <SettingRow icon="card-outline" title="Payment methods" onPress={() => router.push('/payment')} />
          <SettingRow icon="refresh-outline" title="Restore purchases" onPress={() => router.push('/subscription')} />
          <SettingRow icon="receipt-outline" title="Orders" onPress={() => {}} />
          <SettingRow icon="information-circle-outline" title="About" onPress={() => router.push('/about')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <SettingRow icon="person-outline" title="Personalization" onPress={() => router.push('/personalization')} />
          <SettingRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
          <SettingRow icon="grid-outline" title="Apps & connectors" onPress={() => {}} />
          <SettingRow icon="shield-outline" title="Parental controls" onPress={() => router.push('/parental-controls')} />
          <SettingRow icon="document-text-outline" title="Data controls" onPress={() => router.push('/data-controls')} />
          <SettingRow icon="archive-outline" title="Archived chats" onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <SettingRow icon="globe-outline" title="App language" value={settings.appLanguage} onPress={() => router.push('/languages')} />
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="contrast-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Appearance</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                  {appearanceOptions.map(option => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateSetting('appearance', option)}
                      style={{
                        paddingHorizontal: Spacing.sm,
                        paddingVertical: 4,
                        borderRadius: BorderRadius.sm,
                        backgroundColor: settings.appearance === option ? colors.primary : colors.surface,
                      }}
                    >
                      <Text style={{
                        ...Typography.caption,
                        color: settings.appearance === option ? '#FFFFFF' : colors.text,
                      }}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="color-palette-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Accent color</Text>
                <View style={styles.colorOptions}>
                  {accentColors.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => updateSetting('accentColor', color)}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        settings.accentColor === color && styles.colorOptionSelected,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>

          <SettingRow 
            icon="phone-portrait-outline" 
            title="Haptic feedback" 
            rightElement={
              <Switch
                value={settings.hapticFeedback}
                onValueChange={(value) => updateSetting('hapticFeedback', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />

          <SettingRow 
            icon="text-outline" 
            title="Auto spelling correction" 
            rightElement={
              <Switch
                value={settings.autoSpelling}
                onValueChange={(value) => updateSetting('autoSpelling', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />

          <SettingRow icon="language-outline" title="Main language for speech" value={settings.mainLanguage} />
          <SettingRow icon="mic-outline" title="Voice selection" value={settings.voiceSelection} />

          <SettingRow 
            icon="chatbubbles-outline" 
            title="Background conversations" 
            rightElement={
              <Switch
                value={settings.backgroundConversations}
                onValueChange={(value) => updateSetting('backgroundConversations', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />

          <SettingRow 
            icon="create-outline" 
            title="Autocomplete" 
            rightElement={
              <Switch
                value={settings.autocomplete}
                onValueChange={(value) => updateSetting('autocomplete', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />

          <SettingRow 
            icon="trending-up-outline" 
            title="Trending searches" 
            rightElement={
              <Switch
                value={settings.trendingSearches}
                onValueChange={(value) => updateSetting('trendingSearches', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />

          <SettingRow 
            icon="list-outline" 
            title="Follow-up suggestions" 
            rightElement={
              <Switch
                value={settings.followupSuggestions}
                onValueChange={(value) => updateSetting('followupSuggestions', value)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <SettingRow icon="bug-outline" title="Report bug" onPress={() => router.push('/bugreport')} />
          <SettingRow icon="help-circle-outline" title="Help Center" onPress={() => {}} />
          <SettingRow icon="document-text-outline" title="Terms of Use" onPress={() => {}} />
          <SettingRow icon="shield-checkmark-outline" title="Privacy Policy" onPress={() => {}} />
        </View>

        <Text style={styles.versionText}>HaitianChatGpt for iOS – v1.0.0</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
