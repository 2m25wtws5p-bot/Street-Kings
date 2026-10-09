export const HAND_PREFERENCE_KEY = "street-kings.hand-preferences.v1";
export const HAND_SORT_MODES = ["suit", "value", "chaos"];
const SUIT_ORDER = { RED: 0, YELLOW: 1, BLUE: 2, GREEN: 3 };

export function readHandPreferences(storage) {
  try {
    const value = JSON.parse(storage?.getItem(HAND_PREFERENCE_KEY) || "null");
    return { mode: HAND_SORT_MODES.includes(value?.mode) ? value.mode : "suit", seed: Number.isSafeInteger(value?.seed) ? value.seed : 1729 };
  } catch { return { mode: "suit", seed: 1729 }; }
}

export function saveHandPreferences(storage, preference) {
  const value = { mode: HAND_SORT_MODES.includes(preference.mode) ? preference.mode : "suit", seed: Number.isSafeInteger(preference.seed) ? preference.seed : 1729 };
  try { storage?.setItem(HAND_PREFERENCE_KEY, JSON.stringify(value)); } catch { /* Private browsing can refuse storage. */ }
  return value;
}

function chaosRank(id, seed) {
  let hash = seed >>> 0;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  // Final mixing keeps sequential card IDs from forming visible suit groups.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function sortHand(cards, { mode = "suit", seed = 1729 } = {}) {
  const suit = card => SUIT_ORDER[card.suit] ?? 4;
  const value = card => Number.isFinite(card.value) ? card.value : 0;
  // Copy only: sorting is a viewer preference, never an engine/room mutation.
  return [...cards].sort((a, b) => {
    if (mode === "chaos") return chaosRank(a.id, seed) - chaosRank(b.id, seed) || String(a.id).localeCompare(String(b.id));
    if (mode === "value") return value(a) - value(b) || suit(a) - suit(b);
    return suit(a) - suit(b) || value(a) - value(b);
  });
}

export function pointInsideDropZone(point, rectangle) {
  return Boolean(rectangle && rectangle.width > 0 && rectangle.height > 0 && Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom);
}

export function canDropHandCard({ canDrag, legalIds, cardId, interactionKey, startedKey, point, rectangle }) {
  return Boolean(canDrag && interactionKey === startedKey && legalIds.has(cardId) && pointInsideDropZone(point, rectangle));
}
