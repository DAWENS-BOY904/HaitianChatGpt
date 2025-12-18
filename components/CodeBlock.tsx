import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'code' }: CodeBlockProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showAlert('Copied!', 'Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#1E1E1E',
      borderRadius: BorderRadius.md,
      marginVertical: Spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: '#2D2D2D',
      borderBottomWidth: 1,
      borderBottomColor: '#3D3D3D',
    },
    language: {
      ...Typography.caption,
      color: '#CCCCCC',
      fontSize: 12,
      textTransform: 'capitalize',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: copied ? '#10A37F' : '#3D3D3D',
    },
    copyButtonText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 12,
    },
    codeContainer: {
      padding: Spacing.md,
    },
    code: {
      ...Typography.body,
      fontFamily: 'monospace',
      color: '#D4D4D4',
      fontSize: 13,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{language}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Ionicons 
            name={copied ? 'checkmark' : 'copy-outline'} 
            size={14} 
            color="#FFFFFF" 
          />
          <Text style={styles.copyButtonText}>
            {copied ? 'Copied!' : 'Copy code'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal style={styles.codeContainer}>
        <Text style={styles.code}>{code}</Text>
      </ScrollView>
    </View>
  );
}
