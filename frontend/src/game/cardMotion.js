const origins = new Map();

// Geometry is presentation-only and expires quickly. Never store card objects,
// tokens or another player's private hand here.
export function rememberPlayedCard(cardId) {
  if (typeof document === "undefined") return;
  const element = document.querySelector(`[data-testid="hand-card-item-${cardId}"]`);
  if (!element) return;
  const rect = element.getBoundingClientRect();
  origins.set(cardId, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, at: Date.now() });
  for (const [key, value] of origins) if (Date.now() - value.at > 2000) origins.delete(key);
}

export function playedCardOrigin(cardId, seat) {
  const origin = origins.get(cardId);
  if (origin && Date.now() - origin.at < 2000) return origin;
  if (typeof document === "undefined") return null;
  const player = document.querySelector(`[data-testid="opponent-seat-player-${seat}"]`);
  if (!player) return null;
  const rect = player.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
