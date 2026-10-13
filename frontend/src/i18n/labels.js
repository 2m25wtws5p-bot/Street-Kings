import { SUITS, SPECIALS, AVATARS } from '../game/constants.js';
import { createTranslator } from './core.js';
import { getThemeMessages, ANIMAL_AVATAR_NAMES, SPACE_AVATAR_NAMES } from '../themes/presentation.js';

const shortKeys = { kingpin: 'heatShort', informant: 'informantShort', briber: 'briberShort', fixer: 'fixerShort', godmother: 'godmotherShort', runner: 'runnerShort' };

export function getGameLabels(language, theme = 'street') {
  const t = createTranslator(language, getThemeMessages(theme, language));
  return {
    suits: Object.fromEntries(Object.entries(SUITS).map(([key, suit]) => [key, { ...suit, people: t(`suits.${key}.people`), realm: t(`suits.${key}.realm`) }])),
    specials: Object.fromEntries(Object.entries(SPECIALS).map(([key, special]) => [key, { ...special, label: t(`cards.${key}.label`), short: t(`cards.${shortKeys[key]}`), desc: t(`cards.${key}.desc`) }])),
    avatars: AVATARS.map((avatar, index) => ({ ...avatar, label: theme === 'animal' ? ANIMAL_AVATAR_NAMES[language === 'en' ? 'en' : 'de'][index]
      : theme === 'space' ? SPACE_AVATAR_NAMES[language === 'en' ? 'en' : 'de'][index]
      : ['boss', 'dealer', 'driver', 'smuggler', 'hacker', 'lawyer'].includes(avatar.key) ? t(`avatars.${avatar.key}`) : avatar.label })),
  };
}
