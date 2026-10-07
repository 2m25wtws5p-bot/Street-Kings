import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTranslator, DEFAULT_LANGUAGE, getLocale, normalizeLanguage, readLanguage, saveLanguage } from './core';

function browserStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

function languageValue(language, setLanguage) {
  const locale = getLocale(language);
  return {
    language, locale, setLanguage, t: createTranslator(language),
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    formatDate: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
  };
}

const I18nContext = createContext(languageValue(DEFAULT_LANGUAGE, () => {}));

export function I18nProvider({ children }) {
  const [language, updateLanguage] = useState(() => readLanguage(browserStorage()));
  const value = useMemo(() => languageValue(language, next => updateLanguage(saveLanguage(browserStorage(), next))), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Local hot-seat players can each use their own UI language on the same device.
// No locale enters online room state or changes shared game mechanics.
export function I18nScope({ language, children }) {
  const parent = useI18n();
  const selected = language == null ? parent.language : normalizeLanguage(language);
  const value = useMemo(() => languageValue(selected, parent.setLanguage), [selected, parent.setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
