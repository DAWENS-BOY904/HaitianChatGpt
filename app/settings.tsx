import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import Constants from 'expo-constants';

// App Store configuration
const APP_STORE_ID = 'YOUR_APP_STORE_ID';
const APP_STORE_LINK = `https://apps.apple.com/app/id${APP_STORE_ID}`;
const ITUNES_LOOKUP_URL = `https://itunes.apple.com/lookup?id=${APP_STORE_ID}`;

const getCurrentVersion = (): string => {
  const version = Constants.expoConfig?.version || Constants.manifest?.version;
  return version || '1.0.0';
};

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
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [latestVersion, setLatestVersion] = useState(null);
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    loadProfile();
    setCurrentVersion(getCurrentVersion());
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
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

  const checkForUpdates = useCallback(async () => {
    if (isCheckingVersion) return;
    setIsCheckingVersion(true);
    
    try {
      const response = await fetch(ITUNES_LOOKUP_URL);
      const data = await response.json();
      
      if (data.resultCount > 0) {
        const appStoreVersion = data.results[0].version;
        setLatestVersion(appStoreVersion);
        
        const current = currentVersion.split('.').map(Number);
        const latest = appStoreVersion.split('.').map(Number);
        
        let isUpdateAvailable = false;
        for (let i = 0; i < Math.max(current.length, latest.length); i++) {
          const currentPart = current[i] || 0;
          const latestPart = latest[i] || 0;
          if (latestPart > currentPart) {
            isUpdateAvailable = true;
            break;
          } else if (latestPart < currentPart) break;
        }
        
        if (isUpdateAvailable) {
          Alert.alert(
            'Update Available',
            `A new version (${appStoreVersion}) is available. You are currently on version ${currentVersion}.`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Update Now', onPress: () => Linking.openURL(APP_STORE_LINK) },
            ]
          );
        } else {
          Alert.alert('Up to Date', `You have the latest version (${currentVersion}).`, [{ text: 'OK' }]);
        }
      }
    } catch (error) {
      Alert.alert('Check Failed', 'Unable to check for updates.', [{ text: 'OK' }]);
    } finally {
      setIsCheckingVersion(false);
    }
  }, [currentVersion, isCheckingVersion]);

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

  const tierNames = {
    free: 'Free Plan',
    premium_monthly: 'Premium',
    premium_yearly: 'Premium',
    lifetime: 'Lifetime Pro',
  };

  const styles = StyleSheet.create({
    // Background nwa ki dèyè
    backgroundContainer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    // Container won ki soti anba tankou foto a
    modalContainer: {
      flex: 1,
      backgroundColor: '#1C1C1E', // Background gri fonse tankou foto a
      borderTopLeftRadius: 20,    // Kwen anlè goch won
      borderTopRightRadius: 20,   // Kwen anlè dwat won
      marginTop: 40,              // Espas anlè pou wè background nwa a
      overflow: 'hidden',
    },
    // Header style
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 16,
      paddingBottom: 10,
      paddingHorizontal: 20,
      position: 'relative',
      backgroundColor: '#1C1C1E',
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#2C2C2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    // Profile section
    profileSection: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
      backgroundColor: '#1C1C1E',
    },
    avatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#2C2C2E',
      overflow: 'hidden',
      marginBottom: 12,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    profileName: {
      fontSize: 22,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    profileUsername: {
      fontSize: 15,
      color: '#8E8E93',
      marginBottom: 12,
    },
    editProfileButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#3A3A3C',
    },
    editProfileText: {
      fontSize: 15,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    // ScrollView content
    scrollContent: {
      flex: 1,
    },
    // Section styling
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#8E8E93',
      marginBottom: 8,
      marginLeft: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Card styling
    card: {
      backgroundColor: '#2C2C2E', // Pi fonse pase background la
      borderRadius: 12,
      overflow: 'hidden',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: '#3A3A3C',
    },
    settingItemLast: {
      borderBottomWidth: 0,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
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
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '400',
    },
    settingSubtitle: {
      fontSize: 13,
      color: '#8E8E93',
      marginTop: 2,
    },
    settingValue: {
      fontSize: 16,
      color: '#8E8E93',
      marginRight: 4,
    },
    chevron: {
      marginLeft: 4,
    },
    // Switch styling
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Color options
    colorOptions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    colorOption: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: '#FFFFFF',
    },
    // Appearance options
    appearanceOptions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    appearanceOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#3A3A3C',
    },
    appearanceOptionSelected: {
      backgroundColor: '#0A84FF',
    },
    appearanceText: {
      fontSize: 13,
      color: '#FFFFFF',
    },
    // Logout button
    logoutButton: {
      marginHorizontal: 16,
      marginTop: 32,
      marginBottom: 40,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
    },
    logoutText: {
      fontSize: 17,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    // Version text
    versionText: {
      fontSize: 12,
      color: '#8E8E93',
      textAlign: 'center',
      marginBottom: 20,
    },
    loadingIndicator: {
      marginRight: 8,
    },
  });

  const SettingRow = ({ 
    icon, 
    title, 
    subtitle,
    value, 
    onPress, 
    rightElement,
    isLast = false,
    isLoading = false,
  }) => (
    <TouchableOpacity 
      style={[styles.settingItem, isLast && styles.settingItemLast]} 
      onPress={onPress}
      activeOpacity={0.6}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.switchContainer}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#8E8E93" style={styles.loadingIndicator} />
        ) : (
          <>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            {rightElement || (onPress && (
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" style={styles.chevron} />
            ))}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const SwitchRow = ({ icon, title, value, onValueChange, isLast = false }) => (
    <View style={[styles.settingItem, isLast && styles.settingItemLast]}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: '#34C759', false: '#3A3A3C' }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? '#FFFFFF' : '#8E8E93'}
      />
    </View>
  );

  const InlineSettingRow = ({ icon, title, children }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {children}
        </View>
      </View>
    </View>
  );

  const accentColors = ['#10A37F', '#0084FF', '#FF3B30', '#FF9500', '#5856D6'];
  const appearanceOptions = ['System', 'Light', 'Dark'];

  return (
    <View style={styles.backgroundContainer}>
      {/* Container won ki soti anba tankou yon modal */}
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
        >
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarContainer, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.avatarText}>
                    {(username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.profileName}>{username || 'User'}</Text>
            <Text style={styles.profileUsername}>{user?.email}</Text>
            
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.editProfileText}>Edit profile</Text>
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <SettingRow icon="mail-outline" title="Email" value={user?.email} />
              <SettingRow 
                icon="add-circle-outline" 
                title="Subscription" 
                value={tierNames[tier]} 
              />
              <SettingRow 
                icon="arrow-up-circle-outline" 
                title="Upgrade to ChatGPT Plus" 
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
                icon="apps-outline" 
                title="Apps" 
                onPress={() => {}}
              />
              <SettingRow 
                icon="people-outline" 
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
                isLast={true}
              />
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            <View style={styles.card}>
              <SettingRow 
                icon="arrow-up-circle-outline" 
                title="Check for updates" 
                value={latestVersion && latestVersion !== currentVersion ? `${currentVersion} → ${latestVersion}` : currentVersion}
                onPress={checkForUpdates}
                isLoading={isCheckingVersion}
              />
              
              {/* Appearance with inline options */}
              <InlineSettingRow icon="contrast-outline" title="Appearance">
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
                      <Text style={styles.appearanceText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </InlineSettingRow>

              {/* Accent Color */}
              <InlineSettingRow icon="color-palette-outline" title="Accent color">
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
              </InlineSettingRow>

              <SwitchRow 
                icon="phone-portrait-outline" 
                title="Haptic feedback" 
                value={settings.hapticFeedback}
                onValueChange={(v) => updateSetting('hapticFeedback', v)}
              />
              
              <SwitchRow 
                icon="text-outline" 
                title="Auto spelling correction" 
                value={settings.autoSpelling}
                onValueChange={(v) => updateSetting('autoSpelling', v)}
              />
              
              <SettingRow 
                icon="globe-outline" 
                title="App language" 
                value={settings.appLanguage}
                onPress={() => router.push('/languages')}
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
              
              <SwitchRow 
                icon="chatbubbles-outline" 
                title="Background conversations" 
                value={settings.backgroundConversations}
                onValueChange={(v) => updateSetting('backgroundConversations', v)}
              />
              
              <SwitchRow 
                icon="create-outline" 
                title="Autocomplete" 
                value={settings.autocomplete}
                onValueChange={(v) => updateSetting('autocomplete', v)}
              />
              
              <SwitchRow 
                icon="trending-up-outline" 
                title="Trending searches" 
                value={settings.trendE8E93'}
                onValueChange={(v) => updateSetting('trendingSearches', v)}
              />
              
              <SwitchRow 
                icon="list-outline" 
                title="Follow-up suggestions" 
                value={settings.followupSuggestions}
                onValueChange={(v) => updateSetting('followupSuggestions', v)}
                isLast={true}
              />
            </View>
          </View>

          {/* Admin Section */}
          {isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Admin</Text>
              <View style={styles.card}>
                <SettingRow 
                  icon="shield-outline" 
                  title="Admin Dashboard" 
                  subtitle="Full system control"
                  onPress={() => router.push('/admin')}
                />
                <SettingRow 
                  icon="mail-outline" 
                  title="Send Email to Users" 
                  subtitle="Broadcast messages"
                  onPress={() => router.push('/admin-email')}
                  isLast={true}
                />
              </View>
            </View>
          )}

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <SettingRow 
                icon="bug-outline" 
                title="Report bug" 
                onPress={() => router.push('/bugreport')}
              />
              <SettingRow 
                icon="help-circle-outline" 
                title="Help Center" 
                onPress={() => router.push('/help')}
              />
              <SettingRow 
                icon="document-text-outline" 
                title="Terms of Use" 
                onPress={() => router.push('/terms-of-use')}
              />
              <SettingRow 
                icon="shield-checkmark-outline" 
                title="Privacy Policy" 
                onPress={() => router.push('/privacy-policy')}
                isLast={true}
              />
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>HaitianChatGpt for iOS – v{currentVersion}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

