export const CHAT_LIMIT = 140;
export const CHAT_COOLDOWN_MS = 1500;
export const CHAT_BUBBLE_MS = 7000;
export const CHAT_EMOJIS = ["😎", "😂", "🔥", "👏", "😮", "😈", "❤️", "👍"];

// Match the server's Unicode character count, including emoji outside the BMP.
export const chatLength = (value) => Array.from(value || "").length;
export const limitChatText = (value) => Array.from((value || "").replace(/\r\n|[\r\n\t\u2028\u2029]/g, " ")).slice(0, CHAT_LIMIT).join("");

export function latestChatMessage(messages, seat) {
  let latest = null;
  for (const message of messages || []) {
    if (message.seat === seat && (!latest || message.createdAt >= latest.createdAt)) latest = message;
  }
  return latest;
}

export function chatBubbleRemaining(message, now = Date.now()) {
  if (!message || !Number.isFinite(message.createdAt)) return 0;
  // A clock ahead of the browser may extend a bubble by at most its normal life.
  return Math.max(0, Math.min(CHAT_BUBBLE_MS, message.createdAt + CHAT_BUBBLE_MS - now));
}

export function hostSeat(view) {
  if (Number.isInteger(view.hostSeat)) return view.hostSeat;
  return view.isHost && view.yourSeat != null ? view.yourSeat : 0;
}
