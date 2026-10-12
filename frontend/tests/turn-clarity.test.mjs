import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/components/TurnClarity.css", import.meta.url), "utf8");
const rosterStyles = readFileSync(new URL("../src/components/Roster.css", import.meta.url), "utf8");
const luminance = hex => {
  const values = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
};

test("all three status palettes have opaque backgrounds and accessible text contrast", () => {
  const backgrounds = [];
  for (const state of ["waiting", "active", "complete"]) {
    const rule = styles.match(new RegExp(`\\.turn-status-card\\.turn-clarity\\[data-state="${state}"\\]\\s*\\{([^}]+)\\}`))[1];
    const foreground = rule.match(/(?:^|[;\s])color:(#[a-f\d]{6});/i)[1];
    const background = rule.match(/background:(#[a-f\d]{6});/i)[1];
    const l1 = luminance(foreground);
    const l2 = luminance(background);
    assert.ok((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) >= 4.5, state);
    backgrounds.push(background);
  }
  assert.equal(new Set(backgrounds).size, 3);
});

test("status contrast changes do not alter the reserved layout or animate hand positions", () => {
  for (const rule of styles.matchAll(/\.turn-status-card\.turn-clarity\[data-state="[^"]+"\]\s*\{([^}]+)\}/g)) {
    assert.doesNotMatch(rule[1], /(?:^|[;\s])(?:height|min-height|max-height|padding|margin|display|transform|animation):/m);
  }
  assert.match(rosterStyles, /\[data-current="true"\][^{]+\.crew-name > span:first-child::before\s*\{\s*content:"▶"/);
  assert.match(rosterStyles, /\[data-winner="true"\][^{]+\.crew-name > span:first-child::before\s*\{\s*content:"✓"/);
});
