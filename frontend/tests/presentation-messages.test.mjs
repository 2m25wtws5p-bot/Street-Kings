import assert from "node:assert/strict";
import test from "node:test";
import { de, en } from "../src/i18n/messages/presentationImprovements.js";

test("setup, turn order and consensus readiness messages are complete in both languages", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(de)) {
    assert.ok(de[key].trim() && en[key].trim(), key);
    const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(params(de[key]), params(en[key]), key);
  }
  assert.match(de["improvements.ready.hint"], /alle Mitspieler bereit/);
  assert.match(en["improvements.ready.hint"], /every player is ready/);
});
