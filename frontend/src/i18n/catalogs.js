import { de as commonDe, en as commonEn } from './messages/common.js';
import { de as onlineDe, en as onlineEn } from './messages/online.js';
import { de as gameDe, en as gameEn } from './messages/game.js';
import { de as rulesDe, en as rulesEn } from './messages/rules.js';

// Only presentation text lives here. Never translate room, suit, phase or card IDs.
// A future language can be added as a new complete flat-key message pack.
export const catalogs = {
  de: { ...commonDe, ...onlineDe, ...gameDe, ...rulesDe },
  en: { ...commonEn, ...onlineEn, ...gameEn, ...rulesEn },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'en', label: 'English', locale: 'en-US' },
];
