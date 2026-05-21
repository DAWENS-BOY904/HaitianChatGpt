import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { CodeViewModal } from '../components/CodeViewModal';
import { CodePreviewModal } from '../components/CodePreviewModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Glassmorphism theme
const GLASS = {
  bg: 'rgba(18, 18, 18, 0.95)',
  surface: 'rgba(38, 38, 38, 0.85)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  accent: '#0A84FF',
  accentDim: 'rgba(10, 132, 255, 0.12)',
  success: '#30D158',
  error: '#FF453A',
};

interface CodeFile {
  name: string;
  path: string;
  content: string;
  language: string;
  size: number;
}

interface CodeProject {
  id: string;
  name: string;
  description: string;
  files: CodeFile[];
  structure: string;
  createdAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: CodeFile[];
  project?: CodeProject;
  timestamp: string;
}

export default function CodingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<CodeFile[]>([]);
  const [showCodeView, setShowCodeView] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedProject, setSelectedProject] = useState<CodeProject | null>(null);
  const [thinkingPhase, setThinkingPhase] = useState<string>('');

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Suggested prompts for coding
  const suggestedPrompts = [
    {
      id: '1',
      title: 'Full-Stack AI Chatbot',
      prompt: 'Create a complete, production-ready AI chatbot application with real OpenAI integration. Include beautiful React frontend, Node.js backend, package.json, environment setup, and settings.tsx for configurations.',
      icon: 'chatbubbles',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: '2',
      title: 'E-commerce Platform',
      prompt: 'Build a full e-commerce platform with product catalog, shopping cart, checkout, payment integration (Stripe), admin dashboard, and complete backend API.',
      icon: 'cart',
      gradient: ['#f093fb', '#f5576c'],
    },
    {
      id: '3',
      title: '2D Sandbox Game',
      prompt: 'Create a 2D Sandbox Game with Floating Elements in HTML/CSS/JavaScript. Include physics, collision detection, particle effects, and interactive gameplay.',
      icon: 'game-controller',
      gradient: ['#4facfe', '#00f2fe'],
    },
    {
      id: '4',
      title: 'Real-Time Dashboard',
      prompt: 'Build a real-time analytics dashboard with live charts, WebSocket updates, data visualization, and responsive design. Include both frontend and backend.',
      icon: 'analytics',
      gradient: ['#43e97b', '#38f9d7'],
    },
  ];

  // Upload files (including .zip)
  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setThinkingPhase('Reading file...');

        // Check if ZIP file
        if (file.name.endsWith('.zip')) {
          await handleZipFile(file.uri, file.name);
        } else {
          await handleSingleFile(file.uri, file.name, file.mimeType || 'text/plain');
        }
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      showAlert('Error', 'Failed to read file. Please try again.');
      setThinkingPhase('');
    }
  };

  // Handle ZIP file - unzip and extract all contents
  const handleZipFile = async (uri: string, fileName: string) => {
    try {
      setThinkingPhase('Unzipping project...');

      // Read ZIP file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Unzip using JSZip
      const zip = new JSZip();
      const zipData = await zip.loadAsync(base64, { base64: true });

      const extractedFiles: CodeFile[] = [];

      // Extract all files
      for (const [path, zipEntry] of Object.entries(zipData.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('string');
          const language = detectLanguage(path);
          
          extractedFiles.push({
            name: path.split('/').pop() || path,
            path: path,
            content: content,
            language: language,
            size: content.length,
          });
        }
      }

      setUploadedFiles(extractedFiles);
      setThinkingPhase('');

      showAlert(
        'Project Loaded',
        `Successfully extracted ${extractedFiles.length} files from ${fileName}. Ask me to analyze or fix your project!`
      );

    } catch (error: any) {
      console.error('ZIP extraction error:', error);
      showAlert('Error', 'Failed to unzip file. Ensure it is a valid ZIP archive.');
      setThinkingPhase('');
    }
  };

  // Handle single file upload
  const handleSingleFile = async (uri: string, fileName: string, mimeType: string) => {
    try {
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const language = detectLanguage(fileName);

      const codeFile: CodeFile = {
        name: fileName,
        path: fileName,
        content: content,
        language: language,
        size: content.length,
      };

      setUploadedFiles([codeFile]);
      setThinkingPhase('');

      showAlert('File Loaded', `${fileName} loaded successfully. Ask me to analyze or modify it!`);

    } catch (error: any) {
      console.error('File read error:', error);
      showAlert('Error', 'Failed to read file. Ensure it is a text-based file.');
      setThinkingPhase('');
    }
  };

  // Detect programming language from file extension
  const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: { [key: string]: string } = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      kt: 'kotlin',
      swift: 'swift',
      sql: 'sql',
      sh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  // Send message to AI for code generation/analysis
  const handleSend = async () => {
    if ((!inputText.trim() && uploadedFiles.length === 0) || sending) return;

    setSending(true);
    setGenerating(true);

    const text = inputText;
    setInputText('');

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || '[Uploaded files]',
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setUploadedFiles([]);

    try {
      setThinkingPhase('Analyzing request...');

      // Prepare AI context with uploaded files
      let aiContext = text;
      if (uploadedFiles.length > 0) {
        aiContext += '\n\nUPLOADED FILES:\n';
        uploadedFiles.forEach(file => {
          aiContext += `\nFile: ${file.path}\nLanguage: ${file.language}\nContent:\n${file.content}\n`;
        });
      }

      setThinkingPhase('Generating code...');

      // Call AI Edge Function with enhanced coding prompt
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a Senior Full-Stack AI Engineer specialized in building production-ready, scalable, and secure applications.
Your job is to generate complete, real-world projects — not demos, not snippets, not partial files.

You must always deliver fully working codebases that can be cloned, installed, and deployed without missing pieces.

🚨 CRITICAL RULES (NO EXCEPTIONS)

Generate COMPLETE files

Never truncate files

Never use "...", "// TODO", or placeholders

For full projects, generate ALL required files
This includes (but is not limited to):

package.json

tsconfig.json

.env.example

README.md

Backend & frontend source files

Config files

Any required setup files

Respect professional project structure

Always follow clean architecture

Use folders such as /src, /backend, /public, /components, etc. when applicable

Always include setup instructions

Installation steps

Environment variables

How to run locally

How to deploy (if relevant)

Security is mandatory on all backend code
You MUST include:

CORS configuration

Rate limiting

Input validation

Secure environment variable handling

When analyzing uploaded files

Identify ALL bugs and errors

Provide FULL corrected versions of every affected file

Explain what was broken and why
CRITICAL RULES:
1. Generate COMPLETE files for project - never truncate or use "..." placeholders
2. For projects, create ALL necessary files: package.json, tsconfig.json, .env.example, README.md, source files, etc.
3. Use proper project structure: /src, /backend, /public, /components, etc.
4. Include setup instructions and environment variables
5. Add CORS, rate limiting, input validation to all backend code
6. When analyzing uploaded files, identify ALL errors and provide COMPLETE fixed versions

📁 FILE OUTPUT FORMAT (MANDATORY)

When generating multiple files, you must use this format:

📄 filename.ext:[FULL file content here – no truncation]

You must never return incomplete files.

🧠 STRICT STRUCTURE RULES (STACK-DEPENDENT)

You must STRICTLY follow my project structure depending on the technology stack I specify.
You are NOT allowed to invent your own folder structure.

📱 Expo React Native (TypeScript) – STRICT STRUCTURE

When the project is TypeScript with Expo (React Native), the root folder MUST contain exactly:expo/
app/
assets/
components/
constants/
contexts/
hooks/
scripts/
supabase/functions/
template/
.env
.gitignore
README.md
app.json
babel.config.js
eslint.config.js
expo-env.d.ts
package.json
pnpm-lock.yaml
tsconfig.json

Rules:

All routes MUST be inside app/ (Expo Router style)

Reusable UI components MUST be inside components/

Business logic MUST be inside hooks/ or contexts/

Constants MUST be inside constants/

Supabase Edge Functions MUST be inside supabase/functions/

❌ Never mix web structure with Expo structure

❌ Never move routes outside app/

🌐 TypeScript Web – REQUIRED HEADER (MUST BE FIRST IN RESPONSE)

When the project is TypeScript Web, you MUST always start your response with this exact section:

📁 Project Structure:project-name/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   └── utils/
└── backend/
    ├── server.js
    └── api/
supabase/functions/

Rules:

Frontend routes MUST be inside src/pages/

Reusable UI MUST be inside src/components/

Helpers & utilities MUST be inside src/utils/

Backend routes MUST be inside backend/api/

Supabase functions MUST be inside supabase/functions/

You MUST define clear frontend + backend routes so I can auto-place them correctly

🐍 Python Backend – STRICT ARCHITECTURE

When the project is Python, you MUST define routes clearly like this:

📁 Project Structure:project-name/
├── requirements.txt
├── .env.example
├── README.md
├── app/
│   ├── main.py
│   ├── routes/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── utils/

Rules:

All API routes MUST be inside app/routes/

Each route file MUST represent a feature (auth.py, products.py, users.py, etc.)

Business logic MUST be inside services/

Database models MUST be inside models/

Request/response schemas MUST be inside schemas/

Route logic and business logic MUST be separated

☕ Java Backend – STRICT ENTERPRISE STRUCTURE

When the project is Java, the structure MUST be:

📁 Project Structure:project-name/
├── pom.xml (or build.gradle)
├── src/
│   └── main/
│       ├── java/
│       │   └── com/projectname/
│       │       ├── controller/
│       │       ├── service/
│       │       ├── repository/
│       │       └── model/
│       └── resources/
│           ├── application.properties
│           └── static/

Rules:

All API routes MUST be inside controller/

Business logic MUST be inside service/

Database logic MUST be inside repository/

Entities MUST be inside model/

❗ VERY IMPORTANT GLOBAL RULES

✅ Always define routes clearly so I can auto-place them

❌ Never mix project structures

❌ Never rename folders

✅ Always respect the technology stack I specify

✅ Always show the full project structure FIRST before writing any code (for Web, Python, and Java)

✅ Keep architecture clean, scalable, and production-grade

❌ Never output partial files

🎯 FINAL BEHAVIOR RULE

The AI must automatically choose the correct structure based on the technology stack I mention
and STRICTLY follow it without exception.

FILE FORMAT:
When generating multiple files, use this format:

📄 **filename.ext**
\`\`\`language
[full file content]
\`\`\`

IMPORTANT ARCHITECTURE GUIDELINES:
- For Expo React Native: Use app/, components/, hooks/, contexts/, constants/, supabase/functions/
- For TypeScript Web: Use src/pages/, src/components/, backend/api/
- For Python: Use app/routes/, app/services/, app/models/
- For Java: Use controller/, service/, repository/, model/

Always define clear routes and follow best practices for the chosen stack.`,
            },
            {
              role: 'user',
              content: aiContext,
            },
          ],
          aiModel: 'gemini',
          conversationId: Date.now().toString(),
        },
      });

      setThinkingPhase('');

      if (error) {
        throw new Error(error.message || 'AI request failed');
      }

      // Parse AI response for code files
      const generatedFiles = parseCodeFromAIResponse(data.message);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        files: generatedFiles.length > 0 ? generatedFiles : undefined,
        project: generatedFiles.length > 3 ? {
          id: Date.now().toString(),
          name: extractProjectName(data.message) || 'Generated Project',
          description: text.substring(0, 100),
          files: generatedFiles,
          structure: extractProjectStructure(data.message),
          createdAt: new Date().toISOString(),
        } : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('AI error:', error);
      showAlert('Error', error.message || 'Failed to generate code');
      setThinkingPhase('');
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  // Parse code blocks from AI response
  const parseCodeFromAIResponse = (response: string): CodeFile[] => {
    const files: CodeFile[] = [];
    
    // Match code blocks with filename pattern: 📄 **filename** ```language ... ```
    const fileRegex = /📄\s*\*\*(.+?)\*\*\s*```(\w+)\n([\s\S]+?)```/g;
    
    let match;
    while ((match = fileRegex.exec(response)) !== null) {
      const [, filename, language, content] = match;
      files.push({
        name: filename.trim(),
        path: filename.trim(),
        content: content.trim(),
        language: language,
        size: content.length,
      });
    }

    return files;
  };

  // Extract project name from AI response
  const extractProjectName = (response: string): string | null => {
    const match = response.match(/Project\s+Name:?\s*(.+)/i) || 
                  response.match(/📁\s*(.+)/);
    return match ? match[1].trim() : null;
  };

  // Extract project structure
  const extractProjectStructure = (response: string): string => {
    const structureMatch = response.match(/```[\s\S]*?📁.+?[\s\S]+?```/);
    return structureMatch ? structureMatch[0] : '';
  };

  // Download project as ZIP
  const handleDownloadProject = async (project: CodeProject) => {
    try {
      showAlert('Download', 'Project download will be implemented with file system permissions.');
      // TODO: Implement ZIP creation and download
      // Will require expo-file-system and expo-sharing
    } catch (error: any) {
      showAlert('Error', 'Failed to download project');
    }
  };

  // Render suggested prompts
  const renderSuggestedPrompt = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400)}>
      <TouchableOpacity
        style={styles.promptCard}
        onPress={() => setInputText(item.prompt)}
        activeOpacity={0.8}
      >
        <View style={[styles.promptIcon, { backgroundColor: item.gradient[0] }]}>
          <Ionicons name={item.icon} size={24} color="#FFF" />
        </View>
        <View style={styles.promptContent}>
          <Text style={styles.promptTitle}>{item.title}</Text>
          <Text style={styles.promptPreview} numberOfLines={2}>
            {item.prompt}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={GLASS.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );

  // Render message
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageBubble, isUser && styles.messageBubbleUser]}>
        <Text style={styles.messageText}>{item.content}</Text>

        {/* Show uploaded files */}
        {item.files && item.files.length > 0 && (
          <View style={styles.filesContainer}>
            <Text style={styles.filesTitle}>
              📂 {item.files.length} file(s)
            </Text>
            {item.files.slice(0, 3).map((file, index) => (
              <View key={index} style={styles.fileChip}>
                <Ionicons name="document-text" size={14} color={GLASS.accent} />
                <Text style={styles.fileChipText}>{file.name}</Text>
              </View>
            ))}
            {item.files.length > 3 && (
              <Text style={styles.moreFilesText}>
                +{item.files.length - 3} more files
              </Text>
            )}
          </View>
        )}

        {/* Show project actions */}
        {item.project && (
          <View style={styles.projectActions}>
            <TouchableOpacity
              style={styles.projectButton}
              onPress={() => {
                setSelectedProject(item.project!);
                setShowCodeView(true);
              }}
            >
              <Ionicons name="code-slash" size={18} color={GLASS.accent} />
              <Text style={styles.projectButtonText}>View Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.projectButton}
              onPress={() => {
                setSelectedProject(item.project!);
                setShowPreview(true);
              }}
            >
              <Ionicons name="eye" size={18} color={GLASS.success} />
              <Text style={styles.projectButtonText}>Preview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.projectButton}
              onPress={() => handleDownloadProject(item.project!)}
            >
              <Ionicons name="download" size={18} color={GLASS.text} />
              <Text style={styles.projectButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: GLASS.bg,
      paddingTop: Platform.select({ ios: insets.top, android: insets.top, default: 0 }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: GLASS.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      padding: Spacing.xs,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: GLASS.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: GLASS.textSecondary,
      marginTop: 2,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: GLASS.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    uploadText: {
      fontSize: 14,
      fontWeight: '600',
      color: GLASS.text,
    },
    messagesContainer: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      padding: Spacing.xl,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: GLASS.text,
      marginBottom: Spacing.sm,
      letterSpacing: -0.5,
    },
    emptySubtitle: {
      fontSize: 15,
      color: GLASS.textSecondary,
      lineHeight: 22,
      marginBottom: Spacing.xl,
    },
    suggestedPromptsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: GLASS.text,
      marginBottom: Spacing.md,
    },
    promptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: GLASS.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    promptIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    promptContent: {
      flex: 1,
    },
    promptTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: GLASS.text,
      marginBottom: 4,
    },
    promptPreview: {
      fontSize: 13,
      color: GLASS.textSecondary,
      lineHeight: 18,
    },
    messageBubble: {
      backgroundColor: GLASS.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      marginHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    messageBubbleUser: {
      backgroundColor: GLASS.accentDim,
      borderColor: GLASS.accent,
      alignSelf: 'flex-end',
      maxWidth: '80%',
    },
    messageText: {
      fontSize: 15,
      color: GLASS.text,
      lineHeight: 22,
    },
    filesContainer: {
      marginTop: Spacing.md,
      padding: Spacing.sm,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: BorderRadius.md,
    },
    filesTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: GLASS.text,
      marginBottom: Spacing.xs,
    },
    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: GLASS.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      marginTop: 4,
    },
    fileChipText: {
      fontSize: 12,
      color: GLASS.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    moreFilesText: {
      fontSize: 12,
      color: GLASS.textSecondary,
      marginTop: 6,
      fontStyle: 'italic',
    },
    projectActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: GLASS.border,
    },
    projectButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: GLASS.surface,
      paddingVertical: 10,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    projectButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: GLASS.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      paddingBottom: Platform.select({ 
        ios: insets.bottom + Spacing.md, 
        android: insets.bottom + Spacing.md, 
        default: Spacing.md 
      }),
      borderTopWidth: 1,
      borderTopColor: GLASS.border,
      backgroundColor: GLASS.bg,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: GLASS.surface,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: GLASS.text,
      paddingVertical: Spacing.sm,
      maxHeight: 100,
    },
    sendButton: {
      backgroundColor: GLASS.accent,
      borderRadius: BorderRadius.full,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: Spacing.sm,
    },
    thinkingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: Spacing.md,
      marginHorizontal: Spacing.md,
      backgroundColor: GLASS.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: GLASS.border,
    },
    thinkingText: {
      fontSize: 14,
      color: GLASS.text,
      fontWeight: '500',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={GLASS.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Code Assistant</Text>
            <Text style={styles.headerSubtitle}>AI-Powered Development</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.uploadButton} onPress={handleUploadFile}>
          <Ionicons name="cloud-upload-outline" size={20} color={GLASS.text} />
          <Text style={styles.uploadText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Messages or Empty State */}
      {messages.length === 0 ? (
        <ScrollView style={styles.emptyState} showsVerticalScrollIndicator={false}>
          <Text style={styles.emptyTitle}>Build anything with AI 🚀</Text>
          <Text style={styles.emptySubtitle}>
            Generate complete projects, analyze code, fix bugs, or upload entire ZIP files for AI analysis and refactoring.
          </Text>

          <Text style={styles.suggestedPromptsTitle}>Try these prompts:</Text>
          <FlatList
            data={suggestedPrompts}
            renderItem={renderSuggestedPrompt}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingVertical: Spacing.md }}
          ListFooterComponent={
            thinkingPhase ? (
              <View style={styles.thinkingIndicator}>
                <ActivityIndicator size="small" color={GLASS.accent} />
                <Text style={styles.thinkingText}>{thinkingPhase}</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Describe your project or upload files..."
            placeholderTextColor={GLASS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!sending}
          />
        </View>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending || (!inputText.trim() && uploadedFiles.length === 0)}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      {selectedProject && (
        <>
          <CodeViewModal
            visible={showCodeView}
            onClose={() => setShowCodeView(false)}
            project={selectedProject}
          />
          <CodePreviewModal
            visible={showPreview}
            onClose={() => setShowPreview(false)}
            project={selectedProject}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}
