import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';
import { FunctionsHttpError } from '@supabase/supabase-js';

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
  updateMessage: (messageId: string, newContent: string) => Promise<void>;
  updateMessageAndRegenerate: (messageId: string, newContent: string, aiModel?: string) => Promise<void>;
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

    // Only load conversations that have at least one message
    const { data: conversationsWithMessages, error } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        messages (count)
      `)
      .order('updated_at', { ascending: false });

    if (!error && conversationsWithMessages) {
      // Filter out conversations with 0 messages
      const validConversations = conversationsWithMessages
        .filter((c: any) => c.messages && c.messages.length > 0)
        .map(c => ({
          id: c.id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
      
      setConversations(validConversations);
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

    // DO NOT add to conversations list yet - will be added when first message is sent
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

    console.log('📨 ConversationContext.sendMessage called');
    console.log('  - Content:', content.slice(0, 50));
    console.log('  - AI Model:', aiModel);
    console.log('  - Current messages count:', messages.length);

    // CRITICAL: Add user message to local state IMMEDIATELY (optimistic UI)
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => {
      console.log('  ✅ Adding user message to UI immediately');
      return [...prev, tempUserMessage];
    });

    // Build context messages for AI (include the new user message)
    const contextMessages = [...messages, tempUserMessage].map(m => ({
      role: m.role,
      content: m.content,
      image_url: m.image_url,
    }));

    console.log('  🤖 Calling AI Edge Function...');
    console.log('  📊 Context messages count:', contextMessages.length);

    // Call AI Edge Function
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
      body: {
        messages: contextMessages,
        conversationId: currentConversation.id,
        aiModel: aiModel || 'google-gemini',
      },
    });

    if (aiError) {
      console.error('❌ AI error:', aiError);
      
      // Extract detailed error message
      let errorMessage = 'Failed to send message';
      if (aiError instanceof FunctionsHttpError) {
        try {
          const statusCode = aiError.context?.status ?? 500;
          const textContent = await aiError.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || aiError.message || 'Unknown error'}`;
          console.error('📋 Detailed error:', errorMessage);
        } catch (e) {
          errorMessage = aiError.message || 'Failed to read error response';
          console.error('📋 Error message:', errorMessage);
        }
      } else {
        errorMessage = aiError.message || 'Unknown error occurred';
        console.error('📋 Error message:', errorMessage);
      }
      
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      
      // Throw with detailed message
      throw new Error(errorMessage);
    }

    console.log('  ✅ AI response received');
    console.log('  📝 AI message:', aiResponse.message?.slice(0, 50));
    console.log('  💭 Thinking mode:', aiResponse.thinkingMode);

    // Add AI response to local state immediately
    const tempAIMessage: Message = {
      id: `temp-ai-${Date.now()}`,
      role: 'assistant',
      content: aiResponse.message || 'Response generated',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => {
      // Replace temp user message with real one, add AI message
      const withoutTemp = prev.filter(m => m.id !== tempUserMessage.id);
      return [...withoutTemp, tempUserMessage, tempAIMessage];
    });

    // Update conversation title if first message - generate smart title
    if (messages.length === 0) {
      // Generate a smart title based on content type
      let title = content.slice(0, 50);
      if (aiResponse.imageUrl) {
        title = content.includes('logo') ? '🎨 Logo Design' : '🖼️ Image Generation';
      } else if (aiResponse.fileName) {
        title = `📄 File: ${aiResponse.fileName}`;
      } else if (content.length > 50) {
        title = content.slice(0, 47) + '...';
      }
      console.log('  📝 Setting conversation title:', title);
      await updateConversationTitle(currentConversation.id, title);
      
      // Add to conversations list on first message
      const newConv: Conversation = {
        id: currentConversation.id,
        title: title,
        createdAt: currentConversation.createdAt,
        updatedAt: new Date().toISOString(),
      };
      setConversations(prev => {
        console.log('  ✅ Adding conversation to history');
        return [newConv, ...prev];
      });
    } else {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversation.id);
      
      // Update in conversations list (move to top)
      setConversations(prev => {
        const updated = prev.map(c => 
          c.id === currentConversation.id 
            ? { ...c, updatedAt: new Date().toISOString() } 
            : c
        );
        // Move current to top
        const current = updated.find(c => c.id === currentConversation.id);
        const others = updated.filter(c => c.id !== currentConversation.id);
        return current ? [current, ...others] : updated;
      });
    }

    // Finally, reload from database to get real IDs
    console.log('  🔄 Reloading messages from database...');
    await selectConversation(currentConversation.id);
    console.log('  ✅ Message flow complete');
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

  const updateMessage = async (messageId: string, newContent: string) => {
    if (!currentConversation || !user) return;

    // Update in database
    const { error } = await supabase
      .from('messages')
      .update({ 
        content: newContent, 
        edited: true, 
        edited_at: new Date().toISOString() 
      })
      .eq('id', messageId);

    if (error) {
      console.error('Update message error:', error);
      return;
    }

    // Update in local state - keep message in same position
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            content: newContent, 
            edited: true, 
            edited_at: new Date().toISOString() 
          }
        : msg
    ));

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConversation.id);
  };

  const updateMessageAndRegenerate = async (messageId: string, newContent: string, aiModel?: string) => {
    if (!currentConversation || !user) return;

    // Find the index of the edited message
    const editedMessageIndex = messages.findIndex(m => m.id === messageId);
    if (editedMessageIndex === -1) return;

    // Update the user message in database
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        content: newContent, 
        edited: true, 
        edited_at: new Date().toISOString() 
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Update message error:', updateError);
      return;
    }

    // Update local state immediately
    const updatedMessages = messages.map((msg, idx) => 
      idx === editedMessageIndex
        ? { 
            ...msg, 
            content: newContent, 
            edited: true, 
            edited_at: new Date().toISOString() 
          }
        : msg
    );

    // Find and delete the AI response that came after this message (if any)
    if (editedMessageIndex + 1 < messages.length && messages[editedMessageIndex + 1].role === 'assistant') {
      const aiMessageToDelete = messages[editedMessageIndex + 1];
      
      // Delete from database
      await supabase
        .from('messages')
        .delete()
        .eq('id', aiMessageToDelete.id);
      
      // Remove from local state
      updatedMessages.splice(editedMessageIndex + 1, 1);
    }

    // Set updated messages (without old AI response)
    setMessages(updatedMessages);

    // Build context up to the edited message for AI
    const contextMessages = updatedMessages.slice(0, editedMessageIndex + 1).map(m => ({
      role: m.role,
      content: m.image_url 
        ? [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.image_url } }
          ]
        : m.content,
    }));

    // Call AI to generate new response
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
      body: {
        messages: contextMessages,
        conversationId: currentConversation.id,
        aiModel: aiModel || 'gemini',
      },
    });

    if (aiError) {
      console.error('AI regeneration error:', aiError);
      
      // Extract detailed error for regeneration
      if (aiError instanceof FunctionsHttpError) {
        try {
          const textContent = await aiError.context?.text();
          console.error('📋 Regeneration error details:', textContent);
        } catch (e) {
          console.error('📋 Could not read error details');
        }
      }
      return;
    }

    // Reload all messages to get the new AI response
    await selectConversation(currentConversation.id);

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConversation.id);
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
      updateMessage,
      updateMessageAndRegenerate,
      deleteConversation,
      updateConversationTitle,
      searchConversations,
      refreshConversations,
    }}>
      {children}
    </ConversationContext.Provider>
  );
}
