import assert from "node:assert/strict";
import test from "node:test";
import { catalogs, createTranslator } from "../src/i18n/core.js";
import { de, en } from "../src/i18n/messages/spaceSmugglers.js";
import { getThemeMessages, SPACE_AVATAR_NAMES, SPACE_CARD_CELLS, ANIMAL_CARD_CELLS, atlasPosition } from "../src/themes/presentation.js";
import { getGameLabels } from "../src/i18n/labels.js";
import { AVATARS, SUITS, SPECIAL_MAP } from "../src/game/constants.js";

test("space templates cover every visible key and preserve parameters and plural branches", () => {
  for (const [language, pack] of Object.entries({ de, en })) {
    assert.deepEqual(Object.keys(pack).sort(), Object.keys(catalogs[language]).sort());
    for (const [key, original] of Object.entries(catalogs[language])) {
      assert.equal(typeof pack[key], typeof original, `${language}:${key}`);
      if (typeof original === "object") assert.deepEqual(Object.keys(pack[key]).sort(), Object.keys(original).sort(), key);
      const params = value => JSON.stringify(value).match(/\{\w+\}/g)?.sort() || [];
      assert.deepEqual(params(pack[key]), params(original), `${language}:${key}`);
    }
  }
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("space descriptions replace terrestrial theme language while preserving separate theme choices", () => {
  const oldWords = /hitze|\bheat\b|takeover|kingpin|informant|briber|fixer|godmother|\brunners?\b|laufjung|gangster|underworld|unterwelt|hinterzimmer|street|straße|police|polizei|schwarzmarkt|\bcash\b|\bgoods\b|\bware\b|akte|dossier|schmierer|patin|animal crews|garden|tierfreund/i;
  for (const [language, pack] of Object.entries({ de, en })) for (const [key, value] of Object.entries(pack)) {
    if (key.startsWith("theme.")) continue;
    assert.doesNotMatch(JSON.stringify(value).replace(/\{\w+\}/g, ""), oldWords, `${language}:${key}`);
  }
  assert.equal(de["theme.street.name"], catalogs.de["theme.street.name"]);
  assert.equal(en["theme.animal.name"], catalogs.en["theme.animal.name"]);
});

test("space translations never rewrite user-controlled names, chat or sound parameters", () => {
  const name = "Street Cash Hitze Kingpin Informant Garden";
  for (const language of ["de", "en"]) {
    const t = createTranslator(language, getThemeMessages("space", language));
    for (const key of ["game.playerTurn", "online.replaceConfirm", "cards.receivedFrom", "cards.from", "scores.summary.breakdown", "setup.playerLanguage"]) {
      assert.ok(t(key, { name }).includes(name), `${language}:${key}`);
    }
    for (const key of ["online.reviewNotice", "online.spectators"]) assert.ok(t(key, { names: name, count: 2 }).includes(name));
    assert.ok(t("chat.sendSound", { sound: name }).includes(name));
    for (const count of [1, 4]) {
      const result = t("game.choosePass", { name, target: name, count });
      assert.equal(result.split(name).length - 1, 2);
      assert.ok(result.includes(String(count)));
    }
    assert.equal(t("theme.brand"), "Space Smugglers");
    assert.ok(t("scores.step.takeoverOtherHeat", { heat: 25 }).includes("25"));
  }
  assert.equal(createTranslator("de", de)("over.title", { count: 1 }), "Der Sternenchampion");
  assert.equal(createTranslator("en", en)("over.title", { count: 2 }), "The Star Champions");
});

test("space labels preserve every gameplay identity, suit colour and numeric effect", () => {
  const expected = {
    de: { suits: ["Alarm", "Kontraband", "Credits", "Fracht"], roles: ["Admiral", "Peilsender", "Diplomat", "Schilddrohne", "Reaktorkern", "Kurierdrohne"] },
    en: { suits: ["Alert", "Contraband", "Credits", "Cargo"], roles: ["Admiral", "Tracker", "Diplomat", "Shield Drone", "Reactor Core", "Courier Drone"] },
  };
  for (const language of ["de", "en"]) {
    const normal = getGameLabels(language), space = getGameLabels(language, "space");
    assert.deepEqual(Object.keys(space.suits), Object.keys(SUITS));
    assert.deepEqual(Object.values(space.suits).map(suit => suit.people), expected[language].suits);
    assert.deepEqual(Object.values(space.specials).map(role => role.label), expected[language].roles);
    for (const [id, suit] of Object.entries(space.suits)) {
      assert.equal(suit.key, normal.suits[id].key);
      assert.equal(suit.primary, normal.suits[id].primary);
      assert.equal(suit.isHeat, normal.suits[id].isHeat);
    }
    for (const [id, role] of Object.entries(space.specials)) {
      assert.equal(role.key, normal.specials[id].key);
      assert.equal(role.tag, normal.specials[id].tag);
      if (id === "fixer") assert.match(role.short, /Ø/);
      else assert.deepEqual(role.short.match(/(?:x|[+−-])?\d+/g), normal.specials[id].short.match(/(?:x|[+−-])?\d+/g));
    }
    const t = createTranslator(language, getThemeMessages("space", language));
    assert.match(t("rules.scoring.text"), /1.*15.*\+5.*\+10.*5.*0/);
    assert.match(t("rules.special.kingpin"), /0.*15/);
    assert.match(t("rules.special.briber"), /5.*0/);
    assert.match(t("rules.special.runner"), /0/);
    assert.match(t("rules.takeover.text"), /14.*0/);
    assert.match(t("rules.takeover.exception"), /40.*0.*60.*25.*40.*15.*0.*60/);
    assert.match(t("rules.takeover.effects"), language === "de" ? /Schilddrohne und Diplomat können.*nicht senken/ : /Shield Drone and Diplomat cannot reduce/);
  }
  assert.deepEqual(SPECIAL_MAP, { kingpin: { suit: "RED", value: 11 }, informant: { suit: "GREEN", value: 11 }, briber: { suit: "YELLOW", value: 11 }, fixer: { suit: "BLUE", value: 11 }, godmother: { suit: "GREEN", value: 12 } });
});

test("space has eighteen distinct translated portraits with stable avatar and atlas indices", () => {
  for (const language of ["de", "en"]) {
    const labels = getGameLabels(language, "space");
    assert.deepEqual(labels.avatars.map(item => item.key), AVATARS.map(item => item.key));
    assert.deepEqual(labels.avatars.map(item => item.label), SPACE_AVATAR_NAMES[language]);
    assert.equal(new Set(SPACE_AVATAR_NAMES[language]).size, 18);
  }
  assert.deepEqual(SPACE_CARD_CELLS, ANIMAL_CARD_CELLS);
  assert.deepEqual(Object.values(SPACE_CARD_CELLS), Array.from({ length: 10 }, (_, index) => index));
  assert.equal(atlasPosition(SPACE_CARD_CELLS.runner, 5, 2), "100% 100%");
});

test("space sounds retain the twelve stable chat IDs and localized compact labels", () => {
  const ids = ["siren", "scratch", "airhorn", "kick", "snare", "hihat", "clap", "bassdrop", "rimshot", "cowbell", "vinyl", "radio"];
  for (const pack of [de, en]) for (const id of ids) {
    assert.equal(typeof pack[`chat.sound.${id}`], "string");
    assert.ok(pack[`chat.soundShort.${id}`].length <= 8, id);
  }
  assert.equal(de["chat.soundShort.kick"], "Antrieb");
  assert.equal(en["chat.soundShort.kick"], "Thruster");
});

test("space localization does not alter New York or Animal Crews catalogs", () => {
  for (const language of ["de", "en"]) {
    assert.equal(createTranslator(language)("theme.brand"), "Street Kings");
    assert.equal(getGameLabels(language).specials.kingpin.label, "Kingpin");
    assert.equal(createTranslator(language, getThemeMessages("animal", language))("theme.brand"), "Animal Crews");
    assert.equal(getThemeMessages("street", language), null);
    assert.equal(getThemeMessages("unknown", language), null);
  }
});
