import React from "react";
import { useI18n } from "../i18n/I18nProvider";
import { THEMES, normalizeTheme } from "./themeConfig";
import { ThemeSelectorIcon } from "./ThemeSelectorIcon";
import "./ThemeSelector.css";

export function ThemeSelector({ theme, onChange, disabled = false, shared = false, testId = "theme-selector" }) {
  const { t } = useI18n();
  const selected = normalizeTheme(theme);
  const readOnly = disabled || typeof onChange !== "function";
  return <section className="theme-selector" data-testid={testId} aria-label={t("theme.heading")}>
    <div className="theme-selector-heading"><span>{t("theme.heading")}</span><span className="theme-selector-scope">{t(shared ? "theme.forEveryone" : "theme.rulesUnchanged")}</span></div>
    <div className="theme-selector-options" role="group" aria-label={t("theme.heading")}>
      {THEMES.map(option => <button type="button" key={option.id}
        data-testid={`${testId}-${option.id}`} className="theme-selector-option" data-selected={selected === option.id ? "true" : "false"}
        aria-pressed={selected === option.id} disabled={readOnly}
        onClick={() => { if (!readOnly && option.id !== selected) onChange(option.id); }}>
        <ThemeSelectorIcon theme={option.id} />
        <span className="theme-selector-copy"><strong>{t(option.nameKey)}</strong><small>{t(option.descriptionKey)}</small></span>
        <span className="theme-selector-check" aria-hidden="true">{selected === option.id ? "✓" : ""}</span>
      </button>)}
    </div>
    {shared && <p className="theme-selector-note">{t(readOnly ? "theme.hostChooses" : "theme.hostHint")}</p>}
  </section>;
}
