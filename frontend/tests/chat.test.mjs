import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const chat = await import(moduleUrl(await source("game/chat.js")));
const clipboard = await import(moduleUrl(await source("game/clipboard.js")));
const onlineMessagesUrl = moduleUrl(await source("i18n/messages/online.js"));
const { de, en } = await import(onlineMessagesUrl);
const translator = language => (key, params = {}) => {
  const entry = (language === "en" ? en : de)[key];
  const text = typeof entry === "object" ? entry[params.count === 1 ? "one" : "other"] : entry;
  return (text || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
};
const api = await import(moduleUrl((await source("game/api.js"))
  .replace('from "../i18n/messages/online"', `from "${onlineMessagesUrl}"`)
  .replace('import axios from "axios";', 'const axios={create:()=>({interceptors:{request:{use(){}}}})};')));

test("chat limits use Unicode characters and keep complete emoji", () => {
  assert.equal(chat.CHAT_EMOJIS.length, 8);
  assert.equal(chat.chatLength("😎".repeat(140)), 140);
  assert.equal(chat.limitChatText("😎".repeat(141)), "😎".repeat(140));
  assert.equal(chat.chatLength(chat.limitChatText("A".repeat(140) + "B")), 140);
  assert.equal(chat.limitChatText("Hi\r\nCrew\t!\u2028OK"), "Hi Crew ! OK");
});

test("each player shows only their latest short-lived message", () => {
  const messages = [
    { id: "a", seat: 0, createdAt: 1000 },
    { id: "b", seat: 1, createdAt: 1500 },
    { id: "c", seat: 0, createdAt: 1800 },
  ];
  assert.equal(chat.latestChatMessage(messages, 0).id, "c");
  assert.equal(chat.latestChatMessage(messages, 1).id, "b");
  assert.equal(chat.latestChatMessage(messages, 2), null);
  assert.equal(chat.chatBubbleRemaining(messages[2], 1800), 7000);
  assert.equal(chat.chatBubbleRemaining(messages[2], 8800), 0);
  assert.equal(chat.chatBubbleRemaining(messages[2], 1500), 7000);
});

test("chat responses reject unsafe or malformed transcripts and accept HTML as ordinary text", () => {
  const room = { code: "ROOM", status: "lobby", n: 1, version: 1, players: [{ seat: 0, name: "Host" }], yourSeat: 0 };
  const message = { id: "uuid", seat: 0, name: "Host", text: "<script>alert(1)</script>", createdAt: 1760000000000 };
  assert.equal(api.validateRoomView({ ...room, chatMessages: [message] }).chatMessages[0].text, message.text);
  assert.equal(api.validateRoomView({ ...room, chatMessages: [{ ...message, text: "😎".repeat(140) }] }).chatMessages.length, 1);
  for (const chatMessages of ["bad", [null], Array(31).fill(message), [{ ...message, seat: 2 }], [{ ...message, text: "😎".repeat(141) }], [{ ...message, text: "" }], [{ ...message, createdAt: "now" }], [{ ...message, createdAt: 8640000000000001 }]]) {
    assert.throws(() => api.validateRoomView({ ...room, chatMessages }), error => error.code === "ONLINE_RESPONSE");
  }
});

test("denied modern clipboard falls back to copying the exact code and restores focus", async () => {
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const priorDocument = globalThis.document;
  let copied, removed = false, focused = false;
  const field = { value: "", style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, remove() { removed = true; } };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("denied"); } } } });
  globalThis.document = { activeElement: { focus() { focused = true; } }, getSelection: () => null, createElement: () => field, body: { appendChild() {} }, execCommand: command => { assert.equal(command, "copy"); copied = field.value; return true; } };
  try {
    assert.equal(await clipboard.copyText("AB1234"), true);
    assert.equal(copied, "AB1234");
    assert.equal(removed, true); assert.equal(focused, true);
    globalThis.document.execCommand = () => { throw new Error("blocked"); };
    assert.equal(await clipboard.copyText("AB1234"), false);
  } finally {
    if (priorNavigator) Object.defineProperty(globalThis, "navigator", priorNavigator);
    else delete globalThis.navigator;
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
});

