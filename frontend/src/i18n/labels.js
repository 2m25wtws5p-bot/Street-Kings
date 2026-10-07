import { SUITS, SPECIALS, AVATARS } from '../game/constants.js';
import { createTranslator } from './core.js';

const shortKeys = { fire: 'heatShort', water: 'informantShort', earth: 'briberShort', air: 'fixerShort', pygmy: 'godmotherShort', wizard: 'runnerShort' };

export function getGameLabels(language) {
  const t = createTranslator(language);
  return {
    suits: Object.fromEntries(Object.entries(SUITS).map(([key, suit]) => [key, { ...suit, people: t(`suits.${key}.people`), realm: t(`suits.${key}.realm`) }])),
    specials: Object.fromEntries(Object.entries(SPECIALS).map(([key, special]) => [key, { ...special, label: t(`cards.${key}.label`), short: t(`cards.${shortKeys[key]}`), desc: t(`cards.${key}.desc`) }])),
    avatars: AVATARS.map(avatar => ({ ...avatar, label: ['boss', 'dealer', 'driver', 'smuggler', 'hacker', 'lawyer'].includes(avatar.key) ? t(`avatars.${avatar.key}`) : avatar.label })),
  };
}
