import { de as commonDe, en as commonEn } from './messages/common.js';
import { de as onlineDe, en as onlineEn } from './messages/online.js';
import { de as gameDe, en as gameEn } from './messages/game.js';
import { de as rulesDe, en as rulesEn } from './messages/rules.js';
import { de as cardsDe, en as cardsEn } from './messages/cardsImprovements.js';
import { de as flowDe, en as flowEn } from './messages/flowImprovements.js';
import { de as presentationDe, en as presentationEn } from './messages/presentationImprovements.js';
import { de as tableDe, en as tableEn } from './messages/tableImprovements.js';

// Only presentation text lives here. Never translate room, suit, phase or card IDs.
// A future language can be added as a new complete flat-key message pack.
export const catalogs = {
  de: { ...commonDe, ...onlineDe, ...gameDe, ...rulesDe, ...cardsDe, ...flowDe, ...presentationDe, ...tableDe },
  en: { ...commonEn, ...onlineEn, ...gameEn, ...rulesEn, ...cardsEn, ...flowEn, ...presentationEn, ...tableEn },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'en', label: 'English', locale: 'en-US' },
];
