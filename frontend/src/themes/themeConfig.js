// Theme IDs are presentation-only and remain language-neutral in shared rooms.
export const DEFAULT_THEME = "street";
export const THEMES = Object.freeze([
  Object.freeze({ id: "street", nameKey: "theme.street.name", descriptionKey: "theme.street.description", symbol: "♛" }),
  Object.freeze({ id: "animal", nameKey: "theme.animal.name", descriptionKey: "theme.animal.description", symbol: "♜" }),
  Object.freeze({ id: "space", nameKey: "theme.space.name", descriptionKey: "theme.space.description", symbol: "✦" }),
]);

export function isTheme(value) { return THEMES.some(theme => theme.id === value); }
export function normalizeTheme(value) { return isTheme(value) ? value : DEFAULT_THEME; }