class HookHost {
  slots = []; effects = []; cursor = 0; dirty = false;
  useState(initial) {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = typeof initial === "function" ? initial() : initial;
    return [this.slots[index], next => { this.slots[index] = typeof next === "function" ? next(this.slots[index]) : next; this.dirty = true; }];
  }
  useRef(initial) { const index = this.cursor++; return this.slots[index] ||= { current: initial }; }
  useCallback(fn, deps) {
    const index = this.cursor++, previous = this.slots[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) this.slots[index] = { deps, fn };
    return this.slots[index].fn;
  }
  useEffect(fn, deps) {
    const index = this.cursor++, previous = this.slots[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) this.effects.push(() => { previous?.cleanup?.(); this.slots[index] = { deps, cleanup: fn() }; });
  }
  render(code = "ROOM", token = "human") {
    do {
      this.dirty = false; this.cursor = 0; globalThis.__chatHooks = this;
      this.value = useOnlineGame(code, token);
      this.effects.splice(0).forEach(fn => fn());
    } while (this.dirty);
    return this.value;
  }
  unmount() { this.slots.forEach(slot => slot?.cleanup?.()); }
}
const hooks = moduleUrl('export const useState=(...a)=>globalThis.__chatHooks.useState(...a);export const useRef=(...a)=>globalThis.__chatHooks.useRef(...a);export const useCallback=(...a)=>globalThis.__chatHooks.useCallback(...a);export const useEffect=(...a)=>globalThis.__chatHooks.useEffect(...a);');
const fakeApi = moduleUrl('export const roomApi=new Proxy({}, {get:(_,name)=>(...a)=>globalThis.__chatApi[name](...a)});export const onlineErrorMessage=(e,t)=>e?.translationKey ? t(e.translationKey) : e?.response?.data?.detail || e.message;');
const fakeI18n = moduleUrl('export const useI18n=()=>({t:globalThis.__chatT});');
globalThis.__chatT = translator("de");
const { useOnlineGame } = await import(moduleUrl((await source("game/useOnlineGame.js"))
  .replace('from "react"', `from "${hooks}"`).replace('from "./api"', `from "${fakeApi}"`)
  .replace('from "../i18n/I18nProvider"', `from "${fakeI18n}"`)
  .replaceAll("setInterval(", "globalThis.__chatSetInterval(").replaceAll("clearInterval(", "globalThis.__chatClearInterval(")));
globalThis.__chatSetInterval = () => 1;
globalThis.__chatClearInterval = () => {};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("a pending chat send cannot block play or replace a newer gameplay response", async () => {
  const pending = deferred(); let sends = 0, plays = 0;
  globalThis.__chatApi = {
    get: async () => ({ code: "ROOM", version: 1 }),
    chat: () => { sends++; return pending.promise; },
    action: async () => { plays++; return { code: "ROOM", version: 3, phase: "playing" }; },
  };
  const host = new HookHost(); host.render(); await settle(); host.render();
  const send = host.value.sendChat("Hi");
  assert.equal(await host.value.sendChat("Again"), false);
  host.render(); assert.equal(host.value.chatBusy, true); assert.equal(host.value.busy, false);
  assert.equal(await host.value.play("RED-1"), true);
  pending.resolve({ code: "ROOM", version: 2, phase: "passing" });
  assert.equal(await send, true); await settle(); host.render();
  assert.equal(sends, 1); assert.equal(plays, 1); assert.equal(host.value.view.version, 3);
  assert.equal(host.value.chatBusy, false); host.unmount();
});

test("gameplay in flight still allows chat and chat errors stay separate", async () => {
  const move = deferred(); let sends = 0;
  globalThis.__chatApi = {
    get: async () => ({ code: "ROOM", version: 1 }),
    action: () => move.promise,
    chat: async () => { sends++; throw { response: { data: { detail: "Bitte warte 1,5 Sekunden." } } }; },
  };
  const host = new HookHost(); host.render(); await settle(); host.render();
  const playing = host.value.play("BLUE-2");
  assert.equal(await host.value.sendChat("😎"), false); host.render();
  assert.equal(sends, 1); assert.equal(host.value.busy, true);
  assert.equal(host.value.chatError, "Bitte warte 1,5 Sekunden."); assert.equal(host.value.actionError, null);
  move.resolve({ code: "ROOM", version: 2 }); await playing; host.unmount();
});

