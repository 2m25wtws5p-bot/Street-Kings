import React, { useEffect, useState } from "react";
import { chatBubbleRemaining, latestChatMessage } from "../game/chat";

export function ChatBubble({ messages, seat }) {
  const message = latestChatMessage(messages, seat);
  const messageId = message?.id;
  const createdAt = message?.createdAt;
  const [visibleId, setVisibleId] = useState(null);
  useEffect(() => {
    const remaining = chatBubbleRemaining({ createdAt });
    if (!remaining) { setVisibleId(null); return; }
    setVisibleId(messageId);
    const timer = setTimeout(() => setVisibleId(null), remaining);
    return () => clearTimeout(timer);
  }, [messageId, createdAt]);
  if (!message || visibleId !== message.id) return null;
  return <span className="chat-bubble" data-testid={`chat-bubble-${seat}`} data-message-id={message.id} title={`${message.name}: ${message.text}`}>
    {message.text}
  </span>;
}
