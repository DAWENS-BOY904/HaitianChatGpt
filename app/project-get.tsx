/**
 * PRODUCTION AI CODING SYSTEM
 * Professional project generation with real code, streaming, and voice support
 * Designed to match Kimi AI interface standards
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { StreamingText } from '../components/StreamingText';
import { CodeBlock } from '../components/CodeBlock';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==================== TYPES ====================

type AIMode = 'instant' | 'deep_thinking' | 'agent';
type AgentCapability = 'research' | 'slides' | 'website' | 'docs' | 'sheets';
type ProjectLanguage = 'html' | 'typescript' | 'javascript' | 'python' | 'php' | 'java' | 'node';
type GenerationMode = 'demo' | 'real';

interface ProjectFile {
  path: string;
  content: string;
  language: string;
  isEdited?: boolean;
}

interface ProjectGeneration {
  id: string;
  title: string;
  description: string;
  language: ProjectLanguage;
  mode: GenerationMode;
  files: ProjectFile[];
  environmentVars: Record<string, string>;
  instructions: string[];
  createdAt: string;
  status: 'generating' | 'completed' | 'error';
  logs: string[];
  previewable: boolean;
  requiresPro: boolean;
}

interface Tool {
  id: string;
  icon: string;
  label: string;
  description: string;
  action: () => void;
  badge?: string;
}

// ==================== MAIN COMPONENT ====================

export default function ProjectGetScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();
  
  // Core State
  const [inputValue, setInputValue] = useState('');
  const [currentMode, setCurrentMode] = useState<AIMode>('instant');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('real');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectGeneration | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentLog, setCurrentLog] = useState('');
  
  // Modal States
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showModeToggle, setShowModeToggle] = useState(false);
  
  // Image Upload State
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [dailyImageCount, setDailyImageCount] = useState(0);
  const IMAGE_LIMIT = 10;
  
  // Voice State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastAIMessage, setLastAIMessage] = useState('');
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // ==================== USER DATA ====================
  
  const [userCoins, setUserCoins] = useState(0);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    loadUserData();
    loadDailyImageCount();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_tier, daily_coins_used, monthly_coins_used')
        .eq('id', user.id)
        .single();

      if (data) {
        const isProUser = data.subscription_tier === 'pro' || data.subscription_tier === 'premium';
        setIsPro(isProUser);
        setUserCoins(isProUser ? (9000 - (data.monthly_coins_used || 0)) : (1000 - (data.daily_coins_used || 0)));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDailyImageCount = async () => {
    if (!user) return;

    try {
      // Load from local storage or database
      const today = new Date().toDateString();
      const storedData = localStorage.getItem('daily_image_upload');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed.date === today) {
          setDailyImageCount(parsed.count || 0);
        } else {
          setDailyImageCount(0);
        }
      }
    } catch (error) {
      console.error('Error loading image count:', error);
    }
  };

  // ==================== TOOLS CONFIGURATION ====================

  const tools: Tool[] = useMemo(() => [
    {
      id: 'upload_image',
      icon: 'image',
      label: 'Upload Image',
      description: 'Analyze and use images in your project',
      badge: `${dailyImageCount}/${IMAGE_LIMIT}`,
      action: handleImageUpload,
    },
    {
      id: 'fetch_link',
      icon: 'link',
      label: 'Fetch Link',
      description: 'Analyze content from any URL',
      action: handleFetchLink,
    },
    {
      id: 'agent_research',
      icon: 'search',
      label: 'Research',
      description: 'Deep research on any topic',
      action: () => switchToAgent('research'),
    },
    {
      id: 'agent_slides',
      icon: 'easel',
      label: 'Create Slides',
      description: 'Generate presentation slides',
      action: () => switchToAgent('slides'),
    },
    {
      id: 'agent_website',
      icon: 'globe',
      label: 'Build Website',
      description: 'Create a full website',
      action: () => switchToAgent('website'),
    },
    {
      id: 'agent_docs',
      icon: 'document-text',
      label: 'Write Docs',
      description: 'Generate documentation',
      action: () => switchToAgent('docs'),
    },
    {
      id: 'agent_sheets',
      icon: 'grid',
      label: 'Create Sheets',
      description: 'Build spreadsheets',
      action: () => switchToAgent('sheets'),
    },
  ], [dailyImageCount]);

  // ==================== HANDLERS ====================

  async function handleImageUpload() {
    if (dailyImageCount >= IMAGE_LIMIT) {
      Alert.alert('Limit Reached', `You can only upload ${IMAGE_LIMIT} images per day. Try again tomorrow.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const base64 = result.assets[0].base64;
        if (base64) {
          setUploadedImages(prev => [...prev, base64]);
          setDailyImageCount(prev => prev + 1);
          
          // Save count
          const today = new Date().toDateString();
          localStorage.setItem('daily_image_upload', JSON.stringify({ date: today, count: dailyImageCount + 1 }));
          
          setShowToolsModal(false);
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    }
  }

  async function handleFetchLink() {
    Alert.prompt(
      'Fetch Link',
      'Enter the URL to analyze:',
      async (url: string) => {
        if (!url.trim()) return;
        
        setShowToolsModal(false);
        setCurrentLog('🔄 Fetching link content...');
        
        try {
          const { data, error } = await supabase.functions.invoke('fetch-url', {
            body: { url },
          });

          if (error) throw error;

          // Add fetched content to input
          setInputValue(prev => `${prev}\n\nAnalyze this content from ${url}:\n${data.content}`);
          setCurrentLog('');
        } catch (error) {
          console.error('Fetch link error:', error);
          Alert.alert('Error', 'Failed to fetch link content');
          setCurrentLog('');
        }
      }
    );
  }

  function switchToAgent(capability: AgentCapability) {
    setCurrentMode('agent');
    setShowToolsModal(false);
    setInputValue(`Create a ${capability} about: `);
  }

  function handleModeChange(mode: AIMode) {
    setCurrentMode(mode);
    setShowModeSelector(false);
  }

  function toggleGenerationMode() {
    setGenerationMode(prev => prev === 'demo' ? 'real' : 'demo');
    setShowModeToggle(false);
  }

  async function handleVoiceRead() {
    if (!lastAIMessage) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    Speech.speak(lastAIMessage, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  // ==================== PROJECT GENERATION ====================

  async function generateProject() {
    if (!inputValue.trim()) {
      Alert.alert('Error', 'Please describe your project');
      return;
    }

    const projectId = `proj_${Date.now()}`;
    const newProject: ProjectGeneration = {
      id: projectId,
      title: inputValue.slice(0, 50),
      description: inputValue,
      language: detectLanguage(inputValue),
      mode: generationMode,
      files: [],
      environmentVars: {},
      instructions: [],
      createdAt: new Date().toISOString(),
      status: 'generating',
      logs: [],
      previewable: false,
      requiresPro: false,
    };

    setCurrentProject(newProject);
    setIsGenerating(true);
    setStreamingContent('');
    setLastAIMessage('');

    // Estimate coins
    const coinsNeeded = estimateProjectCost(inputValue);
    if (userCoins < coinsNeeded) {
      Alert.alert('Insufficient Coins', `This project needs ${coinsNeeded} coins.`);
      setIsGenerating(false);
      return;
    }

    try {
      // Create abort controller for streaming
      streamControllerRef.current = new AbortController();

      // Stream the generation
      await streamProjectGeneration(newProject, streamControllerRef.current.signal);

      // Deduct coins
      await deductCoins(coinsNeeded);

      setIsGenerating(false);
    } catch (error: any) {
      console.error('Generation error:', error);
      if (error.name !== 'AbortError') {
        Alert.alert('Error', error.message || 'Failed to generate project');
      }
      setIsGenerating(false);
    }
  }

  async function streamProjectGeneration(project: ProjectGeneration, signal: AbortSignal) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-code-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          description: project.description,
          language: project.language,
          mode: project.mode,
          aiMode: currentMode,
          images: uploadedImages,
          userId: user?.id,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            
            switch (event.type) {
              case 'log':
                setCurrentLog(event.data);
                setCurrentProject(prev => prev ? {
                  ...prev,
                  logs: [...prev.logs, event.data],
                } : null);
                break;

              case 'content':
                setStreamingContent(prev => prev + event.data);
                break;

              case 'file_created':
                setCurrentProject(prev => prev ? {
                  ...prev,
                  files: [...prev.files, event.data],
                } : null);
                break;

              case 'env_var':
                setCurrentProject(prev => prev ? {
                  ...prev,
                  environmentVars: { ...prev.environmentVars, [event.data.key]: event.data.value },
                } : null);
                break;

              case 'instruction':
                setCurrentProject(prev => prev ? {
                  ...prev,
                  instructions: [...prev.instructions, event.data],
                } : null);
                break;

              case 'completed':
                setCurrentProject(prev => prev ? {
                  ...prev,
                  status: 'completed',
                  previewable: event.data.previewable,
                  requiresPro: event.data.requiresPro,
                } : null);
                setLastAIMessage(streamingContent);
                break;

              case 'error':
                throw new Error(event.data);
            }
          } catch (parseError) {
            console.error('Parse error:', parseError);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation cancelled');
      } else {
        throw error;
      }
    }
  }

  function stopGeneration() {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    setIsGenerating(false);
    setCurrentLog('');
  }

  async function deductCoins(amount: number) {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('daily_coins_used, monthly_coins_used')
        .eq('id', user.id)
        .single();

      if (data) {
        await supabase
          .from('user_profiles')
          .update({
            daily_coins_used: (data.daily_coins_used || 0) + amount,
            monthly_coins_used: (data.monthly_coins_used || 0) + amount,
          })
          .eq('id', user.id);

        setUserCoins(prev => prev - amount);
      }
    } catch (error) {
      console.error('Deduct coins error:', error);
    }
  }

  // ==================== PREVIEW ====================

  async function handlePreview() {
    if (!currentProject || !currentProject.previewable) return;

    if (currentProject.requiresPro && !isPro) {
      Alert.alert('Pro Required', 'TypeScript preview requires Pro Plan. Upgrade to preview this project.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/subscription') },
      ]);
      return;
    }

    router.push({
      pathname: '/preview',
      params: {
        projectId: currentProject.id,
        files: JSON.stringify(currentProject.files),
        language: currentProject.language,
      },
    });
  }

  function handleCopyProject() {
    if (!currentProject) return;

    const allCode = currentProject.files
      .map(file => `// ${file.path}\n${file.content}`)
      .join('\n\n');

    // Copy to clipboard (web platform)
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(allCode);
      Alert.alert('Copied', 'All project code copied to clipboard');
    }
  }

  // ==================== UTILITIES ====================

  function detectLanguage(description: string): ProjectLanguage {
    const lower = description.toLowerCase();
    if (lower.includes('typescript') || lower.includes('tsx') || lower.includes('react native')) return 'typescript';
    if (lower.includes('python') || lower.includes('django') || lower.includes('flask')) return 'python';
    if (lower.includes('php') || lower.includes('laravel')) return 'php';
    if (lower.includes('java') || lower.includes('spring')) return 'java';
    if (lower.includes('node') || lower.includes('express')) return 'node';
    if (lower.includes('html') || lower.includes('css') || lower.includes('webpage')) return 'html';
    return 'javascript';
  }

  function estimateProjectCost(description: string): number {
    const words = description.split(' ').length;
    const hasComplex = description.toLowerCase().match(/api|database|backend|server|full|complete|system/);
    
    if (words > 100 || hasComplex) return 30;
    if (words > 50) return 15;
    return 5;
  }

  // ==================== STYLES ====================

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: insets.top + Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    modeSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    modeText: {
      ...Typography.body,
      fontWeight: '600',
      fontSize: 16,
    },
    headerRight: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    conversationArea: {
      flex: 1,
      padding: Spacing.md,
    },
    projectCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    projectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    projectTitle: {
      ...Typography.heading,
      fontSize: 18,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primary,
    },
    statusText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    logText: {
      ...Typography.caption,
      color: colors.primary,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    streamingContainer: {
      marginTop: Spacing.md,
    },
    filesSection: {
      marginTop: Spacing.md,
    },
    sectionTitle: {
      ...Typography.body,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    fileName: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    projectActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    actionButtonTextSecondary: {
      color: colors.text,
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Math.max(insets.bottom, Spacing.md),
      backgroundColor: colors.background,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      ...Typography.body,
      color: colors.text,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    plusButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingTop: Spacing.md,
      paddingBottom: Math.max(insets.bottom, Spacing.md),
      maxHeight: '80%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    modalTitle: {
      ...Typography.heading,
      fontSize: 20,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    toolsList: {
      paddingHorizontal: Spacing.md,
    },
    toolItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    toolIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    toolInfo: {
      flex: 1,
    },
    toolLabel: {
      ...Typography.body,
      fontWeight: '600',
    },
    toolDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    toolBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.sm,
    },
    toolBadgeText: {
      ...Typography.caption,
      color: '#FFFFFF',
      fontSize: 10,
    },
    modeOption: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modeOptionTitle: {
      ...Typography.body,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    modeOptionDescription: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
  });

  // ==================== RENDER ====================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/home')}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <TouchableOpacity style={styles.modeSelectorButton} onPress={() => setShowModeSelector(true)}>
            <Text style={styles.modeText}>
              {currentMode === 'instant' && 'K2.5 Instant'}
              {currentMode === 'deep_thinking' && 'K2.5 Deep'}
              {currentMode === 'agent' && 'K2.5 Agent'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={handleVoiceRead}>
            <Ionicons name={isSpeaking ? 'volume-high' : 'volume-mute-outline'} size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Ionicons name="person-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.conversationArea}>
        {currentProject && (
          <View style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Text style={styles.projectTitle}>{currentProject.title}</Text>
              {isGenerating && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Generating...</Text>
                </View>
              )}
            </View>

            {currentLog && (
              <Text style={styles.logText}>{currentLog}</Text>
            )}

            {streamingContent && (
              <View style={styles.streamingContainer}>
                <StreamingText content={streamingContent} speed={isPro ? 50 : 30} />
              </View>
            )}

            {currentProject.files.length > 0 && (
              <View style={styles.filesSection}>
                <Text style={styles.sectionTitle}>Files ({currentProject.files.length})</Text>
                {currentProject.files.map((file, idx) => (
                  <View key={idx} style={styles.fileItem}>
                    <Ionicons name="document-text" size={16} color={colors.primary} />
                    <Text style={styles.fileName}>{file.path}</Text>
                  </View>
                ))}
              </View>
            )}

            {currentProject.status === 'completed' && (
              <View style={styles.projectActions}>
                {currentProject.previewable && (
                  <TouchableOpacity style={styles.actionButton} onPress={handlePreview}>
                    <Ionicons name="eye" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Preview</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionButtonSecondary]} 
                  onPress={handleCopyProject}
                >
                  <Ionicons name="copy" size={20} color={colors.text} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionButtonSecondary]} 
                  onPress={() => setShowFileExplorer(true)}
                >
                  <Ionicons name="folder-open" size={20} color={colors.text} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Files</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.plusButton} onPress={() => setShowToolsModal(true)}>
            <Ionicons name="add" size={28} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Ask away. Pics work too."
            placeholderTextColor={colors.textSecondary}
            value={inputValue}
            onChangeText={setInputValue}
            multiline
            editable={!isGenerating}
          />

          {isGenerating ? (
            <TouchableOpacity style={styles.sendButton} onPress={stopGeneration}>
              <Ionicons name="stop" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={generateProject}
              disabled={!inputValue.trim()}
            >
              <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tools Modal */}
      <Modal visible={showToolsModal} transparent animationType="slide" onRequestClose={() => setShowToolsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowToolsModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tools</Text>
            
            <ScrollView style={styles.toolsList}>
              {tools.map(tool => (
                <TouchableOpacity key={tool.id} style={styles.toolItem} onPress={tool.action}>
                  <View style={styles.toolIcon}>
                    <Ionicons name={tool.icon as any} size={24} color={colors.primary} />
                  </View>
                  <View style={styles.toolInfo}>
                    <Text style={styles.toolLabel}>{tool.label}</Text>
                    <Text style={styles.toolDescription}>{tool.description}</Text>
                  </View>
                  {tool.badge && (
                    <View style={styles.toolBadge}>
                      <Text style={styles.toolBadgeText}>{tool.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Mode Selector Modal */}
      <Modal visible={showModeSelector} transparent animationType="fade" onRequestClose={() => setShowModeSelector(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModeSelector(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>AI Mode</Text>

            <TouchableOpacity style={styles.modeOption} onPress={() => handleModeChange('instant')}>
              <Text style={styles.modeOptionTitle}>Instant Mode</Text>
              <Text style={styles.modeOptionDescription}>Fast answers for quick questions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeOption} onPress={() => handleModeChange('deep_thinking')}>
              <Text style={styles.modeOptionTitle}>Deep Thinking Mode</Text>
              <Text style={styles.modeOptionDescription}>Complex reasoning and analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeOption} onPress={() => handleModeChange('agent')}>
              <Text style={styles.modeOptionTitle}>Agent Mode</Text>
              <Text style={styles.modeOptionDescription}>Research, slides, websites, docs, sheets</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

