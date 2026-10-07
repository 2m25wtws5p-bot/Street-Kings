import { useMemo } from 'react';
import { useI18n } from './I18nProvider';
import { getGameLabels } from './labels';
export { getGameLabels } from './labels';

export function useGameLabels() {
  const { language } = useI18n();
  return useMemo(() => getGameLabels(language), [language]);
}
