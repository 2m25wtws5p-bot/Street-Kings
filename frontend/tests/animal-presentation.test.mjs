import assert from "node:assert/strict";
import test from "node:test";
import { createTranslator, catalogs } from "../src/i18n/core.js";
import { getGameLabels } from "../src/i18n/labels.js";
import { de, en } from "../src/i18n/messages/animalCrews.js";
import { getThemeMessages, ANIMAL_CARD_CELLS, atlasPosition } from "../src/themes/presentation.js";
import { AVATARS, SPECIAL_MAP } from "../src/game/constants.js";

test("animal translations cover the same keys and placeholders without changing identities", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(de)) {
    assert.ok(Object.hasOwn(catalogs.de, key), `Unknown theme message: ${key}`);
    const a = JSON.stringify(de[key]), b = JSON.stringify(en[key]);
    assert.deepEqual(a.match(/\{\w+\}/g), b.match(/\{\w+\}/g), key);
  }
  for (const language of ["de", "en"]) {
    const normal = getGameLabels(language), animal = getGameLabels(language, "animal");
    assert.deepEqual(animal.avatars.map(item => item.key), AVATARS.map(item => item.key));
    assert.equal(new Set(animal.avatars.map(item => item.label)).size, 18);
    const expectedLabels = language === "de"
      ? { kingpin: "Wirbelrabe", informant: "Naschmaus", briber: "Glückshyäne", fixer: "Helferfuchs", godmother: "Wirbeleule", runner: "Hoppelhase" }
      : { kingpin: "Mischief Raven", informant: "Snack Mouse", briber: "Happy Hyena", fixer: "Helper Fox", godmother: "Mischief Owl", runner: "Hopping Rabbit" };
    for (const key of Object.keys(normal.specials)) {
      assert.equal(animal.specials[key].key, normal.specials[key].key);
      assert.equal(animal.specials[key].tag, normal.specials[key].tag);
      assert.equal(animal.specials[key].label, expectedLabels[key]);
      if (key === "fixer") {
        assert.match(normal.specials[key].short, /neutral/i);
        assert.match(animal.specials[key].short, /Ø/);
        assert.match(animal.specials[key].desc, /neutral/i);
      } else {
        // Presentation may change words, never the numeric effect or its sign.
        const effect = text => text.match(/(?:x|[+−-])?\d+/g)?.map(value => value.replace("−", "-"));
        assert.deepEqual(effect(animal.specials[key].short), effect(normal.specials[key].short), key);
      }
    }
    for (const key of Object.keys(normal.suits)) assert.equal(animal.suits[key].primary, normal.suits[key].primary);
  }
});

test("theme translations preserve plural rules, parameters and personal language", () => {
  const animalDe = createTranslator("de", getThemeMessages("animal", "de"));
  const animalEn = createTranslator("en", getThemeMessages("animal", "en"));
  assert.equal(animalDe("theme.brand"), "Animal Crews");
  assert.equal(animalEn("theme.brand"), "Animal Crews");
  assert.equal(animalDe("game.playerTurn", { name: "Fox Kingpin" }), "Fox Kingpin ist am Zug.");
  assert.equal(animalEn("game.playerTurn", { name: "Fox Kingpin" }), "It’s Fox Kingpin’s turn.");
  assert.equal(animalDe("over.title", { count: 1 }), "Der Gartenchampion");
  assert.equal(animalDe("over.title", { count: 2 }), "Die Gartenchampions");
  assert.match(animalDe("cards.fixer.desc"), /Helferfuchs/);
  assert.match(animalEn("cards.fixer.desc"), /Fox/);
  assert.equal(createTranslator("en")("theme.brand"), "Street Kings");
  assert.equal(getThemeMessages("unknown", "de"), null);
});

test("the ten card illustrations occupy exact distinct cells without touching gameplay values", () => {
  assert.equal(Object.keys(ANIMAL_CARD_CELLS).length, 10);
  assert.deepEqual(Object.values(ANIMAL_CARD_CELLS), Array.from({ length: 10 }, (_, i) => i));
  assert.equal(atlasPosition(0, 5, 2), "0% 0%");
  assert.equal(atlasPosition(4, 5, 2), "100% 0%");
  assert.equal(atlasPosition(5, 5, 2), "0% 100%");
  assert.equal(atlasPosition(9, 5, 2), "100% 100%");
  assert.deepEqual(SPECIAL_MAP.godmother, { suit: "GREEN", value: 12 });
});
