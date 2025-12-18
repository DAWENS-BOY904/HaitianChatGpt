import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordLastChanged, setPasswordLastChanged] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    loadSecuritySettings();
    checkPasswordExpiry();
  }, []);

  const loadSecuritySettings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('security_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setMfaEnabled(data.mfa_enabled);
      setPasswordLastChanged(data.password_last_changed);
    } else if (error?.code === 'PGRST116') {
      // No security settings yet, create default
      await supabase.from('security_settings').insert({
        user_id: user.id,
        mfa_enabled: false,
      });
    }
    setLoading(false);
  };

  const checkPasswordExpiry = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('security_settings')
      .select('password_last_changed, password_expiry_days')
      .eq('user_id', user.id)
      .single();

    if (data) {
      const lastChanged = new Date(data.password_last_changed);
      const now = new Date();
      const daysSinceChange = Math.floor(
        (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceChange >= data.password_expiry_days) {
        showAlert(
          'Password Expired',
          'Your password has expired. Please change it now.',
          [{ text: 'Change Now', onPress: () => setShowPasswordChange(true) }]
        );
      }
    }
  };

  const handleToggleMFA = async (value: boolean) => {
    if (!user) return;

    await supabase
      .from('security_settings')
      .upsert({
        user_id: user.id,
        mfa_enabled: value,
      });

    setMfaEnabled(value);
    showAlert('Success', `Multi-Factor Authentication ${value ? 'enabled' : 'disabled'}`);
  };

  const handleSendVerificationCode = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }

    setChanging(true);

    // Send verification code via Edge Function
    const { data, error } = await supabase.functions.invoke('send-verification-code', {
      body: { email: user?.email, type: 'password_change' },
    });

    setChanging(false);

    if (error) {
      showAlert('Error', 'Failed to send verification code');
      return;
    }

    setCodeSent(true);
    showAlert('Code Sent', 'Please check your email for the verification code');
  };

  const handleChangePassword = async () => {
    if (!verificationCode) {
      showAlert('Error', 'Please enter the verification code');
      return;
    }

    setChanging(true);

    // Verify code and change password
    const { data, error } = await supabase.functions.invoke('change-password', {
      body: {
        email: user?.email,
        oldPassword,
        newPassword,
        verificationCode,
      },
    });

    setChanging(false);

    if (error || data?.error) {
      showAlert('Error', data?.error || 'Failed to change password');
      return;
    }

    // Update password_last_changed
    await supabase
      .from('security_settings')
      .upsert({
        user_id: user?.id,
        password_last_changed: new Date().toISOString(),
      });

    showAlert('Success', 'Password changed successfully');
    setShowPasswordChange(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setCodeSent(false);
  };

  const getDaysSincePasswordChange = () => {
    if (!passwordLastChanged) return 'Never';

    const lastChanged = new Date(passwordLastChanged);
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.select({
        ios: insets.top,
        android: insets.top,
      }),
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
    content: {
      padding: Spacing.md,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    settingLabel: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    settingDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.text,
    },
    infoText: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    warningBox: {
      backgroundColor: '#FFF3CD',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    warningText: {
      ...Typography.caption,
      color: '#856404',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Multi-Factor Authentication</Text>
          <Text style={styles.settingDescription}>
            Add an extra layer of security to your account
          </Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Enable MFA</Text>
            <Switch
              value={mfaEnabled}
              onValueChange={handleToggleMFA}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Password</Text>
          <Text style={styles.infoText}>
            Last changed: {getDaysSincePasswordChange()}
          </Text>
          <Text style={styles.warningText} style={styles.settingDescription}>
            Passwords expire every 3 days for security
          </Text>

          {!showPasswordChange ? (
            <TouchableOpacity
              style={styles.button}
              onPress={() => setShowPasswordChange(true)}
            >
              <Text style={styles.buttonText}>Change Password</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Old Password"
                placeholderTextColor={colors.textSecondary}
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              {!codeSent ? (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSendVerificationCode}
                  disabled={changing}
                >
                  {changing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Send Verification Code</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      A verification code has been sent to {user?.email}
                    </Text>
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Verification Code"
                    placeholderTextColor={colors.textSecondary}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                  />

                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleChangePassword}
                    disabled={changing}
                  >
                    {changing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Confirm Change</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowPasswordChange(false);
                  setCodeSent(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setVerificationCode('');
                }}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
