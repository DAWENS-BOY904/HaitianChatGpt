import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  createConversation: () => Promise<string | null>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, imageUrl?: string, aiModel?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  searchConversations: (query: string) => Conversation[];
  refreshConversations: () => Promise<void>;
}

export const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setConversations(data.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })));
    }
  };

  const createConversation = async (): Promise<string | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert([{ user_id: user.id, title: 'New Chat' }])
      .select()
      .single();

    if (error || !data) return null;

    const newConv: Conversation = {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    setConversations([newConv, ...conversations]);
    setCurrentConversation(newConv);
    setMessages([]);
    return data.id;
  };

  const selectConversation = async (id: string) => {
    setLoading(true);
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversation(conv);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const sendMessage = async (content: string, imageUrl?: string, aiModel?: string) => {
    if (!currentConversation || !user) return;

    // Add user message to state immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    // Build context messages for AI
    const contextMessages = [...messages, tempUserMessage].map(m => ({
      role: m.role,
      content: m.image_url 
        ? [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.image_url } }
          ]
        : m.content,
    }));

    // Call AI Edge Function
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
      body: {
        messages: contextMessages,
        conversationId: currentConversation.id,
        aiModel: aiModel || 'gemini',
      },
    });

    if (aiError) {
      console.error('AI error:', aiError);
      return;
    }

    // The Edge Function already saved messages to the database, so reload them
    await selectConversation(currentConversation.id);

    // Update conversation title if first message
    if (messages.length === 0) {
      const title = content.slice(0, 50);
      await updateConversationTitle(currentConversation.id, title);
    } else {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation.id);
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, title } : c
    ));
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, title } : null);
    }
  };

  const deleteConversation = async (id: string) => {
    await supabase.from('conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const searchConversations = (query: string): Conversation[] => {
    if (!query.trim()) return conversations;
    return conversations.filter(c => 
      c.title.toLowerCase().includes(query.toLowerCase())
    );
  };

  const refreshConversations = async () => {
    await loadConversations();
  };

  return (
    <ConversationContext.Provider value={{
      conversations,
      currentConversation,
      messages,
      loading,
      createConversation,
      selectConversation,
      sendMessage,
      deleteConversation,
      updateConversationTitle,
      searchConversations,
      refreshConversations,
    }}>
      {children}
    </ConversationContext.Provider>
  );
}
