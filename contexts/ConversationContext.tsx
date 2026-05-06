import React, { createContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Offline cache keys ─────────────────────────────────────────────────────
const CONV_CACHE_KEY = 'offline_conversations_v1';
const MSG_CACHE_PREFIX = 'offline_messages_v1_';

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
  isOfflineMode: boolean;
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
  if (SELF_HARM_KEYWORDS.some(kw => lower.includes(kw))) return 'Safety Support';
  if (hasImage || ['create a logo', 'generate logo', 'make a logo', 'create image', 'generate image'].some(kw => lower.includes(kw))) {
    if (lower.includes('logo')) return 'Logo Design';
    if (lower.includes('banner')) return 'Banner Design';
    if (lower.includes('image') || lower.includes('photo')) return 'Image Creation';
    return 'Image Generation';
  }
  if (/^(hi|hello|hey|bonjou|alo|salut|hola|bonsoir|good morning|good evening)\b/.test(lower.trim())) return 'Greeting';
  if (lower.includes('code') || lower.includes('bug') || lower.includes('function') || lower.includes('script')) {
    const langMatch = firstMessage.match(/(javascript|typescript|python|java|swift|kotlin|html|css|react|node)/i);
    return langMatch ? `${langMatch[1]} Help` : 'Coding Help';
  }
  if (lower.includes('translate') || lower.includes('traduction')) return 'Translation';
  if (lower.includes('quiz') || lower.includes('trivia')) return 'Quiz';
  if (/\d+\s*[+\-*/^]\s*\d+/.test(firstMessage) || lower.includes('calculate') || lower.includes('math')) return 'Math Problem';
  if (lower.includes('write') || lower.includes('compose') || lower.includes('draft') || lower.includes('email')) return 'Writing Help';
  if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does') || lower.includes('tell me about')) {
    const topicMatch = firstMessage.match(/(?:what is|how does|explain|about)\s+(.{3,30})/i);
    if (topicMatch) return topicMatch[1].trim().split(' ').slice(0, 4).join(' ');
    return 'Research';
  }
  if (lower.includes('recipe') || lower.includes('cook') || lower.includes('food')) return 'Recipe';
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
  const abortControllerRef = useRef<any | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [accountStatus, setAccountStatus] = useState<AccountStatus>({
    isSuspended: false, reason: null, suspendedAt: null, expiresAt: null, violationCount: 0,
  });

  const [audioRecording, setAudioRecording] = useState<AudioRecordingState>({
    isRecording: false, duration: 0, audioBase64: null, waveformData: [],
  });

  const [temporaryMode, setTemporaryMode] = useState(false);

  // ── Offline cache helpers ──────────────────────────────────────────────────
  const cacheConversations = useCallback(async (convs: Conversation[]) => {
    try { await AsyncStorage.setItem(CONV_CACHE_KEY, JSON.stringify(convs.slice(0, 20))); } catch (_e) {}
  }, []);

  const loadCachedConversations = useCallback(async (): Promise<Conversation[]> => {
    try { const r = await AsyncStorage.getItem(CONV_CACHE_KEY); return r ? JSON.parse(r) : []; } catch (_e) { return []; }
  }, []);

  const cacheMessages = useCallback(async (convId: string, msgs: Message[]) => {
    try { await AsyncStorage.setItem(`${MSG_CACHE_PREFIX}${convId}`, JSON.stringify(msgs)); } catch (_e) {}
  }, []);

  const loadCachedMessages = useCallback(async (convId: string): Promise<Message[]> => {
    try { const r = await AsyncStorage.getItem(`${MSG_CACHE_PREFIX}${convId}`); return r ? JSON.parse(r) : []; } catch (_e) { return []; }
  }, []);

  // ── Cancel any in-flight request ──
  const cancelSendMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingMessageId(null);
  }, []);

  useEffect(() => {
    if (user) { loadConversations(); checkAccountStatus(); }
  }, [user]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    };
  }, []);

  const checkAccountStatus = async (): Promise<void> => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_profiles')
        .select('is_suspended, suspension_reason, suspended_at, suspension_expires_at, violation_count')
        .eq('id', user.id).single();
      if (!error && data) {
        setAccountStatus({
          isSuspended: data.is_suspended || false,
          reason: data.suspension_reason || null,
          suspendedAt: data.suspended_at || null,
          expiresAt: data.suspension_expires_at || null,
          violationCount: data.violation_count || 0,
        });
      }
    } catch (err) { console.error('Failed to check account status:', err); }
  };

  const handleContentViolation = async (violationType: string, severity: 'low' | 'medium' | 'high', details?: string): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('content_violations').insert([{ user_id: user.id, violation_type: violationType, severity, details: details || null, created_at: new Date().toISOString() }]);
      const newViolationCount = accountStatus.violationCount + 1;
      let shouldSuspend = false, suspensionReason = '', suspensionDuration: number | null = null;
      if (severity === 'high' || newViolationCount >= 5) { shouldSuspend = true; suspensionReason = 'Multiple content policy violations.'; suspensionDuration = 7 * 24 * 60 * 60; }
      else if (severity === 'medium' && newViolationCount >= 3) { shouldSuspend = true; suspensionReason = 'Repeated content violations.'; suspensionDuration = 24 * 60 * 60; }
      if (shouldSuspend) {
        const suspendedAt = new Date().toISOString();
        const expiresAt = suspensionDuration ? new Date(Date.now() + suspensionDuration * 1000).toISOString() : null;
        await supabase.from('user_profiles').update({ is_suspended: true, suspension_reason: suspensionReason, suspended_at: suspendedAt, suspension_expires_at: expiresAt, violation_count: newViolationCount }).eq('id', user.id);
        setAccountStatus({ isSuspended: true, reason: suspensionReason, suspendedAt, expiresAt, violationCount: newViolationCount });
      } else {
        await supabase.from('user_profiles').update({ violation_count: newViolationCount }).eq('id', user.id);
        setAccountStatus(prev => ({ ...prev, violationCount: newViolationCount }));
      }
    } catch (err) { console.error('Failed to handle content violation:', err); }
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
    } catch (err: any) { return { text: '', error: err.message || 'Unexpected error occurred', isViolation: false }; }
  };

  const checkContentViolation = async (_text: string): Promise<{ isViolation: boolean; reason?: string; severity?: 'low' | 'medium' | 'high' }> => {
    return { isViolation: false };
  };

  const startAudioRecording = async (): Promise<void> => {
    if (Platform.OS !== 'web') return;
    // @ts-ignore
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { Alert.alert('Audio recording not supported.'); return; }
    try {
      // @ts-ignore
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // @ts-ignore
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
    } catch (err) { console.error('Failed to start recording:', err); }
  };

  const stopAudioRecording = async (): Promise<{ base64: string; duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') { resolve(null); return; }
      mediaRecorderRef.current.onstop = async () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
        // @ts-ignore
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // @ts-ignore
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
      // 1. Show cached conversations immediately for instant UI
      const cached = await loadCachedConversations();
      if (cached.length > 0) {
        setConversations(cached);
      }

      // 2. Fetch fresh data from network
      const { data: allConvs, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at, is_archived')
        .eq('user_id', user.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('updated_at', { ascending: false })
        .limit(120);

      if (error || !allConvs) {
        // Network failed — keep cached data
        if (cached.length > 0) setIsOfflineMode(true);
        return;
      }

      setIsOfflineMode(false);

      if (allConvs.length === 0) { setConversations([]); await cacheConversations([]); return; }

      const convIds = allConvs.map((c: any) => c.id);
      const { data: msgRows } = await supabase.from('messages').select('conversation_id').in('conversation_id', convIds);
      const idsWithMessages = new Set((msgRows || []).map((m: any) => m.conversation_id));

      const mapped = allConvs
        .filter((c: any) => idsWithMessages.has(c.id))
        .map((c: any) => ({ id: c.id, title: c.title || 'New Chat', createdAt: c.created_at, updatedAt: c.updated_at }));

      setConversations(mapped);
      // Cache the fresh result for offline access
      await cacheConversations(mapped);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      const cached = await loadCachedConversations();
      if (cached.length > 0) { setConversations(cached); setIsOfflineMode(true); }
    }
  };

  const createConversation = async (): Promise<string | null> => {
    const fallbackLocal = (): string => {
      const localId = `guest-${Date.now()}`;
      const localConv: Conversation = { id: localId, title: 'New Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setCurrentConversation(localConv);
      setMessages([]);
      return localId;
    };

    if (!user) return fallbackLocal();

    try {
      const { data, error } = await supabase.from('conversations').insert([{ user_id: user.id, title: 'New Chat' }]).select().single();
      if (error || !data) { console.error('Failed to create conversation (DB):', error); return fallbackLocal(); }
      const newConv: Conversation = { id: data.id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at };
      setCurrentConversation(newConv);
      setMessages([]);
      return data.id;
    } catch (err) { console.error('Error creating conversation:', err); return fallbackLocal(); }
  };

  const selectConversation = async (id: string) => {
    if (!id || id.startsWith('guest-') || id.startsWith('local-')) return;
    setLoading(true);
    try {
      // Show cached messages immediately for instant display
      const cachedMsgs = await loadCachedMessages(id);
      if (cachedMsgs.length > 0) setMessages(cachedMsgs);

      let conv = conversations.find(c => c.id === id);
      if (!conv) {
        const { data: convData } = await supabase.from('conversations').select('*').eq('id', id).single();
        if (convData) {
          conv = { id: convData.id, title: convData.title, createdAt: convData.created_at, updatedAt: convData.updated_at };
          setConversations(prev => prev.some(c => c.id === id) ? prev : [conv!, ...prev]);
        }
      }
      if (conv) setCurrentConversation(conv);

      // Fetch fresh messages from network
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(data);
        await cacheMessages(id, data); // Cache for offline access
        setIsOfflineMode(false);
      } else if (cachedMsgs.length > 0) {
        setIsOfflineMode(true); // Using cached data
      }
    } catch (err) {
      console.error('Error selecting conversation:', err);
      setIsOfflineMode(true);
    } finally { setLoading(false); }
  };

  const clearCurrentConversation = () => { setCurrentConversation(null); setMessages([]); };

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
        let binaryStr: string;
        if (Platform.OS === 'web') {
          // @ts-ignore
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
      } catch (uploadErr) { console.error('Image upload error:', uploadErr); }
    }

    // ── Add user message to UI immediately ──
    const tempUserMessage: Message = {
      id: userMessageId, role: 'user', content, image_url: finalImageUrl, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // ── Add placeholder AI message for streaming ──
    const placeholderAIMessage: Message = { id: aiMessageId, role: 'assistant', content: '', created_at: new Date().toISOString() };
    setMessages(prev => [...prev, placeholderAIMessage]);
    setStreamingMessageId(aiMessageId);

    let hardTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
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

      const { data: sessionData } = await supabase.auth.getSession();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const token = sessionData?.session?.access_token || anonKey;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat`;

      // @ts-ignore
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      hardTimeoutId = setTimeout(() => { if (!abortController.signal.aborted) abortController.abort(); }, 60000);

      let streamedContent = '';
      let finalImageUrlFromResponse: string | undefined;

      const MAX_SEND_RETRIES = 5;
      let response: Response | null = null;
      let lastFetchError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt++) {
        try {
          response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': anonKey, 'x-retry-attempt': String(attempt) },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          });
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_SEND_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          break;
        } catch (fetchErr: any) {
          if (fetchErr?.name === 'AbortError') throw fetchErr;
          lastFetchError = fetchErr;
          if (attempt < MAX_SEND_RETRIES) { await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); }
        }
      }

      if (!response) {
        throw new Error('Unable to reach the AI server. Please check your internet connection and try again.');
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => String(response!.status));
        if (response.status === 504 || response.status === 502 || response.status === 503) {
          throw new Error('The AI server is temporarily unavailable. Please try again.');
        }
        throw new Error(`Chat function error: ${response.status} ${errText}`);
      }

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
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.done) { if (parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl; continue; }
              if (parsed.content !== undefined) { const words = parsed.content.match(/(\S+|\s+)/g) || [parsed.content]; pendingWords.push(...words); scheduleTypewriter(); }
              else if (parsed.token !== undefined) { const words = parsed.token.match(/(\S+|\s+)/g) || [parsed.token]; pendingWords.push(...words); scheduleTypewriter(); }
            } catch (_e) {}
          }
        }
        const maxWait = 30000, startWait = Date.now();
        while ((pendingWords.length > 0 || typewriterRunning) && Date.now() - startWait < maxWait) {
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
            if (parsed.content) streamedContent += parsed.content;
            else if (parsed.token) streamedContent += parsed.token;
          } catch (_e) {}
        }
        const words = streamedContent.match(/(\S+|\s+)/g) || [];
        streamedContent = '';
        for (const word of words) {
          streamedContent += word;
          setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, content: streamedContent } : m));
          await new Promise(r => setTimeout(r, 12));
        }
      }

      if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
      abortControllerRef.current = null;

      let cleanMessage = streamedContent
        .replace(/\[Using [^\]]+\]\s*/gi, '').replace(/\[Model:[^\]]+\]\s*/gi, '')
        .replace(/\[Fallback:[^\]]+\]\s*/gi, '').replace(/google-gemini unavailable/gi, '')
        .replace(/openai unavailable/gi, '').replace(/claude unavailable/gi, '')
        .replace(/groq-llama\s*/gi, '').replace(/\(fallback\)/gi, '').trim();

      if (!cleanMessage && !finalImageUrlFromResponse) cleanMessage = 'I am here to help! What would you like to know?';

      const isTransientId = conversationId.startsWith('guest-') || conversationId.startsWith('local-');
      const { data: savedUserMessage } = isTransientId ? { data: null } : await supabase
        .from('messages').insert({ conversation_id: conversationId, role: 'user', content, image_url: finalImageUrl || null }).select().single();
      if (savedUserMessage) setMessages(prev => prev.map(m => m.id === userMessageId ? { ...savedUserMessage } : m));

      const { data: savedAIMessage } = isTransientId ? { data: null } : await supabase
        .from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: cleanMessage, image_url: finalImageUrlFromResponse || null }).select().single();

      setMessages(prev => {
        const withoutStreaming = prev.filter(m => m.id !== aiMessageId);
        const finalMsg: Message = savedAIMessage || { id: `ai-${Date.now()}`, role: 'assistant', content: cleanMessage, image_url: finalImageUrlFromResponse, created_at: new Date().toISOString() };
        const result = [...withoutStreaming, finalMsg];
        // Cache updated messages
        if (!isTransientId) cacheMessages(conversationId!, result).catch(() => {});
        return result;
      });

      setStreamingMessageId(null);
      setIsOfflineMode(false);

      if (!isTransientId) {
        if (messages.length === 0) {
          const title = generateSmartConversationTitle(content, !!finalImageUrlFromResponse);
          await updateConversationTitle(conversationId, title);
          const newConv: Conversation = { id: conversationId, title, createdAt: currentConversation?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
          setConversations(prev => {
            const updated = [newConv, ...prev.filter(c => c.id !== conversationId)];
            cacheConversations(updated).catch(() => {});
            return updated;
          });
        } else {
          await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
          setConversations(prev => {
            const updated = prev.map(c => c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c);
            const current = updated.find(c => c.id === conversationId);
            const others = updated.filter(c => c.id !== conversationId);
            const result = current ? [current, ...others] : updated;
            cacheConversations(result).catch(() => {});
            return result;
          });
        }
      }
    } catch (error: any) {
      if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
      abortControllerRef.current = null;
      setStreamingMessageId(null);

      if (error?.name === 'AbortError') {
        setMessages(prev => prev.filter(m => m.id !== aiMessageId));
        return;
      }
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
    } catch (err) { console.error('Error updating title:', err); }
  };

  const deleteConversation = async (id: string) => {
    try {
      await supabase.from('conversations').delete().eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) { setCurrentConversation(null); setMessages([]); }
      // Remove from cache
      AsyncStorage.removeItem(`${MSG_CACHE_PREFIX}${id}`).catch(() => {});
    } catch (err) { console.error('Error deleting conversation:', err); }
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
    } catch (err) { console.error('Error updating message:', err); }
  };

  const updateMessageAndRegenerate = async (messageId: string, newContent: string, aiModel?: string) => {
    if (!currentConversation || !user) return;
    const conversationId = currentConversation.id;
    const editedMessageIndex = messages.findIndex(m => m.id === messageId);
    if (editedMessageIndex === -1) return;
    try {
      await supabase.from('messages').update({ content: newContent, edited: true, edited_at: new Date().toISOString() }).eq('id', messageId);
      const messagesToDelete = messages.slice(editedMessageIndex + 1);
      for (const msg of messagesToDelete) await supabase.from('messages').delete().eq('id', msg.id);
      const updatedMessages = [...messages.slice(0, editedMessageIndex), { ...messages[editedMessageIndex], content: newContent, edited: true, edited_at: new Date().toISOString() }];
      setMessages(updatedMessages);
      const contextMessages = updatedMessages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : String(m.content || ''), ...(m.image_url ? { image_url: m.image_url } : {}) }));
      const aiMessageId = `streaming-ai-edit-${Date.now()}`;
      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '', created_at: new Date().toISOString() }]);
      setStreamingMessageId(aiMessageId);
      const { data: sessionData } = await supabase.auth.getSession();
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const token = sessionData?.session?.access_token || anonKey;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      // @ts-ignore
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
        body: JSON.stringify({ messages: contextMessages, conversationId, aiModel: aiModel || 'google-gemini' }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error(`Chat function error: ${response.status}`);
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
          streamedContent += pendingWords.shift()!;
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
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());
              if (parsed.done) { if (parsed.imageUrl) finalImageUrlFromResponse = parsed.imageUrl; continue; }
              const chunk = parsed.content ?? parsed.token ?? '';
              if (chunk) { const words = chunk.match(/(\S+|\s+)/g) || [chunk]; pendingWords.push(...words); scheduleTypewriter(); }
            } catch (_e) {}
          }
        }
        const startWait = Date.now();
        while ((pendingWords.length > 0 || typewriterRunning) && Date.now() - startWait < 30000) await new Promise(r => setTimeout(r, 50));
      }
      abortControllerRef.current = null;
      let cleanMessage = streamedContent.replace(/\[Using [^\]]+\]\s*/gi, '').replace(/\[Model:[^\]]+\]\s*/gi, '').trim();
      if (!cleanMessage && !finalImageUrlFromResponse) cleanMessage = 'I am here to help!';
      const { data: savedAIMessage } = await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: cleanMessage, image_url: finalImageUrlFromResponse || null }).select().single();
      setMessages(prev => {
        const withoutStreaming = prev.filter(m => m.id !== aiMessageId);
        const finalMsg: Message = savedAIMessage || { id: `ai-edit-${Date.now()}`, role: 'assistant', content: cleanMessage, image_url: finalImageUrlFromResponse, created_at: new Date().toISOString() };
        return [...withoutStreaming, finalMsg];
      });
      setStreamingMessageId(null);
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
        await supabase.from('messages').insert(originalMessages.map((m: any) => ({ ...m, id: undefined, conversation_id: newId, created_at: new Date().toISOString() })));
      }
      return newId;
    } catch (err) { console.error('Error duplicating conversation:', err); return null; }
  };

  const archiveConversation = async (id: string): Promise<void> => {
    try {
      await supabase.from('conversations').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) clearCurrentConversation();
    } catch (err) { console.error('Error archiving conversation:', err); }
  };

  const archiveAllConversations = async (): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('conversations').update({ is_archived: true }).eq('user_id', user.id).eq('is_archived', false);
      setConversations([]); clearCurrentConversation();
    } catch (err) { console.error('Error archiving all conversations:', err); }
  };

  const deleteAllConversations = async (): Promise<void> => {
    if (!user) return;
    try {
      await supabase.from('conversations').delete().eq('user_id', user.id);
      setConversations([]); clearCurrentConversation();
      await AsyncStorage.removeItem(CONV_CACHE_KEY).catch(() => {});
    } catch (err) { console.error('Error deleting all conversations:', err); }
  };

  return (
    <ConversationContext.Provider value={{
      conversations, currentConversation, messages, loading, streamingMessageId,
      accountStatus, isOfflineMode,
      temporaryMode, setTemporaryMode,
      cancelSendMessage, checkAccountStatus,
      createConversation, selectConversation,
      sendMessage, sendAudioMessage,
      updateMessage, updateMessageAndRegenerate,
      deleteConversation, updateConversationTitle,
      searchConversations, refreshConversations, clearCurrentConversation,
      transcribeAudio, checkContentViolation,
      audioRecording, startAudioRecording, stopAudioRecording, cancelAudioRecording,
      exportConversation, duplicateConversation,
      archiveConversation, archiveAllConversations, deleteAllConversations,
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
