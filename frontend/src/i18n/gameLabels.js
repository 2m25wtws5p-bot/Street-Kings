import { useMemo } from 'react';
import { useI18n } from './I18nProvider';
import { getGameLabels } from './labels';
import { useTheme } from '../themes/ThemeProvider';
export { getGameLabels } from './labels';

export function useGameLabels() {
  const { language } = useI18n();
  const { theme } = useTheme();
  return useMemo(() => getGameLabels(language, theme), [language, theme]);
}
