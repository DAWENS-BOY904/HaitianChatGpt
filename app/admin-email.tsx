import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

interface User {
  id: string;
  email: string;
  username: string;
}

export default function AdminEmailScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
    loadUsers();
  }, []);

  const checkAdminAccess = () => {
    const adminEmails = ['berryxoe@gmail.com', 'newdawens@gmail.com'];
    if (!adminEmails.includes(user?.email || '')) {
      showAlert('Access Denied', 'You do not have permission to access this page');
      router.back();
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, username')
      .order('email');

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      try {
        const fileName = `admin-email-${Date.now()}.jpg`;
        const filePath = `admin/${fileName}`;
        
        const { data, error } = await supabase.storage
          .from('chat-images')
          .upload(filePath, decode(asset.base64!), {
            contentType: 'image/jpeg',
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath);

        setImageUrl(urlData.publicUrl);
        showAlert('Success', 'Image uploaded');
      } catch (error) {
        console.error('Upload error:', error);
        showAlert('Error', 'Failed to upload image');
      }
    }
  };

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) {
      showAlert('Error', 'Please select at least one recipient');
      return;
    }

    if (!subject || !message) {
      showAlert('Error', 'Please enter subject and message');
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          recipientIds: selectedUsers,
          subject,
          message,
          imageUrl,
        },
      });

      if (error) throw error;

      // Log email in database
      await supabase.from('admin_emails').insert({
        admin_id: user?.id,
        recipient_ids: selectedUsers,
        subject,
        message,
        image_url: imageUrl,
      });

      showAlert('Success', `Email sent to ${selectedUsers.length} users`);
      
      // Reset form
      setSelectedUsers([]);
      setSubject('');
      setMessage('');
      setImageUrl('');
    } catch (error) {
      console.error('Send error:', error);
      showAlert('Error', 'Failed to send emails');
    } finally {
      setSending(false);
    }
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
      flex: 1,
    },
    section: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.text,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    selectAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.sm,
    },
    selectAllText: {
      ...Typography.body,
      color: colors.primary,
      marginLeft: Spacing.sm,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: BorderRadius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      ...Typography.body,
      color: colors.text,
    },
    userEmail: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontSize: 12,
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
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    imageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    imageButtonText: {
      ...Typography.body,
      color: colors.text,
      marginLeft: Spacing.sm,
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surface,
      marginBottom: Spacing.md,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
    },
    sendButtonText: {
      ...Typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    selectedCount: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Email to Users</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Recipients</Text>
          
          <TouchableOpacity style={styles.selectAllButton} onPress={handleSelectAll}>
            <Ionicons
              name={selectedUsers.length === users.length ? 'checkbox' : 'square-outline'}
              size={24}
              color={colors.primary}
            />
            <Text style={styles.selectAllText}>
              {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.selectedCount}>
            {selectedUsers.length} of {users.length} users selected
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            users.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userItem}
                onPress={() => handleToggleUser(user.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    selectedUsers.includes(user.id) && styles.checkboxChecked,
                  ]}
                >
                  {selectedUsers.includes(user.id) && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.username || 'User'}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Content</Text>

          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor={colors.textSecondary}
            value={subject}
            onChangeText={setSubject}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Message"
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <TouchableOpacity style={styles.imageButton} onPress={handleImagePicker}>
            <Ionicons name="image-outline" size={24} color={colors.text} />
            <Text style={styles.imageButtonText}>
              {imageUrl ? 'Change Image' : 'Add Image'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendEmail}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send Email</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
