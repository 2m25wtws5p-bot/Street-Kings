import React, { useEffect, useState } from "react";
import { chatBubbleRemaining, latestChatMessage, isChatSound } from "../game/chat";
import { useI18n } from "../i18n/I18nProvider";
import { Volume2 } from "lucide-react";

export function ChatBubble({ messages, seat }) {
  const { t } = useI18n();
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
  const text = isChatSound(message.sound) ? t(`chat.sound.${message.sound}`) : message.text;
  return <span className="chat-bubble" data-testid={`chat-bubble-${seat}`} data-message-id={message.id} title={`${message.name}: ${text}`}>
    {isChatSound(message.sound) && <Volume2 size={13} aria-hidden="true" />} {text}
  </span>;
}
