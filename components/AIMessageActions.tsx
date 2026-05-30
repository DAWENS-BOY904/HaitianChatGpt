/**
 * AIMessageActions — deprecated stub.
 * AI message long-press now uses the TextSelectionOverlay inside MessageItem directly.
 * This file is kept to avoid broken imports; the component renders nothing.
 */
import React, { memo } from 'react';

interface AIMessageActionsProps {
  visible?: boolean;
  onClose?: () => void;
  message?: any;
  isUserMessage?: boolean;
  onAskAI?: (text: string) => void;
  onEdit?: (msgId: string, content: string) => void;
}

export const AIMessageActions = memo(function AIMessageActions(_props: AIMessageActionsProps) {
  return null;
});
