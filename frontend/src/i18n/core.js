import { catalogs, SUPPORTED_LANGUAGES } from './catalogs.js';

export { catalogs, SUPPORTED_LANGUAGES };
export const DEFAULT_LANGUAGE = 'de';
export const LANGUAGE_STORAGE_KEY = 'street_kings_language';

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.some(item => item.code === value) && Object.hasOwn(catalogs, value) ? value : DEFAULT_LANGUAGE;
}

export function getLocale(language) {
  return SUPPORTED_LANGUAGES.find(item => item.code === normalizeLanguage(language)).locale;
}

export function readLanguage(storage) {
  try { return normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY)); } catch { return DEFAULT_LANGUAGE; }
}

export function saveLanguage(storage, value) {
  const language = normalizeLanguage(value);
  try { storage?.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* In-memory preference still works. */ }
  return language;
}

export function translate(language, key, params = {}) {
  const selected = normalizeLanguage(language);
  const pack = catalogs[selected];
  const defaults = catalogs[DEFAULT_LANGUAGE];
  const values = params && typeof params === 'object' ? params : {};
  let message = Object.hasOwn(pack, key) ? pack[key] : Object.hasOwn(defaults, key) ? defaults[key] : undefined;
  if (message && typeof message === 'object') {
    const category = new Intl.PluralRules(getLocale(selected)).select(Number(values.count));
    message = Object.hasOwn(message, category) ? message[category] : Object.hasOwn(message, 'other') ? message.other : undefined;
  }
  if (typeof message !== 'string') return key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat(getLocale(selected)).format(value);
    return typeof value === 'string' ? value : placeholder;
  });
}

export function createTranslator(language = DEFAULT_LANGUAGE) {
  return (key, params) => translate(language, key, params);
}