test("chat enforces its cooldown and normalizes pasted lines without locking gameplay", async () => {
  let now = 6000;
  const priorNow = Date.now;
  Date.now = () => now;
  const sent = [];
  globalThis.__chatApi = { get: async () => ({ code: "ROOM", version: 1 }), chat: async (_room, _token, text) => { sent.push(text); return { code: "ROOM", version: sent.length + 1 }; } };
  const host = new HookHost();
  try {
    host.render(); await settle(); host.render();
    assert.equal(await host.value.sendChat("  Hi\nCrew\t!  "), true);
    assert.deepEqual(sent, ["Hi Crew !"]);
    now += 1499;
    assert.equal(await host.value.sendChat("Too soon"), false);
    host.render(); assert.equal(host.value.busy, false); assert.equal(host.value.chatBusy, false);
    now += 1;
    assert.equal(await host.value.sendChat("On time"), true);
    assert.deepEqual(sent, ["Hi Crew !", "On time"]);
  } finally { Date.now = priorNow; host.unmount(); }
});

test("late chat responses and errors from abandoned sessions cannot leak into another room", async () => {
  for (const fail of [false, true]) {
    const pending = deferred();
    globalThis.__chatApi = { get: async room => ({ code: room, version: 1 }), chat: () => pending.promise };
    const host = new HookHost(); host.render("OLD", "old"); await settle(); host.render("OLD", "old");
    const send = host.value.sendChat("Private old chat");
    host.render("NEW", "new"); await settle(); host.render("NEW", "new");
    if (fail) pending.reject(new Error("Old error")); else pending.resolve({ code: "OLD", version: 999, chatMessages: [{ text: "Old" }] });
    assert.equal(await send, false); await settle(); host.render("NEW", "new");
    assert.equal(host.value.view.code, "NEW"); assert.equal(host.value.chatError, null); assert.equal(host.value.chatBusy, false);
    host.unmount();
  }
});

test("online catalogs cover the same keys, variables and safe server error translations", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(de)) {
    const forms = typeof de[key] === "object" ? ["one", "other"] : [null];
    for (const form of forms) {
      const german = form ? de[key][form] : de[key];
      const english = form ? en[key][form] : en[key];
      assert.ok(english.trim(), key);
      const parameters = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      assert.deepEqual(parameters(german), parameters(english), key);
    }
  }
  assert.equal(api.onlineErrorMessage({ response: { data: { detail: "Nicht dein Zug" } } }, translator("en")), "It is not your turn");
  assert.equal(api.onlineErrorMessage({ response: { data: { detail: "Unbekannte geheime Fehlermeldung" } } }, translator("en")), en["error.generic"]);
  assert.equal(api.onlineErrorMessage({ response: { status: 422, data: { detail: [{ msg: "bad" }] } } }, translator("en")), en["error.validation"]);
  assert.equal(api.onlineErrorMessage({ response: { status: 429 } }, translator("en")), en["error.chatCooldown"]);
  assert.equal(api.onlineErrorMessage({ code: "ONLINE_CONFIG" }, translator("en")), en["error.config"]);
  assert.equal(api.onlineErrorMessage({ code: "ONLINE_RESPONSE" }, translator("en")), en["error.response"]);
  assert.equal(api.onlineErrorMessage({ code: "ETIMEDOUT" }, translator("en")), en["error.timeout"]);
  assert.equal(api.onlineErrorMessage({ code: "ERR_NETWORK" }, translator("en")), en["error.network"]);
  assert.equal(api.onlineErrorMessage({ response: { data: { detail: "Karte nicht erlaubt" } } }), de["error.card"]);
});

test("changing language translates current chat errors without rejoining or repeating requests", async () => {
  let polls = 0, chats = 0;
  const pending = deferred();
  globalThis.__chatT = translator("de");
  globalThis.__chatApi = {
    get: async () => { polls++; return { code: "ROOM", version: 1 }; },
    chat: () => { chats++; return pending.promise; },
  };
  const host = new HookHost();
  try {
    host.render(); await settle(); host.render();
    assert.equal(await host.value.sendChat("😎".repeat(141)), false);
    host.render(); assert.equal(host.value.chatError, de["chat.invalidLength"]);
    const hand = host.value.view;
    globalThis.__chatT = translator("en"); host.render();
    assert.equal(host.value.chatError, en["chat.invalidLength"]);
    assert.equal(host.value.view, hand); assert.equal(polls, 1);
    const send = host.value.sendChat("Hello Crew");
    globalThis.__chatT = translator("de"); host.render();
    pending.reject({ translationKey: "error.chatCooldown" });
    assert.equal(await send, false); host.render();
    assert.equal(host.value.chatError, de["error.chatCooldown"]);
    assert.equal(chats, 1); assert.equal(polls, 1);
  } finally { host.unmount(); globalThis.__chatT = translator("de"); }
});
