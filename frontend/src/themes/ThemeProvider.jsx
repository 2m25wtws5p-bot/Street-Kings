import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { DEFAULT_THEME, normalizeTheme } from "./themeConfig";
import "./ThemeLayout.css";

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: null });
const mountedThemes = new Map();
let originalThemeAttribute = null;

// Dialog portals live outside the provider's DOM wrapper. A temporary root
// attribute gives them the same appearance, without persisting another room's theme.
function updateRootTheme() {
  if (typeof document === "undefined") return;
  // Child effects run before their parent's effects. Prefer the innermost
  // actual scope, not whichever effect happened to register last.
  let active = null;
  let activeDepth = -1;
  for (const value of mountedThemes.values()) {
    let depth = 0;
    let parent = value.element?.parentElement;
    while (parent) { if (parent.classList.contains("theme-surface")) depth++; parent = parent.parentElement; }
    if (depth >= activeDepth) { active = value; activeDepth = depth; }
  }
  if (active) document.documentElement.dataset.gameTheme = active.theme;
  else if (originalThemeAttribute == null) delete document.documentElement.dataset.gameTheme;
  else document.documentElement.dataset.gameTheme = originalThemeAttribute;
}

export function ThemeProvider({ theme = DEFAULT_THEME, onThemeChange, children }) {
  const selected = normalizeTheme(theme);
  const owner = useRef(Symbol("theme-scope"));
  const surface = useRef(null);
  useLayoutEffect(() => {
    if (mountedThemes.size === 0) originalThemeAttribute = document.documentElement.getAttribute("data-game-theme");
    const key = owner.current;
    mountedThemes.set(key, { theme: selected, element: surface.current });
    updateRootTheme();
    return () => { mountedThemes.delete(key); updateRootTheme(); };
  }, [selected]);
  const value = useMemo(() => ({
    theme: selected,
    setTheme: typeof onThemeChange === "function" ? next => onThemeChange(normalizeTheme(next)) : null,
  }), [selected, onThemeChange]);
  return <ThemeContext.Provider value={value}>
    <div ref={surface} className="theme-surface" data-theme={selected} style={{ display: "contents" }}>{children}</div>
  </ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
