import React, { createContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform, Alert } from 'react-native';
// Note: base64 images are sent as strings to the backend for server-side processing

// ==================== INTERFACES ====================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  created_at: string;
  edited?: boolean;
  edited_at?: string;
  audio_url?: string;
  duration?: number;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  error?: string;
  isViolation?: boolean;
}

interface AudioRecordingState {
  isRecording: boolean;
  duration: number;
  audioBase64: string | null;
  waveformData: number[];
}

interface AccountStatus {
  isSuspended: boolean;
  reason: string | null;
  suspendedAt: string | null;
  expiresAt: string | null;
  violationCount: number;
}

interface ConversationContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  streamingMessageId: string | null;
  accountStatus: AccountStatus;
  temporaryMode?: boolean;
  setTemporaryMode?: (val: boolean) => void;
  cancelSendMessage: () => void;
  checkAccountStatus: () => Promise<void>;
  createConversation: () => Promise<string | null>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, fileContents?: Array<{name: string; type: string; content: string}> | string, base64Image?: string, isImageGeneration?: boolean, aiModel?: string) => Promise<void>;
  sendAudioMessage: (audioBase64: string, duration: number, transcription?: string) => Promise<void>;
  updateMessage: (messageId: string, newContent: string) => Promise<void>;
  updateMessageAndRegenerate: (messageId: string, newContent: string, aiModel?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  searchConversations: (query: string) => Conversation[];
  refreshConversations: () => Promise<void>;
  clearCurrentConversation: () => void;
  transcribeAudio: (audioBase64: string, options?: { language?: string; detectLanguage?: boolean }) => Promise<TranscriptionResult>;
  checkContentViolation: (text: string) => Promise<{ isViolation: boolean; reason?: string; severity?: 'low' | 'medium' | 'high' }>;
  audioRecording: AudioRecordingState;
  startAudioRecording: () => Promise<void>;
  stopAudioRecording: () => Promise<{ base64: string; duration: number } | null>;
  cancelAudioRecording: () => void;
  exportConversation: (id: string, format: 'json' | 'txt' | 'md') => Promise<string>;
  duplicateConversation: (id: string) => Promise<string | null>;
  archiveConversation: (id: string) => Promise<void>;
  archiveAllConversations: () => Promise<void>;
  deleteAllConversations: () => Promise<void>;
}

export const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// ==================== SMART CONVERSATION TITLE GENERATOR ====================

const SELF_HARM_KEYWORDS = [
  'kill myself', 'kill my self', 'suicide', 'suicidal', 'end my life', 'end it all',
  'i want to die', 'i wanna die', 'hurt myself', 'self harm', 'self-harm',
  'mwen vle mouri', 'touye tet mwen', 'pa vle viv', 'mouri', 'touye tèt mwen',
  'i want to kill', 'no reason to live', 'not worth living',
  'pa anfom', 'feeling hopeless', 'hopeless',
];

