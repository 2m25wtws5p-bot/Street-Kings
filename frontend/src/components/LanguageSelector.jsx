import React from 'react';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../i18n/core';
import { useI18n } from '../i18n/I18nProvider';

export function LanguageSelector({ value, onChange, compact = false, label, testId = 'language-select' }) {
  const { language, setLanguage, t } = useI18n();
  return <label className={`language-selector${compact ? ' language-selector-compact' : ''}`}>
    <Languages size={16} aria-hidden="true" />
    {!compact && <span>{label || t('common.personalLanguage')}</span>}
    <select value={value ?? language} onChange={event => (onChange || setLanguage)(event.target.value)} aria-label={label || t('common.personalLanguage')} data-testid={testId}>
      {SUPPORTED_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
    </select>
  </label>;
}
