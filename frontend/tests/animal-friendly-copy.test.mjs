import assert from "node:assert/strict";
import test from "node:test";
import { catalogs, createTranslator } from "../src/i18n/core.js";
import { de, en } from "../src/i18n/messages/animalCrews.js";
import { getThemeMessages, ANIMAL_AVATAR_NAMES } from "../src/themes/presentation.js";
import { getGameLabels } from "../src/i18n/labels.js";
import { SPECIAL_MAP, SUITS } from "../src/game/constants.js";

test("animal templates cover every visible key and retain every placeholder and plural branch", () => {
  for (const [language, pack] of Object.entries({ de, en })) {
    assert.deepEqual(Object.keys(pack).sort(), Object.keys(catalogs[language]).sort());
    for (const [key, original] of Object.entries(catalogs[language])) {
      const translated = pack[key];
      assert.equal(typeof translated, typeof original, key);
      if (typeof original === "object") assert.deepEqual(Object.keys(translated).sort(), Object.keys(original).sort(), key);
      const placeholders = value => JSON.stringify(value).match(/\{\w+\}/g)?.sort() || [];
      assert.deepEqual(placeholders(translated), placeholders(original), `${language}:${key}`);
    }
  }
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

test("all animal UI templates avoid the city, underworld and old role vocabulary", () => {
  const oldWords = /hitze|\bheat\b|takeover|kingpin|informant|briber|fixer|godmother|\brunners?\b|laufjung|gangster|underworld|unterwelt|hinterzimmer|street|straße|strafe|penalty|police|polizei|schwarzmarkt|\bcash\b|\bgoods\b|\bware\b|akte|dossier|betrug|corrupt|shady|brutal|schmierer|patin/i;
  for (const [language, pack] of Object.entries({ de, en })) {
    for (const [key, value] of Object.entries(pack)) {
      // The separate New York choice must still accurately name that theme.
      if (key.startsWith("theme.street.")) continue;
      assert.doesNotMatch(JSON.stringify(value).replace(/\{\w+\}/g, ""), oldWords, `${language}:${key}`);
    }
  }
  assert.equal(ANIMAL_AVATAR_NAMES.de[6], "Maus");
  assert.equal(ANIMAL_AVATAR_NAMES.en[6], "Mouse");
});

test("friendly templates never rewrite user names, sound labels or other runtime parameters", () => {
  const names = "Hitze Takeover Kingpin Cash Straße Informant";
  for (const language of ["de", "en"]) {
    const t = createTranslator(language, getThemeMessages("animal", language));
    for (const key of ["game.playerTurn", "online.replaceConfirm", "cards.receivedFrom", "cards.from", "scores.summary.breakdown", "setup.playerLanguage"]) {
      assert.ok(t(key, { name: names }).includes(names), `${language}:${key}`);
    }
    for (const key of ["online.reviewNotice", "online.spectators"]) assert.ok(t(key, { names, count: 2 }).includes(names), key);
    assert.ok(t("chat.sendSound", { sound: names }).includes(names));
    assert.ok(t("game.choosePass", { name: names, target: names, count: 1 }).includes(names));
    assert.ok(t("game.choosePass", { name: names, target: names, count: 4 }).includes(names));
    assert.equal(t("scores.step.takeoverOtherHeat", { heat: 25 }).includes("25"), true);
  }
});

test("animal suit and role text keep canonical suit identities, colours and numeric effects", () => {
  assert.deepEqual(SPECIAL_MAP, { kingpin: { suit: "RED", value: 11 }, informant: { suit: "GREEN", value: 11 },
    briber: { suit: "YELLOW", value: 11 }, fixer: { suit: "BLUE", value: 11 }, godmother: { suit: "GREEN", value: 12 } });
  for (const [language, expectedSuits] of Object.entries({ de: ["Trubel", "Leckereien", "Wasser", "Garten"], en: ["Mischief", "Treats", "Water", "Garden"] })) {
    const labels = getGameLabels(language, "animal");
    assert.deepEqual(Object.keys(labels.suits), Object.keys(SUITS));
    assert.deepEqual(Object.values(labels.suits).map(suit => suit.people), expectedSuits);
    for (const [key, suit] of Object.entries(labels.suits)) {
      assert.equal(suit.key, key); assert.equal(suit.primary, SUITS[key].primary); assert.equal(suit.isHeat, SUITS[key].isHeat);
    }
    const t = createTranslator(language, getThemeMessages("animal", language));
    assert.match(t("rules.scoring.text"), /1.*15.*\+5.*\+10.*5.*0/);
    assert.match(t("rules.special.kingpin"), /0.*15/);
    assert.match(t("rules.special.briber"), /5.*0/);
    assert.match(t("rules.special.runner"), /0/);
    assert.match(t("rules.takeover.text"), /14.*0/);
    assert.match(t("rules.takeover.exception"), /40.*0.*60.*25.*40.*15.*0.*60/);
    assert.match(t("rules.takeover.effects"), language === "de" ? /Helferfuchs und Glückshyäne können.*nicht senken/ : /Helper Fox and Happy Hyena cannot reduce/);
  }
});

test("the original theme keeps its own labels and rules", () => {
  for (const language of ["de", "en"]) {
    const street = createTranslator(language);
    assert.equal(street("theme.brand"), "Street Kings");
    assert.equal(street("cards.kingpin.label"), "Kingpin");
    assert.equal(street("suits.BLUE.people"), "Cash");
    assert.equal(getThemeMessages("street", language), null);
  }
});
