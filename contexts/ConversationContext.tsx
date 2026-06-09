import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  createdAt: string;
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
  sendMessage: (content: string, imageUrl?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
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
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        imageUrl: m.image_url,
        createdAt: m.created_at,
      })));
    }
    setLoading(false);
  };

  const sendMessage = async (content: string, imageUrl?: string) => {
    if (!currentConversation || !user) return;

    // Add user message
    const { data: userMsg, error: userError } = await supabase
      .from('messages')
      .insert([{
        conversation_id: currentConversation.id,
        role: 'user',
        content,
        image_url: imageUrl,
      }])
      .select()
      .single();

    if (userError || !userMsg) return;

    const newUserMessage: Message = {
      id: userMsg.id,
      role: 'user',
      content: userMsg.content,
      imageUrl: userMsg.image_url,
      createdAt: userMsg.created_at,
    };

    setMessages(prev => [...prev, newUserMessage]);

    // Build context messages for AI
    const contextMessages = [...messages, newUserMessage].map(m => ({
      role: m.role,
      content: m.imageUrl 
        ? [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.imageUrl } }
          ]
        : m.content,
    }));

    // Call AI
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
      body: { messages: contextMessages, conversationId: currentConversation.id },
    });

    if (aiError) {
      console.error('AI error:', aiError);
      return;
    }

    // Add assistant message
    const assistantContent = aiResponse?.message || 'Sorry, I could not generate a response.';
    const { data: assistantMsg, error: assistantError } = await supabase
      .from('messages')
      .insert([{
        conversation_id: currentConversation.id,
        role: 'assistant',
        content: assistantContent,
      }])
      .select()
      .single();

    if (assistantError || !assistantMsg) return;

    setMessages(prev => [...prev, {
      id: assistantMsg.id,
      role: 'assistant',
      content: assistantMsg.content,
      createdAt: assistantMsg.created_at,
    }]);

    // Update conversation title if first message
    if (messages.length === 0) {
      const title = content.slice(0, 50);
      await supabase
        .from('conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', currentConversation.id);
      
      setConversations(prev => prev.map(c => 
        c.id === currentConversation.id ? { ...c, title } : c
      ));
      setCurrentConversation(prev => prev ? { ...prev, title } : null);
    } else {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation.id);
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
      searchConversations,
      refreshConversations,
    }}>
      {children}
    </ConversationContext.Provider>
  );
}
