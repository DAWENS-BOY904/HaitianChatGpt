/**
 * FILE GENERATION PROGRESS COMPONENT
 * Shows realistic "Thinking" state with animated logs during file creation
 * Replaces "Analysis" with "Thinking" and displays real-time generation steps
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

type FileType = 'html' | 'chatbot' | 'typescript' | 'javascript' | 'python' | 'generic';

interface FileGenerationProgressProps {
  fileType?: FileType;
  fileName?: string;
  onComplete?: () => void;
}

// Real-time generation logs based on file type
const GENERATION_STEPS: Record<FileType, string[]> = {
  html: [
    'Thinking...',
    'Preparing HTML file structure...',
    'Creating HTML layout...',
    'Adding CSS styles...',
    'Writing JavaScript logic...',
    'Optimizing code...',
    'Finalizing file...',
  ],
  chatbot: [
    'Thinking...',
    'Preparing file structure...',
    'Creating HTML layout...',
    'Generating chatbot UI...',
    'Writing JavaScript message logic...',
    'Adding bot response system...',
    'Optimizing code...',
    'Finalizing chatbot...',
  ],
  typescript: [
    'Thinking...',
    'Setting up TypeScript environment...',
    'Creating type definitions...',
    'Writing component logic...',
    'Adding type safety...',
    'Optimizing build...',
    'Finalizing TypeScript file...',
  ],
  javascript: [
    'Thinking...',
    'Preparing JavaScript structure...',
    'Writing functions...',
    'Adding event handlers...',
    'Optimizing performance...',
    'Finalizing code...',
  ],
  python: [
    'Thinking...',
    'Setting up Python environment...',
    'Creating classes and functions...',
    'Adding error handling...',
    'Writing documentation...',
    'Optimizing code...',
    'Finalizing Python file...',
  ],
  generic: [
    'Thinking...',
    'Preparing file structure...',
    'Writing code...',
    'Optimizing...',
    'Finalizing file...',
  ],
};

export function FileGenerationProgress({ 
  fileType = 'generic', 
  fileName = 'file',
  onComplete 
}: FileGenerationProgressProps) {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [showLogs, setShowLogs] = useState(true);
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const steps = GENERATION_STEPS[fileType] || GENERATION_STEPS.generic;

  // Animate thinking dot
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Progress through steps
  useEffect(() => {
    if (currentStep >= steps.length) {
      setShowLogs(false);
      onComplete?.();
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentStep(prev => prev + 1);
    }, currentStep === 0 ? 800 : 1200); // First step faster, then slower

    return () => clearTimeout(timeout);
  }, [currentStep, steps.length]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginVertical: Spacing.xs,
      marginHorizontal: Spacing.md,
      maxWidth: '85%',
      alignSelf: 'flex-start',
      marginLeft: Spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    headerText: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    logsContainer: {
      gap: Spacing.xs,
    },
    logItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    logIcon: {
      marginRight: Spacing.sm,
    },
    logText: {
      ...Typography.body,
      color: colors.textSecondary,
      fontSize: 14,
      flex: 1,
    },
    currentLogText: {
      color: colors.primary,
      fontWeight: '600',
    },
    progressBar: {
      height: 2,
      backgroundColor: `${colors.primary}20`,
      borderRadius: 1,
      marginTop: Spacing.sm,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
  });

  if (!showLogs) return null;

  const progress = ((currentStep / steps.length) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="code-slash" size={18} color={colors.primary} />
        </View>
        <Text style={styles.headerText}>Creating {fileName}</Text>
        <Animated.View 
          style={[
            styles.dot,
            {
              opacity: pulseAnim,
              transform: [{ scale: pulseAnim }],
            }
          ]} 
        />
      </View>

      <View style={styles.logsContainer}>
        {steps.slice(0, currentStep + 1).map((step, index) => {
          const isCurrentStep = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <View key={index} style={styles.logItem}>
              <Ionicons 
                name={isCompleted ? "checkmark-circle" : isCurrentStep ? "ellipse" : "ellipse-outline"} 
                size={16} 
                color={isCompleted ? colors.success : isCurrentStep ? colors.primary : colors.border}
                style={styles.logIcon}
              />
              <Text 
                style={[
                  styles.logText,
                  isCurrentStep && styles.currentLogText
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill,
            { width: `${progress}%` }
          ]} 
        />
      </View>
    </View>
  );
}
