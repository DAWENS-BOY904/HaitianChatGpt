import { useContext } from 'react';
import { ConversationContext } from '../contexts/ConversationContext';

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
}
