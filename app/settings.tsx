import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Platform, Image } from 'react-native';
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

  const [isAdmin, setIsAdmin] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    checkAdminAccess();
    loadProfile();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    // Check if email is admin
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com'];
    setIsAdmin(adminEmails.includes(user.email || ''));
  };

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('username, profile_photo_url')
      .eq('id', user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setProfilePhoto(data.profile_photo_url || '');
    }
  };

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
      padding: Spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      ...Typography.title,
      color: '#FFFFFF',
      fontSize: 28,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 20,
    },
    profileEmail: {
      ...Typography.body,
      color: colors.textSecondary,
      marginTop: 4,
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
      fontSize: 10,
    },
    section: {
      marginTop: Spacing.md,
    },
    sectionTitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 12,
      fontWeight: '600',
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
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingTextContainer: {
      flex: 1,
    },
    settingTitle: {
      ...Typography.body,
      color: colors.text,
      fontSize: 16,
    },
    settingSubtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
      fontSize: 13,
    },
    settingValue: {
      ...Typography.body,
      color: colors.textSecondary,
      marginRight: Spacing.sm,
      fontSize: 15,
    },
    colorOptions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    colorOption: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: colors.text,
    },
    appearanceOptions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    appearanceOption: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    appearanceOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    appearanceText: {
      ...Typography.caption,
      color: colors.text,
      fontSize: 13,
    },
    appearanceTextSelected: {
      color: '#FFFFFF',
    },
    logoutButton: {
      backgroundColor: '#FF3B30',
      margin: Spacing.md,
      marginTop: Spacing.xl,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
    },
    logoutText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    versionText: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginVertical: Spacing.lg,
      fontSize: 12,
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

function setTheme(theme: 'System' | 'Light' | 'Dark') {
    const root = document.documentElement;

    if (theme === 'Dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    if (theme === 'Light') {
        root.classList.add('light');
    } else {
        root.classList.remove('light');
    }

    // If "System", you can check prefers-color-scheme
    if (theme === 'System') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }
}

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
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{username || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tierNames[tier]}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ACCOUNT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <SettingRow 
            icon="mail-outline" 
            title="Email" 
            value={user?.email || ''}
          />
          <SettingRow 
            icon="card-outline" 
            title="Subscription" 
            value={tierNames[tier]}
            onPress={() => router.push('/subscription')}
          />
          <SettingRow 
            icon="arrow-up-circle-outline" 
            title="Upgrade plan" 
            onPress={() => router.push('/subscription')}
          />
          <SettingRow 
            icon="refresh-outline" 
            title="Restore purchases" 
            onPress={() => router.push('/subscription')}
          />
          <SettingRow 
            icon="receipt-outline" 
            title="Orders" 
            onPress={() => router.push('/orders')}
          />
          <SettingRow 
            icon="person-circle-outline" 
            title="Personalization" 
            onPress={() => router.push('/personalization')}
          />
          <SettingRow 
            icon="notifications-outline" 
            title="Notifications" 
            onPress={() => router.push('/notifications')}
          />
          <SettingRow 
            icon="grid-outline" 
            title="Apps & connectors" 
            onPress={() => {}}
          />
          <SettingRow 
            icon="shield-checkmark-outline" 
            title="Parental controls" 
            onPress={() => router.push('/parental-controls')}
          />
          <SettingRow 
            icon="document-lock-outline" 
            title="Data controls" 
            onPress={() => router.push('/data-controls')}
          />
          <SettingRow 
            icon="archive-outline" 
            title="Archived chats" 
            onPress={() => router.push('/archived-chats')}
          />
          <SettingRow 
            icon="lock-closed-outline" 
            title="Security" 
            onPress={() => router.push('/security')}
          />
        </View>

        {/* APP SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP SETTINGS</Text>
          <SettingRow 
            icon="globe-outline" 
            title="App language" 
            value={settings.appLanguage}
            onPress={() => router.push('/languages')}
          />
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="contrast-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Appearance</Text>
                <View style={styles.appearanceOptions}>
                  {appearanceOptions.map(option => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => updateSetting('appearance', option)}
                      style={[
                        styles.appearanceOption,
                        settings.appearance === option && styles.appearanceOptionSelected,
                      ]}
                    >
                      <Text style={[
                        styles.appearanceText,
                        settings.appearance === option && styles.appearanceTextSelected,
                      ]}>
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

          <SettingRow 
            icon="language-outline" 
            title="Main language for speech" 
            value={settings.mainLanguage}
            onPress={() => router.push('/languages')}
          />
          
          <SettingRow 
            icon="mic-outline" 
            title="Voice selection" 
            value={settings.voiceSelection}
          />

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

        {/* ADMIN DASHBOARD (HIDDEN FOR NON-ADMINS) */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADMIN</Text>
            <SettingRow 
              icon="shield-outline" 
              title="Admin Dashboard" 
              subtitle="Full system control"
              onPress={() => router.push('/admin')}
            />
            <SettingRow 
              icon="mail-outline" 
              title="Send Email to Users" 
              subtitle="Broadcast messages to users"
              onPress={() => router.push('/admin-email')}
            />
          </View>
        )}

        {/* ABOUT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <SettingRow 
            icon="bug-outline" 
            title="Report bug" 
            onPress={() => router.push('/bugreport')}
          />
          <SettingRow 
            icon="help-circle-outline" 
            title="Help Center" 
            onPress={() => {}}
          />
          <SettingRow 
            icon="document-text-outline" 
            title="Terms of Use" 
            onPress={() => router.push('/content-viewer?type=terms_of_use')}
          />
          <SettingRow 
            icon="shield-checkmark-outline" 
            title="Privacy Policy" 
            onPress={() => router.push('/content-viewer?type=privacy_policy')}
          />
          <SettingRow 
            icon="help-circle-outline" 
            title="FAQ" 
            onPress={() => router.push('/content-viewer?type=faq')}
          />
        </View>

        <Text style={styles.versionText}>HaitianChatGpt for iOS – v1.0.0</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
