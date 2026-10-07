// Reserve the round's original rows, not just the cards left in this turn.
// The next player/collect prompt must never pull the hand to another position.
export function reservedHandHeight({ initialCount, width, cardWidth, rowGap, columnGap, columns }) {
  if (![initialCount, width, cardWidth, rowGap, columnGap].every(Number.isFinite) || !Number.isInteger(initialCount) || initialCount < 1 || cardWidth <= 0 || width <= 0 || rowGap < 0 || columnGap < 0 || (columns != null && (!Number.isInteger(columns) || columns < 0))) return 0;
  const perRow = columns || Math.max(1, Math.floor((width + columnGap) / (cardWidth + columnGap)));
  const rows = Math.ceil(initialCount / perRow);
  return rows * cardWidth * 29 / 20 + Math.max(0, rows - 1) * rowGap;
}
