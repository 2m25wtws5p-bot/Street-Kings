// Every device gets balanced rows of at most ten cards, including 10 + 10
// for the twenty-card deal. Rows spread as cards leave the hand.
export function handRowCounts(count) {
  if (!Number.isInteger(count) || count <= 0) return [];
  const rowCount = Math.ceil(count / 10);
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  return Array.from({ length: rowCount }, (_, row) => base + (row < extra ? 1 : 0));
}

export function handRowGeometry({ count, width, cardWidth, columnGap = 8 }) {
  if (!Number.isInteger(count) || count < 1 || ![width, cardWidth, columnGap].every(Number.isFinite) || width <= 0 || cardWidth <= 0 || columnGap < 0) return { width: 0, step: 0 };
  const step = count === 1 ? 0 : Math.min(cardWidth + columnGap, Math.max(0, (width - cardWidth) / (count - 1)));
  return { width: cardWidth + Math.max(0, count - 1) * step, step };
}

// Reserve the original deal, never the current number of cards. A player's
// next turn and the collect prompt retain exactly the same hand footprint.
export function reservedHandHeight({ initialCount, width, cardWidth, rowGap, columnGap, columns }) {
  if (![initialCount, width, cardWidth, rowGap, columnGap].every(Number.isFinite) || !Number.isInteger(initialCount) || initialCount < 1 || cardWidth <= 0 || width <= 0 || rowGap < 0 || columnGap < 0 || (columns != null && (!Number.isInteger(columns) || columns < 0))) return 0;
  const rows = handRowCounts(initialCount).length;
  return rows * cardWidth * 29 / 20 + Math.max(0, rows - 1) * rowGap;
}
