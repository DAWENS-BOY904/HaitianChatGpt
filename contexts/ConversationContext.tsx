import React, { createContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';
import { FunctionsHttpError } from '@supabase/supabase-js';
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
  streamingMessageId: string | null; // NEW: Track streaming message
  accountStatus: AccountStatus;
  checkAccountStatus: () => Promise<void>;
  createConversation: () => Promise<string | null>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, imageUrl?: string, base64Image?: string, isImageGeneration?: boolean, aiModel?: string) => Promise<void>;
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
}

export const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Safety wrapper to ensure messages is always an array
  const safeSetMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof updater === 'function') {
      setMessages(prev => {
        const result = updater(Array.isArray(prev) ? prev : []);
        return Array.isArray(result) ? result : [];
      });
    } else {
      setMessages(Array.isArray(updater) ? updater : []);
    }
  };
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null); // NEW
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

      if (error) {
        console.error('Error checking account status:', error);
        return;
      }

      if (data) {
        setAccountStatus({
          isSuspended: data.is_suspended || false,
          reason: data.suspension_reason || null,
          suspendedAt: data.suspended_at || null,
          expiresAt: data.suspension_expires_at || null,
          violationCount: data.violation_count || 0,
        });
        if (data.is_suspended) {
          console.error('🚫 ACCOUNT SUSPENDED:', data.suspension_reason);
        }
      }
    } catch (err) {
      console.error('Failed to check account status:', err);
    }
  };

  const handleContentViolation = async (violationType: string, severity: 'low' | 'medium' | 'high', details?: string): Promise<void> => {
    if (!user) return;
    console.error(`🚫 Content Violation Detected: ${violationType} (${severity})`);

    try {
      await supabase.from('content_violations').insert([{
        user_id: user.id,
        violation_type: violationType,
        severity: severity,
        details: details || null,
        created_at: new Date().toISOString(),
      }]);

      const newViolationCount = accountStatus.violationCount + 1;
      let shouldSuspend = false;
      let suspensionReason = '';
      let suspensionDuration: number | null = null;

      if (severity === 'high' || newViolationCount >= 5) {
        shouldSuspend = true;
        suspensionReason = 'Multiple content policy violations detected. Account suspended for security.';
        suspensionDuration = 7 * 24 * 60 * 60;
      } else if (severity === 'medium' && newViolationCount >= 3) {
        shouldSuspend = true;
        suspensionReason = 'Repeated content violations. Temporary suspension applied.';
        suspensionDuration = 24 * 60 * 60;
      }

      if (shouldSuspend) {
        const suspendedAt = new Date().toISOString();
        const expiresAt = suspensionDuration 
          ? new Date(Date.now() + suspensionDuration * 1000).toISOString()
          : null;

        await supabase.from('user_profiles').update({
          is_suspended: true,
          suspension_reason: suspensionReason,
          suspended_at: suspendedAt,
          suspension_expires_at: expiresAt,
          violation_count: newViolationCount,
        }).eq('id', user.id);

        setAccountStatus({
          isSuspended: true,
          reason: suspensionReason,
          suspendedAt: suspendedAt,
          expiresAt: expiresAt,
          violationCount: newViolationCount,
        });

        alert(`⚠️ Account Suspended\n\n${suspensionReason}\n\n${expiresAt ? `Suspension expires: ${new Date(expiresAt).toLocaleString()}` : 'Contact support for assistance.'}`);
      } else {
        await supabase.from('user_profiles').update({
          violation_count: newViolationCount,
        }).eq('id', user.id);

        setAccountStatus(prev => ({
          ...prev,
          violationCount: newViolationCount,
        }));

        if (severity === 'medium') {
          alert(`⚠️ Warning: Content violation detected (${violationType}).\n\nRepeated violations may result in account suspension.`);
        }
      }
    } catch (err) {
      console.error('Failed to handle content violation:', err);
    }
  };

  const transcribeAudio = async (
    audioBase64: string, 
    options?: { language?: string; detectLanguage?: boolean }
  ): Promise<TranscriptionResult> => {
    if (!user) return { text: '', error: 'User not authenticated' };
    if (accountStatus.isSuspended) {
      return { text: '', error: 'ACCOUNT_SUSPENDED', isViolation: false };
    }

    try {
      console.log('🎙️ Calling transcribe-audio function...');
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { 
          audio: audioBase64,
          language: options?.language,
          detectLanguage: options?.detectLanguage ?? true,
          userId: user.id,
        },
      });

      if (error) {
        console.error('❌ Transcription error:', error);
        if (error instanceof FunctionsHttpError) {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          
          if (statusCode === 403 || 
              textContent?.toLowerCase().includes('violation') ||
              textContent?.toLowerCase().includes('inappropriate content') ||
              textContent?.toLowerCase().includes('content policy')) {
            await handleContentViolation('AUDIO_CONTENT_VIOLATION', 'high', textContent || undefined);
            return { text: '', error: 'CONTENT_VIOLATION', isViolation: true };
          }
          return { text: '', error: textContent || error.message || 'Transcription failed', isViolation: false };
        }
        return { text: '', error: error.message || 'Unknown error', isViolation: false };
      }

      if (data.text) {
        const contentCheck = await checkContentViolation(data.text);
        if (contentCheck.isViolation) {
          await handleContentViolation('TRANSCRIBED_TEXT_VIOLATION', contentCheck.severity || 'medium', contentCheck.reason);
          return {
            text: data.text,
            error: 'CONTENT_VIOLATION_DETECTED_IN_TRANSCRIPTION',
            isViolation: true,
            confidence: data.confidence,
            language: data.language,
          };
        }
      }

      console.log('✅ Transcription successful');
      return { 
        text: data.text || '', 
        confidence: data.confidence,
        language: data.language,
        error: undefined,
        isViolation: false 
      };
    } catch (err: any) {
      console.error('❌ Unexpected transcription error:', err);
      return { text: '', error: err.message || 'Unexpected error occurred', isViolation: false };
    }
  };

  const checkContentViolation = async (text: string): Promise<{ isViolation: boolean; reason?: string; severity?: 'low' | 'medium' | 'high' }> => {
    try {
      const { data, error } = await supabase.functions.invoke('check-content', { body: { text } });
      if (error) {
        console.error('Content check error:', error);
        return { isViolation: false };
      }
      return {
        isViolation: data.isViolation || false,
        reason: data.reason,
        severity: data.severity || 'low',
      };
    } catch (err) {
      console.error('Content check failed:', err);
      return { isViolation: false };
    }
  };

  const startAudioRecording = async (): Promise<void> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(100);
      let duration = 0;
      recordingTimerRef.current = setInterval(() => {
        duration += 1;
        setAudioRecording(prev => ({ ...prev, duration: duration }));
      }, 1000);

      waveformIntervalRef.current = setInterval(() => {
        const simulatedWaveform = Array.from({ length: 20 }, () => Math.random() * 100);
        setAudioRecording(prev => ({ ...prev, waveformData: simulatedWaveform }));
      }, 100);

      setAudioRecording({ isRecording: true, duration: 0, audioBase64: null, waveformData: [] });
      console.log('🎙️ Started audio recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopAudioRecording = async (): Promise<{ base64: string; duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          const result = { base64: base64Data, duration: audioRecording.duration };

          setAudioRecording({
            isRecording: false,
            duration: audioRecording.duration,
            audioBase64: base64Data,
            waveformData: [],
          });

          mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          console.log('🎙️ Stopped audio recording, duration:', result.duration);
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
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);

    setAudioRecording({ isRecording: false, duration: 0, audioBase64: null, waveformData: [] });
    console.log('🎙️ Cancelled audio recording');
  };

  const loadConversations = async () => {
    if (!user) return;
    console.log('🔄 Loading conversations for user:', user.id);

    try {
      const { data: conversationsWithMessages, error } = await supabase
        .from('conversations')
        .select(`id, title, created_at, updated_at, is_archived, messages!inner (id)`)
        .eq('user_id', user.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('updated_at', { ascending: false });

      if (!error && conversationsWithMessages) {
        const validConversations = (conversationsWithMessages || [])
          .filter((c: any) => Array.isArray(c.messages) && c.messages.length > 0)
          .map((c: any) => ({
            id: c.id,
            title: c.title,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
        setConversations(validConversations);
      } else if (error) {
        console.error('❌ Error loading conversations:', error);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const createConversation = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert([{ user_id: user.id, title: 'New Chat' }])
        .select()
        .single();

      if (error || !data) {
        console.error('❌ Failed to create conversation:', error);
        return null;
      }

      const newConv: Conversation = {
        id: data.id,
        title: data.title,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setCurrentConversation(newConv);
      setMessages([]);
      return data.id;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  };

  const selectConversation = async (id: string) => {
    setLoading(true);
    try {
      const conv = conversations.find(c => c.id === id);
      if (conv) setCurrentConversation(conv);

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

 // ==================== FIXED SEND MESSAGE ====================
const sendMessage = async (
  content: string, 
  imageUrl?: string, 
  base64Image?: string,
  isImageGeneration: boolean = false, 
  aiModel?: string
) => {
  if (!user) return;
  if (accountStatus.isSuspended) {
    throw new Error(`Account suspended: ${accountStatus.reason || 'Contact support'}`);
  }

  const contentCheck = await checkContentViolation(content);
  if (contentCheck.isViolation) {
    await handleContentViolation('TEXT_CONTENT_VIOLATION', contentCheck.severity || 'medium', contentCheck.reason);
    throw new Error('Message blocked: Content violates usage policies.');
  }

  let conversationId = currentConversation?.id;
  if (!conversationId) {
    conversationId = await createConversation();
    if (!conversationId) throw new Error('Failed to create conversation');
  }

  const userMessageId = `temp-user-${Date.now()}`;
  const aiMessageId = `temp-ai-${Date.now() + 1}`;

  // CRITICAL FIX: Always upload image to storage first
  let finalImageUrl = imageUrl;
  
  if (base64Image) {
    try {
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${user.id}/${conversationId}/${fileName}`;
      
      // Convert base64 to Uint8Array for upload
      const binaryStr = atob(base64Image);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
        console.log('📸 Image uploaded to storage:', finalImageUrl);
      } else {
        console.error('Image upload failed:', uploadError);
      }
    } catch (uploadErr) {
      console.error('Image upload error:', uploadErr);
    }
  }

  const tempUserMessage: Message = {
    id: userMessageId,
    role: 'user',
    content,
    image_url: finalImageUrl,
    created_at: new Date().toISOString(),
  };

  // CRITICAL: Add user message AND set streaming immediately
  setMessages(prev => [...prev, tempUserMessage]);

  try {
    const contextMessages = [...messages, tempUserMessage].map(m => {
      if (m.image_url || m.role === 'user') {
        return {
          role: m.role,
          content: m.content,
          ...(m.image_url && { image_url: m.image_url })
        };
      }
      return { role: m.role, content: m.content };
    });

    const requestBody: any = {
      messages: contextMessages,
      conversationId: conversationId,
      aiModel: aiModel || 'google-gemini',
      userImageUrl: finalImageUrl, // CRITICAL: Send image URL to backend
    };

    if (base64Image) {
      requestBody.base64Image = base64Image;
      console.log('📸 Sending with base64 image, length:', base64Image.length);
    }
    if (isImageGeneration && base64Image) requestBody.isImageGeneration = true;

    console.log('📤 Sending message with model:', aiModel || 'google-gemini');

    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
      body: requestBody,
    });

    if (aiError) throw aiError;

    // Clean message
    let cleanMessage = aiResponse.message || 'Response generated';
    cleanMessage = cleanMessage.replace(/\[Using [^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Model:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[Fallback:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[.*?unavailable.*?\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/google-gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/groq-llama/gi, '');
    cleanMessage = cleanMessage.replace(/claude unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/openai unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/gemini unavailable/gi, '');
    cleanMessage = cleanMessage.replace(/using [a-z-]+ -/gi, '');
    cleanMessage = cleanMessage.replace(/\(fallback\)/gi, '');
    cleanMessage = cleanMessage.trim();

    if (cleanMessage.match(/\[Using|unavailable|fallback|groq|claude/i)) {
      const sentences = cleanMessage.split(/\n\n/);
      cleanMessage = sentences.find(s => !s.match(/\[Using|unavailable|fallback|groq|claude/i)) || cleanMessage;
    }

    const tempAIMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: cleanMessage,
      image_url: aiResponse.imageUrl || undefined,
      file_url: aiResponse.fileUrl || undefined,
      file_name: aiResponse.fileName || undefined,
      file_type: aiResponse.fileType || undefined,
      created_at: new Date().toISOString(),
    };

    // CRITICAL FIX: Set streaming ID to enable animation
    setStreamingMessageId(aiMessageId);

    // CRITICAL FIX: Save user message IMMEDIATELY after creation (before AI response)
    const { data: savedUserMessage, error: saveUserError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content,
        image_url: finalImageUrl || null,
      })
      .select()
      .single();

    if (saveUserError) {
      console.error('Failed to save user message:', saveUserError);
    } else if (savedUserMessage) {
      // CRITICAL: Replace temp message with saved message immediately
      setMessages(prev => prev.map(m => 
        m.id === userMessageId ? { ...savedUserMessage } : m
      ));
    }

    // CRITICAL FIX: Save AI message to database
    const { data: savedAIMessage, error: saveAIError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: cleanMessage,
        image_url: aiResponse.imageUrl || undefined,
        file_url: aiResponse.fileUrl || undefined,
        file_name: aiResponse.fileName || undefined,
        file_type: aiResponse.fileType || undefined,
      })
      .select()
      .single();

    if (saveAIError) {
      console.error('Failed to save AI message:', saveAIError);
    }

    // Update messages - Replace ONLY temp AI messages
    setMessages(prev => {
      // Filter out ONLY temp AI messages (keep user messages including saved one)
      const withoutTempAI = prev.filter(m => 
        m.id !== aiMessageId
      );
      
      // Add final AI message
      const finalAIMessage = savedAIMessage || tempAIMessage;
      
      return [...withoutTempAI, finalAIMessage];
    });

    // Update title if first message
    if (messages.length === 0) {
      let title = content.slice(0, 50);
      if (aiResponse.imageUrl) {
        title = content.includes('logo') ? '🎨 Logo Design' : '🖼️ Image Generation';
      } else if (aiResponse.fileName) {
        title = `📄 File: ${aiResponse.fileName}`;
      } else if (content.length > 50) {
        title = content.slice(0, 47) + '...';
      }
      
      await updateConversationTitle(conversationId, title);
      
      const newConv: Conversation = {
        id: conversationId,
        title: title,
        createdAt: currentConversation?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setConversations(prev => [newConv, ...prev]);
    } else {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      setConversations(prev => {
        const updated = prev.map(c => 
          c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c
        );
        const current = updated.find(c => c.id === conversationId);
        const others = updated.filter(c => c.id !== conversationId);
        return current ? [current, ...others] : updated;
      });
    }

    // CRITICAL FIX: Clear streaming ID after animation completes
    setTimeout(() => {
      setStreamingMessageId(null);
    }, 2000);

  } catch (error: any) {
    // CRITICAL FIX: Sèlman retire mesaj temp yo, pa tout mesaj yo
    setMessages(prev => prev.filter(m => 
      m.id !== userMessageId && 
      !m.id.startsWith('temp-ai-')
    ));
    
    if (error.message?.includes('violation') || error.message?.includes('suspended')) {
      await handleContentViolation('AI_RESPONSE_VIOLATION', 'high', error.message);
    }
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
      await supabase
        .from('conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
      
      if (currentConversation?.id === id) {
        setCurrentConversation(prev => prev ? { ...prev, title } : null);
      }
    } catch (err) {
      console.error('Error updating title:', err);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await supabase.from('conversations').delete().eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const searchConversations = (query: string): Conversation[] => {
    if (!query.trim()) return conversations;
    const lowerQuery = query.toLowerCase();
    return conversations.filter(c => 
      c.title.toLowerCase().includes(lowerQuery) || c.id.toLowerCase().includes(lowerQuery)
    );
  };

  const updateMessage = async (messageId: string, newContent: string) => {
    if (!currentConversation || !user) return;
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent, edited: true, edited_at: new Date().toISOString() }
          : msg
      ));

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation.id);
    } catch (err) {
      console.error('Error updating message:', err);
    }
  };

  const updateMessageAndRegenerate = async (messageId: string, newContent: string, aiModel?: string) => {
    if (!currentConversation || !user) return;
    const editedMessageIndex = messages.findIndex(m => m.id === messageId);
    if (editedMessageIndex === -1) return;

    try {
      await supabase
        .from('messages')
        .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
        .eq('id', messageId);

      if (editedMessageIndex + 1 < messages.length && messages[editedMessageIndex + 1].role === 'assistant') {
        const aiMessageToDelete = messages[editedMessageIndex + 1];
        await supabase.from('messages').delete().eq('id', aiMessageToDelete.id);
      }

      await selectConversation(currentConversation.id);

      const contextMessages = messages
        .slice(0, editedMessageIndex + 1)
        .map(m => ({
          role: m.role,
          content: m.image_url 
            ? [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: m.image_url } }]
            : m.content,
        }));

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
        body: {
          messages: contextMessages,
          conversationId: currentConversation.id,
          aiModel: aiModel || 'gemini',
        },
      });

      if (aiError) throw aiError;
      await selectConversation(currentConversation.id);
    } catch (err) {
      console.error('Error in update and regenerate:', err);
    }
  };

  const refreshConversations = async () => {
    await loadConversations();
  };

  const exportConversation = async (id: string, format: 'json' | 'txt' | 'md'): Promise<string> => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) throw new Error('Conversation not found');

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (!msgs) throw new Error('No messages found');

    switch (format) {
      case 'json':
        return JSON.stringify({ conversation: conv, messages: msgs }, null, 2);
      case 'md':
        return `# ${conv.title}\n\n${msgs.map(m => 
          `**${m.role === 'user' ? 'You' : 'AI'}** (${new Date(m.created_at).toLocaleString()}):\n${m.content}\n`
        ).join('\n')}`;
      case 'txt':
      default:
        return `${conv.title}\n\n${msgs.map(m => 
          `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
        ).join('\n')}`;
    }
  };

  const duplicateConversation = async (id: string): Promise<string | null> => {
    const original = conversations.find(c => c.id === id);
    if (!original) return null;

    try {
      const newId = await createConversation();
      if (!newId) return null;

      await updateConversationTitle(newId, `${original.title} (Copy)`);
      
      const { data: originalMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id);

      if (originalMessages && originalMessages.length > 0) {
        const newMessages = originalMessages.map(m => ({
          ...m,
          id: undefined,
          conversation_id: newId,
          created_at: new Date().toISOString(),
        }));
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
      await supabase
        .from('conversations')
        .update({ is_archived: true, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      
      setConversations(prev => prev.filter(c => c.id !== id));
      
      if (currentConversation?.id === id) clearCurrentConversation();
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  };

  return (
    <ConversationContext.Provider value={{
      conversations,
      currentConversation,
      messages,
      loading,
      streamingMessageId, // NEW: Exposed to consumers
      accountStatus,
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
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = React.useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}

