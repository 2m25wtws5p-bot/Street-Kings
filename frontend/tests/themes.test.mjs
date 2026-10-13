import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const configUrl = moduleUrl(await source("themes/themeConfig.js"));
const { DEFAULT_THEME, THEMES, isTheme, normalizeTheme } = await import(configUrl);
const themesUrl = moduleUrl(await source("i18n/messages/themes.js"));
const { de, en } = await import(themesUrl);
const onlineUrl = moduleUrl(await source("i18n/messages/online.js"));
const flowUrl = moduleUrl(await source("i18n/messages/flowImprovements.js"));
const chatUrl = moduleUrl(await source("game/chat.js"));
const sent = [];
globalThis.__themeRequests = sent;
const { roomApi, validateRoomView, onlineErrorMessage } = await import(moduleUrl((await source("game/api.js"))
  .replace('from "../i18n/messages/online"', `from "${onlineUrl}"`)
  .replace('from "../i18n/messages/flowImprovements"', `from "${flowUrl}"`)
  .replace('from "../i18n/messages/themes"', `from "${themesUrl}"`)
  .replace('from "../themes/themeConfig"', `from "${configUrl}"`)
  .replace('from "./chat"', `from "${chatUrl}"`)
  .replace('import axios from "axios";', 'const axios={create:()=>({interceptors:{request:{use(){}}},post:async(url,payload)=>{globalThis.__themeRequests.push({url,payload});return{data:{code:"ROOM",token:"test-token"}};}})};')));

test("theme identities are stable, bounded, and unknown/old rooms default to New York", () => {
  assert.equal(DEFAULT_THEME, "street");
  assert.deepEqual(THEMES.map(theme => theme.id), ["street", "animal", "space"]);
  for (const theme of ["street", "animal", "space"]) { assert.equal(isTheme(theme), true); assert.equal(normalizeTheme(theme), theme); }
  for (const theme of [undefined, null, "ANIMAL", "__proto__", "constructor", {}, [], true, 1]) {
    assert.equal(isTheme(theme), false); assert.equal(normalizeTheme(theme), "street");
  }
});

test("shared room theme validation accepts known themes and older rooms but rejects malformed values", () => {
  const room = { code: "ROOM", status: "lobby", phase: "lobby", n: 1, version: 1, players: [{ seat: 0, name: "Host" }], yourSeat: 0 };
  for (const theme of [undefined, null, "street", "animal", "space"]) {
    const view = { ...room, theme }; assert.equal(validateRoomView(view), view);
  }
  for (const theme of ["unknown", "ANIMAL", "__proto__", {}, [], true, 1]) {
    assert.throws(() => validateRoomView({ ...room, theme }), error => error.code === "ONLINE_RESPONSE");
  }
});

test("room creation sends a neutral theme ID without changing avatar or player identity", async () => {
  const avatar = { key: "boss", color: "#abc" };
  await roomApi.create("Host", avatar, "animal");
  assert.deepEqual(sent.at(-1).payload, { name: "Host", avatar, theme: "animal" });
  await roomApi.create("Host", avatar, "space");
  assert.deepEqual(sent.at(-1).payload, { name: "Host", avatar, theme: "space" });
  await roomApi.create("Host", avatar);
  assert.deepEqual(sent.at(-1).payload, { name: "Host", avatar });
});

test("theme controls and server failures have complete German and English messages", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const option of THEMES) for (const key of [option.nameKey, option.descriptionKey]) {
    assert.equal(typeof de[key], "string"); assert.equal(typeof en[key], "string");
  }
  for (const key of Object.keys(de)) assert.deepEqual(de[key].match(/\{\w+\}/g), en[key].match(/\{\w+\}/g));
  for (const key of ["error.themeHostOnly", "error.themeLobbyOnly", "error.themeInvalid"]) {
    assert.equal(onlineErrorMessage({ response: { status: 409, data: { detail: de[key] } } }, key => en[key]), en[key]);
  }
});