function generateSmartConversationTitle(firstMessage: string, hasImage: boolean): string {
  if (!firstMessage) return 'New Chat';
  const lower = firstMessage.toLowerCase();

  // Safety: detect self-harm before anything else
  if (SELF_HARM_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'Safety Support';
  }

  // Image tasks
  if (hasImage || ['create a logo', 'generate logo', 'make a logo', 'design a logo', 'create image', 'generate image', 'make an image', 'create an image'].some(kw => lower.includes(kw))) {
    if (lower.includes('logo')) return 'Logo Design';
    if (lower.includes('banner')) return 'Banner Design';
    if (lower.includes('image') || lower.includes('photo') || lower.includes('picture')) return 'Image Creation';
    return 'Image Generation';
  }

  // Greeting
  if (/^(hi|hello|hey|bonjou|alo|salut|hola|konnichiwa|bonsoir|good morning|good evening|good night)\b/.test(lower.trim())) {
    return 'Greeting';
  }

  // Code / programming
  if (lower.includes('code') || lower.includes('bug') || lower.includes('function') || lower.includes('script') || lower.includes('program') || lower.includes('error') || lower.includes('debug')) {
    const langMatch = firstMessage.match(/(javascript|typescript|python|java|swift|kotlin|html|css|react|node)/i);
    return langMatch ? `${langMatch[1]} Help` : 'Coding Help';
  }

  // Translation
  if (lower.includes('translate') || lower.includes('traduction') || lower.includes('traduire') || lower.includes('tradiksyon')) {
    return 'Translation';
  }

  // Quiz
  if (lower.includes('quiz') || lower.includes('test my knowledge') || lower.includes('trivia')) {
    return 'Quiz';
  }

  // Math
  if (/\d+\s*[+\-*/^]\s*\d+/.test(firstMessage) || lower.includes('calculate') || lower.includes('math') || lower.includes('solve')) {
    return 'Math Problem';
  }

  // Writing/message
  if (lower.includes('write') || lower.includes('compose') || lower.includes('draft') || lower.includes('letter') || lower.includes('message') || lower.includes('email')) {
    return 'Writing Help';
  }

  // Research/explain
  if (lower.includes('research') || lower.includes('explain') || lower.includes('what is') || lower.includes('how does') || lower.includes('why does') || lower.includes('tell me about')) {
    const topicMatch = firstMessage.match(/(?:what is|how does|explain|about|research)\s+(.{3,30})/i);
    if (topicMatch) return topicMatch[1].trim().split(' ').slice(0, 4).join(' ');
    return 'Research';
  }

  // Recipe/food
  if (lower.includes('recipe') || lower.includes('cook') || lower.includes('food') || lower.includes('eat') || lower.includes('manje')) {
    return 'Recipe';
  }

  // Default: use cleaned first ~40 chars
  const cleaned = firstMessage.replace(/[\r\n]+/g, ' ').trim();
  return cleaned.length <= 40 ? cleaned : cleaned.slice(0, 37) + '...';
}

// ==================== WEB-ONLY TYPES (guarded by Platform.OS) ====================

