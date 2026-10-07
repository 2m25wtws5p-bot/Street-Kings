# Personal interface languages

German (`de`) is the explicit default. Browser language is not automatically used.
The home screen and online entry screen offer a language selector. A preference
is stored as `street_kings_language` on that browser/device; blocked storage still
allows an in-memory selection. Each local human player can choose a language in
setup; hot-seat views follow the human holding the device.

Online language is a viewer preference, **not room state**. A German host and an
English guest play the same cards, turns and scores in the same room. Changing the
interface language does not reconnect, replay an action or clear card selection.
Player names, room codes and player-written chat are deliberately not translated.

## Adding another language

1. Add a complete flat-key message pack, for example `messages/fr.js`, covering
   all keys in `catalogs.de`. Existing packs are grouped by common/card labels,
   gameplay, online/chat/errors and rules/scores/dossier.
2. Import and register the pack as `fr` in `catalogs.js`.
3. Add `{ code: 'fr', label: 'Français', locale: 'fr-FR' }` to
   `SUPPORTED_LANGUAGES`. The selectors read this registry automatically. Native
   language names are used so people can find their language in any interface.
4. Preserve interpolation names, such as `{name}`, `{count}` and `{round}`.
   Count-sensitive messages use plural objects (`one`, `other`); add the relevant
   Intl plural categories for a language that needs more forms, and extend the
   catalog-parity test accordingly. The translator selects categories with
   `Intl.PluralRules` and formats numeric parameters with the viewer locale.
5. Run `node --test frontend/tests/*.test.mjs` and a production build. Check long
   text on small screens and a mixed-language online room before publication.

Use `useI18n()` for UI text, numbers and dates. Pure helpers can use
`createTranslator(language)`. `getGameLabels` provides copied, localized card,
suit and portrait-role labels. Missing messages fall back to German, while the
catalog tests require complete packs for a release.

Never translate mechanical suit/special/card IDs, phase names, player IDs or room
API fields. Keep text outside the game engine; derive localized score explanations
from numeric values and flags, not server-generated German display strings.
