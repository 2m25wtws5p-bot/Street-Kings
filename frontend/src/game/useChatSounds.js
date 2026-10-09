import { useEffect, useRef } from "react";
import { isChatSound } from "./chat";
import { sfx } from "./sound";

export function freshChatSounds(messages, seen, now = Date.now()) {
  const fresh = [];
  for (const message of messages || []) {
    if (!message?.id || seen.has(message.id)) continue;
    seen.add(message.id);
    if (isChatSound(message.sound) && Number.isFinite(message.createdAt) && now - message.createdAt >= 0 && now - message.createdAt < 7000) fresh.push(message);
  }
  while (seen.size > 100) seen.delete(seen.values().next().value);
  return fresh;
}

export function useChatSounds(view, identity) {
  const state = useRef(null);
  useEffect(() => {
    if (!view) return;
    if (!state.current || state.current.identity !== identity) {
      // Joining/reconnecting to an existing transcript must not replay it.
      state.current = { identity, seen: new Set((view.chatMessages || []).map(message => message.id)), at: 0 };
      return;
    }
    const now = Date.now();
    const sounds = freshChatSounds(view.chatMessages, state.current.seen, now);
    if (!sounds.length || (typeof document !== "undefined" && document.hidden) || now - state.current.at < 1000) return;
    state.current.at = now;
    // Limit simultaneous remote sounds; every message remains replayable in chat.
    sfx.chatSound(sounds[sounds.length - 1].sound);
  }, [view, identity]);
}