type MediaRecorderType = any;
type BlobType = any;

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const mediaRecorderRef = useRef<MediaRecorderType | null>(null);
  const audioChunksRef = useRef<any[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // AbortController ref for cancelling in-flight chat requests
  const abortControllerRef = useRef<any | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [accountStatus, setAccountStatus] = useState<AccountStatus>({
    isSuspended: false,
    reason: null,
    suspendedAt: null,
    expiresAt: null,
    violationCount: 0,
  });

  const [audioRecording, setAudioRecording] = useState<AudioRecordingState>({
    isRecording: false,
    duration: 0,
    audioBase64: null,
    waveformData: [],
  });

  const [temporaryMode, setTemporaryMode] = useState(false);

  // ── Cancel any in-flight request ──
  const cancelSendMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingMessageId(null);
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
      checkAccountStatus();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const checkAccountStatus = async (): Promise<void> => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_suspended, suspension_reason, suspended_at, suspension_expires_at, violation_count')
        .eq('id', user.id)
        .single();

      if (error) { console.error('Error checking account status:', error); return; }

      if (data) {
        setAccountStatus({
          isSuspended: data.is_suspended || false,
          reason: data.suspension_reason || null,
          suspendedAt: data.suspended_at || null,
          expiresAt: data.suspension_expires_at || null,
          violationCount: data.violation_count || 0,
        });
      }
    } catch (err) {
      console.error('Failed to check account status:', err);
    }
  };

  const handleContentViolation = async (violationType: string, severity: 'low' | 'medium' | 'high', details?: string): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('content_violations').insert([{
        user_id: user.id, violation_type: violationType, severity, details: details || null, created_at: new Date().toISOString(),
      }]);
      const newViolationCount = accountStatus.violationCount + 1;
      let shouldSuspend = false;
      let suspensionReason = '';
      let suspensionDuration: number | null = null;
      if (severity === 'high' || newViolationCount >= 5) {
        shouldSuspend = true; suspensionReason = 'Multiple content policy violations.'; suspensionDuration = 7 * 24 * 60 * 60;
      } else if (severity === 'medium' && newViolationCount >= 3) {
        shouldSuspend = true; suspensionReason = 'Repeated content violations.'; suspensionDuration = 24 * 60 * 60;
      }
      if (shouldSuspend) {
        const suspendedAt = new Date().toISOString();
        const expiresAt = suspensionDuration ? new Date(Date.now() + suspensionDuration * 1000).toISOString() : null;
        await supabase.from('user_profiles').update({ is_suspended: true, suspension_reason: suspensionReason, suspended_at: suspendedAt, suspension_expires_at: expiresAt, violation_count: newViolationCount }).eq('id', user.id);
        setAccountStatus({ isSuspended: true, reason: suspensionReason, suspendedAt, expiresAt, violationCount: newViolationCount });
      } else {
        await supabase.from('user_profiles').update({ violation_count: newViolationCount }).eq('id', user.id);
        setAccountStatus(prev => ({ ...prev, violationCount: newViolationCount }));
      }
    } catch (err) {
      console.error('Failed to handle content violation:', err);
    }
  };

  const transcribeAudio = async (audioBase64: string, options?: { language?: string; detectLanguage?: boolean }): Promise<TranscriptionResult> => {
    if (!user) return { text: '', error: 'User not authenticated' };
    if (accountStatus.isSuspended) return { text: '', error: 'ACCOUNT_SUSPENDED', isViolation: false };
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: audioBase64, language: options?.language, detectLanguage: options?.detectLanguage ?? true, userId: user.id },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          if (statusCode === 403 || textContent?.toLowerCase().includes('violation')) {
            await handleContentViolation('AUDIO_CONTENT_VIOLATION', 'high', textContent || undefined);
            return { text: '', error: 'CONTENT_VIOLATION', isViolation: true };
          }
          return { text: '', error: textContent || error.message || 'Transcription failed', isViolation: false };
        }
        return { text: '', error: error.message || 'Unknown error', isViolation: false };
      }
      return { text: data.text || '', confidence: data.confidence, language: data.language, error: undefined, isViolation: false };
    } catch (err: any) {
      return { text: '', error: err.message || 'Unexpected error occurred', isViolation: false };
    }
  };

  const checkContentViolation = async (text: string): Promise<{ isViolation: boolean; reason?: string; severity?: 'low' | 'medium' | 'high' }> => {
    // Lightweight local check — skip calling backend for every message
    return { isViolation: false };
  };

  const startAudioRecording = async (): Promise<void> => {
    if (Platform.OS !== 'web') return;
    // @ts-ignore — navigator is web-only, guarded by Platform.OS
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Alert.alert('Audio recording is not supported.');
      return;
    }
    try {
      // @ts-ignore — web-only API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // @ts-ignore — web-only API
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event: any) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.start(100);
      let duration = 0;
      recordingTimerRef.current = setInterval(() => { duration += 1; setAudioRecording(prev => ({ ...prev, duration })); }, 1000);
      waveformIntervalRef.current = setInterval(() => {
        const simulatedWaveform = Array.from({ length: 20 }, () => Math.random() * 100);
        setAudioRecording(prev => ({ ...prev, waveformData: simulatedWaveform }));
      }, 100);
      setAudioRecording({ isRecording: true, duration: 0, audioBase64: null, waveformData: [] });
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopAudioRecording = async (): Promise<{ base64: string; duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') { resolve(null); return; }
      mediaRecorderRef.current.onstop = async () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
        // @ts-ignore — Blob is web-only, guarded by Platform.OS
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // @ts-ignore — FileReader is web-only
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          const result = { base64: base64Data, duration: audioRecording.duration };
          setAudioRecording({ isRecording: false, duration: audioRecording.duration, audioBase64: base64Data, waveformData: [] });
          mediaRecorderRef.current?.stream.getTracks().forEach((track: any) => track.stop());
          resolve(result);
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorderRef.current.stop();
    });
  };

  const cancelAudioRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track: any) => track.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    setAudioRecording({ isRecording: false, duration: 0, audioBase64: null, waveformData: [] });
  };

  const loadConversations = async () => {
    if (!user) return;
    try {
      // Load all non-archived conversations that have at least one message
      // Use a join-style query for efficiency
      const { data: allConvs, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at, is_archived')
        .eq('user_id', user.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('updated_at', { ascending: false })
        .limit(120);

      if (error || !allConvs) return;

      if (allConvs.length === 0) { setConversations([]); return; }

      // Check which conversation IDs have at least one message
      const convIds = allConvs.map((c: any) => c.id);
      const { data: msgRows } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds);

      const idsWithMessages = new Set((msgRows || []).map((m: any) => m.conversation_id));
      // Also show conversations created within last 30 minutes (new chats before first message)
      const thirtyMinAgo = Date.now() - 30 * 60 * 1000;

      const mapped = allConvs
        .filter((c: any) => idsWithMessages.has(c.id))
        .map((c: any) => ({
          id: c.id,
          title: c.title || 'New Chat',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));

      setConversations(mapped);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const createConversation = async (): Promise<string | null> => {
    // Helper: silently create a local transient conversation so chat works even if DB is unreachable
    const fallbackLocal = (): string => {
      const localId = `guest-${Date.now()}`;
      const localConv: Conversation = {
        id: localId,
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentConversation(localConv);
      setMessages([]);
      // Don't add transient convs to the sidebar list
      return localId;
    };

    if (!user) return fallbackLocal();

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert([{ user_id: user.id, title: 'New Chat' }])
        .select()
        .single();

      if (error || !data) {
        console.error('Failed to create conversation (DB):', error);
        // Silently fall back — user can still chat with a local transient ID
        return fallbackLocal();
      }

      const newConv: Conversation = { id: data.id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at };
      setCurrentConversation(newConv);
      setMessages([]);
      // Do NOT add to conversations list yet — only add once first message is sent
      return data.id;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return fallbackLocal();
    }
  };

  const selectConversation = async (id: string) => {
    if (!id || id.startsWith('guest-') || id.startsWith('local-')) return;
    setLoading(true);
    try {
      // Find or fetch conversation metadata
      let conv = conversations.find(c => c.id === id);
      if (!conv) {
        const { data: convData } = await supabase.from('conversations').select('*').eq('id', id).single();
        if (convData) {
          conv = { id: convData.id, title: convData.title, createdAt: convData.created_at, updatedAt: convData.updated_at };
          setConversations(prev => prev.some(c => c.id === id) ? prev : [conv!, ...prev]);
        }
      }
      if (conv) setCurrentConversation(conv);
      // Always reload messages from DB to ensure they are current
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (!error && data) setMessages(data);
    } catch (err) {
      console.error('Error selecting conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearCurrentConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  // ==================== FIXED SEND MESSAGE WITH REAL SSE STREAMING ====================
  const sendMessage = async (
    content: string,
    fileContents?: Array<{name: string; type: string; content: string}> | string,
    base64Image?: string,
    isImageGeneration: boolean = false,
    aiModel?: string
  ) => {
    const imageUrl = typeof fileContents === 'string' ? fileContents : undefined;
    const filePayload = Array.isArray(fileContents) ? fileContents : undefined;
    if (!user) return;
    if (accountStatus.isSuspended) throw new Error(`Account suspended: ${accountStatus.reason || 'Contact support'}`);

    let conversationId = currentConversation?.id;
    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) throw new Error('Failed to create conversation');
    }

    const userMessageId = `temp-user-${Date.now()}`;
    const aiMessageId = `streaming-ai-${Date.now() + 1}`;

    // ── Upload image to storage first ──
    let finalImageUrl = imageUrl;
    if (base64Image) {
      try {
        const fileName = `${Date.now()}.jpg`;
        const filePath = `${user.id}/${conversationId}/${fileName}`;
        // Decode base64 safely for both web and native
        let binaryStr: string;
        if (Platform.OS === 'web') {
          // @ts-ignore — atob is web-only
          binaryStr = atob(base64Image);
        } else {
          binaryStr = Buffer.from(base64Image, 'base64').toString('binary');
        }
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(filePath);
          finalImageUrl = urlData.publicUrl;
        }
      } catch (uploadErr) {
        console.error('Image upload error:', uploadErr);
      }
    }

    // ── Add user message to UI immediately ──
    const tempUserMessage: Message = {
      id: userMessageId, role: 'user', content, image_url: finalImageUrl, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // ── Add placeholder AI message for streaming ──
    const placeholderAIMessage: Message = {
      id: aiMessageId, role: 'assistant', content: '', created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, placeholderAIMessage]);
    setStreamingMessageId(aiMessageId);

    let hardTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // Build conversation context
      const contextMessages = [...messages, tempUserMessage].map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : String(m.content || ''),
        ...(m.image_url ? { image_url: m.image_url } : {}),
      }));

      const requestBody: any = {
        messages: contextMessages,
        conversationId,
        aiModel: aiModel || 'google-gemini',
        userImageUrl: finalImageUrl,
      };
      if (base64Image) requestBody.base64Image = base64Image;
      if (filePayload && filePayload.length > 0) requestBody.fileContents = filePayload;

      // ── Get session token for Authorization header ──
      const { data: sessionData } = await supabase.auth.getSession();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      // Use user JWT if available; fall back to anon key so edge function allows guest chat
      const token = sessionData?.session?.access_token || anonKey;

      // No artificial delay — all users get immediate responses

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat`;

      // Create AbortController for this request
      // @ts-ignore — AbortController may need polyfill on older RN versions
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Hard 60-second timeout — prevents hanging on 504 Gateway Timeout
      hardTimeoutId = setTimeout(() => {
        if (!abortController.signal.aborted) abortController.abort();
      }, 60000);

      let streamedContent = '';
      let finalImageUrlFromResponse: string | undefined;

      // ── Resilient fetch with retry for poor internet connections (Haiti & low-bandwidth areas) ──
      const MAX_SEND_RETRIES = 5;
      let response: Response | null = null;
      let lastFetchError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt++) {
        try {
          response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': anonKey,
              // Hint to server about retry attempt for smarter handling
              'x-retry-attempt': String(attempt),
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          });

          // Retry on server errors, rate-limit and gateway timeouts
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_SEND_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 16000); // 1s, 2s, 4s, 8s, 16s
            console.log(`[sendMessage] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1})...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          break; // success or non-retryable error
        } catch (fetchErr: any) {
          if (fetchErr?.name === 'AbortError') throw fetchErr; // user cancelled, don't retry
          lastFetchError = fetchErr;
          if (attempt < MAX_SEND_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`[sendMessage] Network error on attempt ${attempt + 1}: ${fetchErr.message}, retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      if (!response) {
        const isTimeout = lastFetchError?.message?.includes('timeout') || lastFetchError?.message?.includes('timed out') || lastFetchError?.name === 'AbortError';
        throw new Error(
          isTimeout
            ? 'The AI is taking too long to respond (likely a 504 Gateway Timeout). Please try again — if this keeps happening, try a shorter message.'
            : 'Unable to reach the AI server after multiple attempts. Please check your internet connection and try again.'
        );
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => String(response!.status));
        if (response.status === 504 || response.status === 502 || response.status === 503) {
          throw new Error('The AI server is temporarily unavailable (Gateway Timeout). Please wait a moment and try again.');
        }
        throw new Error(`Chat function error: ${response.status} ${errText}`);
      }

      // ── Parse SSE stream — word-by-word typewriter effect ──
      const reader = response.body?.getReader();

      // Word-by-word typewriter: schedule each word with 12ms delay
      const pendingWords: string[] = [];
      let typewriterRunning = false;

      function scheduleTypewriter() {
        if (typewriterRunning) return;
        typewriterRunning = true;
        function tick() {
          if (pendingWords.length === 0) {
            typewriterRunning = false;
            return;
          }
          const word = pendingWords.shift()!;
          streamedContent += word;
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, content: streamedContent } : m
          ));
          setTimeout(tick, 12);
        }
        tick();
      }

      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);

              if (parsed.done) {
                if (parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl;
                continue;
              }

              // Handle new streaming format with direct content
              if (parsed.content !== undefined) {
                // Split content into words for smooth rendering
                const words = parsed.content.match(/(\S+|\s+)/g) || [parsed.content];
                pendingWords.push(...words);
                scheduleTypewriter();
              }
              // Legacy support for old token format
              else if (parsed.token !== undefined) {
                const words = parsed.token.match(/(\S+|\s+)/g) || [parsed.token];
                pendingWords.push(...words);
                scheduleTypewriter();
              }
            } catch (_e) {}
          }
        }

        // Process remaining buffer
        if (buffer.trim().startsWith('data:')) {
          try {
            const parsed = JSON.parse(buffer.slice(5).trim());
            if (parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl;
            if (parsed.token) {
              const words = parsed.token.match(/(\S+|\s+)/g) || [parsed.token];
              pendingWords.push(...words);
            }
          } catch (_e) {}
        }

        // Wait for all pending words to be rendered (max 30s)
        const maxWait = 30000;
        const startWait = Date.now();
        while (pendingWords.length > 0 || typewriterRunning) {
          if (Date.now() - startWait > maxWait) break;
          await new Promise(r => setTimeout(r, 50));
        }

      } else {
        // Fallback: no streaming — apply full text at once then animate word-by-word
        const fullText = await response.text();
        const sseLines = fullText.split('\n');
        let allTokens = '';
        for (const line of sseLines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            if (parsed.done && parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl;
            // Support both new content format and legacy token format
            if (parsed.content) allTokens += parsed.content;
            else if (parsed.token) allTokens += parsed.token;
          } catch (_e) {}
        }
        // Animate word by word for non-streaming path
        const words = allTokens.match(/(\S+|\s+)/g) || [];
        for (const word of words) {
          streamedContent += word;
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, content: streamedContent } : m
          ));
          await new Promise(r => setTimeout(r, 12));
        }
      }

      if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
      abortControllerRef.current = null;

      // Clean streamed content
      let cleanMessage = streamedContent;
      cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
      cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
      cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
      cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
      cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
      cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
      cleanMessage = cleanMessage.replace(/groq-llama/gi, '');
      cleanMessage = cleanMessage.replace(/\(fallback\)/gi, '');
      cleanMessage = cleanMessage.trim();

      if (!cleanMessage && !finalImageUrlFromResponse) {
        cleanMessage = 'I am here to help! What would you like to know?';
      }

      // ── Save user message to DB (skip for local/guest IDs) ──
      const isTransientId = conversationId.startsWith('guest-') || conversationId.startsWith('local-');
      const { data: savedUserMessage } = isTransientId ? { data: null } : await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'user', content, image_url: finalImageUrl || null })
        .select()
        .single();

      if (savedUserMessage) {
        setMessages(prev => prev.map(m => m.id === userMessageId ? { ...savedUserMessage } : m));
      }

      // ── Save AI message to DB (skip for local/guest IDs) ──
      const { data: savedAIMessage } = isTransientId ? { data: null } : await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: cleanMessage,
          image_url: finalImageUrlFromResponse || null,
        })
        .select()
        .single();

      // ── Update UI with final saved messages ──
      setMessages(prev => {
        const withoutStreaming = prev.filter(m => m.id !== aiMessageId);
        const finalMsg: Message = savedAIMessage || {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: cleanMessage,
          image_url: finalImageUrlFromResponse,
          created_at: new Date().toISOString(),
        };
        return [...withoutStreaming, finalMsg];
      });

      setStreamingMessageId(null);

      // ── Update conversation title on first message (smart title generation) ──
      if (!isTransientId) {
        if (messages.length === 0) {
          let title = generateSmartConversationTitle(content, !!finalImageUrlFromResponse);
          await updateConversationTitle(conversationId, title);
          const newConv: Conversation = {
            id: conversationId, title,
            createdAt: currentConversation?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          // ADD to sidebar now that it has a message
          setConversations(prev => [newConv, ...prev.filter(c => c.id !== conversationId)]);
        } else {
          await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
          setConversations(prev => {
            const updated = prev.map(c => c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c);
            const current = updated.find(c => c.id === conversationId);
            const others = updated.filter(c => c.id !== conversationId);
            return current ? [current, ...others] : updated;
          });
        }
      }

    } catch (error: any) {
      if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
      abortControllerRef.current = null;
      setStreamingMessageId(null);

      if (error?.name === 'AbortError') {
        // User cancelled — keep the user message visible, just remove the empty AI placeholder
        setMessages(prev => {
          // Remove streaming placeholder but KEEP the user message
          return prev.filter(m => m.id !== aiMessageId);
        });
        return;
      }

      // On real errors, remove both temp messages so user can retry
      setMessages(prev => prev.filter(m => m.id !== userMessageId && m.id !== aiMessageId));
      throw error;
    }
  };

  const sendAudioMessage = async (audioBase64: string, duration: number, transcription?: string): Promise<void> => {
    if (!user) return;
    let finalTranscription = transcription;
    if (!finalTranscription) {
      const result = await transcribeAudio(audioBase64);
      if (result.error) throw new Error(result.error);
      finalTranscription = result.text;
    }
    await sendMessage(finalTranscription || '[Audio message]', undefined, undefined, false, undefined);
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      await supabase.from('conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', id);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
      if (currentConversation?.id === id) setCurrentConversation(prev => prev ? { ...prev, title } : null);
    } catch (err) {
      console.error('Error updating title:', err);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await supabase.from('conversations').delete().eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) { setCurrentConversation(null); setMessages([]); }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const searchConversations = (query: string): Conversation[] => {
    if (!query.trim()) return conversations;
    const lowerQuery = query.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(lowerQuery));
  };

  const updateMessage = async (messageId: string, newContent: string) => {
    if (!currentConversation || !user) return;
    try {
      const { error } = await supabase.from('messages').update({ content: newContent, edited: true, edited_at: new Date().toISOString() }).eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, content: newContent, edited: true, edited_at: new Date().toISOString() } : msg));
    } catch (err) {
      console.error('Error updating message:', err);
    }
  };

  const updateMessageAndRegenerate = async (messageId: string, newContent: string, aiModel?: string) => {
    if (!currentConversation || !user) return;
    const conversationId = currentConversation.id;
    const editedMessageIndex = messages.findIndex(m => m.id === messageId);
    if (editedMessageIndex === -1) return;

    try {
      // 1. Update the edited user message in the DB
      await supabase
        .from('messages')
        .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
        .eq('id', messageId);

      // 2. Delete all messages that came AFTER the edited message (AI responses + any follow-ups)
      const messagesToDelete = messages.slice(editedMessageIndex + 1);
      for (const msg of messagesToDelete) {
        await supabase.from('messages').delete().eq('id', msg.id);
      }

      // 3. Update UI: keep all messages up to and including the edited one (with new content)
      const updatedMessages = [
        ...messages.slice(0, editedMessageIndex),
        { ...messages[editedMessageIndex], content: newContent, edited: true, edited_at: new Date().toISOString() },
      ];
      setMessages(updatedMessages);

      // 4. Build the prior context for the AI (all messages up to the edited one)
      const contextMessages = updatedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : String(m.content || ''),
        ...(m.image_url ? { image_url: m.image_url } : {}),
      }));

      // 5. Stream AI response — add placeholder AI message
      const aiMessageId = `streaming-ai-edit-${Date.now()}`;
      const placeholderAIMessage: Message = {
        id: aiMessageId, role: 'assistant', content: '', created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, placeholderAIMessage]);
      setStreamingMessageId(aiMessageId);

      const { data: sessionData } = await supabase.auth.getSession();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const token = sessionData?.session?.access_token || anonKey;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat`;

      // @ts-ignore — AbortController may need polyfill on older RN versions
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          messages: contextMessages,
          conversationId,
          aiModel: aiModel || 'google-gemini',
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => String(response.status));
        throw new Error(`Chat function error: ${response.status} ${errText}`);
      }

      let streamedContent = '';
      let finalImageUrlFromResponse: string | undefined;
      const reader = response.body?.getReader();

      const pendingWords: string[] = [];
      let typewriterRunning = false;
      function scheduleTypewriter() {
        if (typewriterRunning) return;
        typewriterRunning = true;
        function tick() {
          if (pendingWords.length === 0) { typewriterRunning = false; return; }
          const word = pendingWords.shift()!;
          streamedContent += word;
          setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: streamedContent } : m));
          setTimeout(tick, 12);
        }
        tick();
      }

      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());
              if (parsed.done) { if (parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl; continue; }
              if (parsed.token !== undefined) {
                const words = parsed.token.match(/(\S+|\s+)/g) || [parsed.token];
                pendingWords.push(...words);
                scheduleTypewriter();
              }
            } catch (_e) {}
          }
        }
        const startWait = Date.now();
        while ((pendingWords.length > 0 || typewriterRunning) && Date.now() - startWait < 30000) {
          await new Promise(r => setTimeout(r, 50));
        }
      } else {
        const fullText = await response.text();
        for (const line of fullText.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            if (parsed.done && parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl;
            if (parsed.token) streamedContent += parsed.token;
          } catch (_e) {}
        }
        setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: streamedContent } : m));
      }

      abortControllerRef.current = null;

      let cleanMessage = streamedContent.replace(/\[Using [^\]]+\]\s*/gi, '').replace(/\[Model:[^\]]+\]\s*/gi, '').trim();
      if (!cleanMessage && !finalImageUrlFromResponse) cleanMessage = 'I am here to help! What would you like to know?';

      // 6. Save the new AI message to DB
      const { data: savedAIMessage } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'assistant', content: cleanMessage, image_url: finalImageUrlFromResponse || null })
        .select()
        .single();

      // 7. Replace streaming placeholder with the saved message
      setMessages(prev => {
        const withoutStreaming = prev.filter(m => m.id !== aiMessageId);
        const finalMsg: Message = savedAIMessage || {
          id: `ai-edit-${Date.now()}`, role: 'assistant', content: cleanMessage,
          image_url: finalImageUrlFromResponse, created_at: new Date().toISOString(),
        };
        return [...withoutStreaming, finalMsg];
      });

      setStreamingMessageId(null);

      // Update conversation timestamp
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    } catch (err: any) {
      abortControllerRef.current = null;
      setStreamingMessageId(null);
      if (err?.name !== 'AbortError') console.error('Error in update and regenerate:', err);
    }
  };

  const refreshConversations = async () => { await loadConversations(); };

  const exportConversation = async (id: string, format: 'json' | 'txt' | 'md'): Promise<string> => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) throw new Error('Conversation not found');
    const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    if (!msgs) throw new Error('No messages found');
    switch (format) {
      case 'json': return JSON.stringify({ conversation: conv, messages: msgs }, null, 2);
      case 'md': return `# ${conv.title}\n\n${msgs.map((m: any) => `**${m.role === 'user' ? 'You' : 'AI'}**:\n${m.content}\n`).join('\n')}`;
      default: return `${conv.title}\n\n${msgs.map((m: any) => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n')}`;
    }
  };

  const duplicateConversation = async (id: string): Promise<string | null> => {
    const original = conversations.find(c => c.id === id);
    if (!original) return null;
    try {
      const newId = await createConversation();
      if (!newId) return null;
      await updateConversationTitle(newId, `${original.title} (Copy)`);
      const { data: originalMessages } = await supabase.from('messages').select('*').eq('conversation_id', id);
      if (originalMessages && originalMessages.length > 0) {
        const newMessages = originalMessages.map((m: any) => ({ ...m, id: undefined, conversation_id: newId, created_at: new Date().toISOString() }));
        await supabase.from('messages').insert(newMessages);
      }
      return newId;
    } catch (err) {
      console.error('Error duplicating conversation:', err);
      return null;
    }
  };

  const archiveConversation = async (id: string): Promise<void> => {
    try {
      await supabase.from('conversations').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) clearCurrentConversation();
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  };

  const archiveAllConversations = async (): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('conversations').update({ is_archived: true }).eq('user_id', user.id).eq('is_archived', false);
      setConversations([]);
      clearCurrentConversation();
    } catch (err) {
      console.error('Error archiving all conversations:', err);
    }
  };

  const deleteAllConversations = async (): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('conversations').delete().eq('user_id', user.id);
      setConversations([]);
      clearCurrentConversation();
    } catch (err) {
      console.error('Error deleting all conversations:', err);
    }
  };

  return (
    <ConversationContext.Provider value={{
      conversations,
      currentConversation,
      messages,
      loading,
      streamingMessageId,
      accountStatus,
      temporaryMode,
      setTemporaryMode,
      cancelSendMessage,
      checkAccountStatus,
      createConversation,
      selectConversation,
      sendMessage,
      sendAudioMessage,
      updateMessage,
      updateMessageAndRegenerate,
      deleteConversation,
      updateConversationTitle,
      searchConversations,
      refreshConversations,
      clearCurrentConversation,
      transcribeAudio,
      checkContentViolation,
      audioRecording,
      startAudioRecording,
      stopAudioRecording,
      cancelAudioRecording,
      exportConversation,
      duplicateConversation,
      archiveConversation,
      archiveAllConversations,
      deleteAllConversations,
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = React.useContext(ConversationContext);
  if (context === undefined) throw new Error('useConversation must be used within a ConversationProvider');
  return context;
}
