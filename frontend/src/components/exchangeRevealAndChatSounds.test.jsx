import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { useChatSounds } from "../game/useChatSounds";
import { sfx } from "../game/sound";
import { ExchangeReveal, EXCHANGE_REVEAL_MS } from "./ExchangeReveal";

jest.mock("../game/sound", () => ({ sfx: { chatSound: jest.fn() } }));

let container;
let root;
let hidden;
let hiddenDescriptor;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  jest.clearAllMocks();
  hidden = false;
  hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
  else delete document.hidden;
  jest.useRealTimers();
});

const exchange = (id = "GREEN-12", name = "Nia") => ({
  receivedFrom: name,
  received: [{ id, suit: "GREEN", value: id === "GREEN-11" ? 11 : 12, special: id === "GREEN-11" ? "water" : "pygmy" }],
});
const renderReceipt = ({ cards = exchange(), scopeKey = "round-0-seat-0", available = true, language = "de", strict = false } = {}) => {
  const child = <I18nScope language={language}><ExchangeReveal exchange={cards} scopeKey={scopeKey} available={available} /></I18nScope>;
  act(() => root.render(strict ? <StrictMode>{child}</StrictMode> : child));
};
const receipt = () => container.querySelector('[data-testid="exchange-receipt"]');
const advance = ms => act(() => jest.advanceTimersByTime(ms));

test("received cards remain visible for 1800ms and disappear at the deadline", () => {
  expect(EXCHANGE_REVEAL_MS).toBe(1800);
  renderReceipt();
  expect(receipt()).not.toBeNull();
  expect(container.querySelector('[data-testid="received-card-GREEN-12"]')).not.toBeNull();
  advance(1799);
  expect(receipt()).not.toBeNull();
  advance(1);
  expect(receipt()).toBeNull();
});

test("new polling objects and a language change do not restart the receipt timer", () => {
  renderReceipt();
  advance(1000);
  renderReceipt({ cards: exchange(), language: "en" });
  expect(receipt().querySelector("h3").textContent).toBe("You received these cards from Nia");
  advance(799);
  expect(receipt()).not.toBeNull();
  advance(1);
  expect(receipt()).toBeNull();
  renderReceipt({ cards: exchange(), language: "en" });
  expect(receipt()).toBeNull();
});

test("StrictMode effect cleanup retains one deadline and a later round has its own receipt", () => {
  renderReceipt({ strict: true });
  expect(receipt()).not.toBeNull();
  advance(1799);
  expect(receipt()).not.toBeNull();
  advance(1);
  expect(receipt()).toBeNull();
  renderReceipt({ strict: true, scopeKey: "round-1-seat-0", cards: exchange("GREEN-11", "Milo") });
  expect(receipt().querySelector("h3").textContent).toBe("Diese Karten hast du von Milo bekommen");
  expect(container.querySelector('[data-testid="received-card-GREEN-11"]')).not.toBeNull();
  advance(1800);
  expect(receipt()).toBeNull();
});

test("a hotseat privacy gate removes private cards immediately without waiting for exit animation", () => {
  renderReceipt();
  advance(400);
  renderReceipt({ available: false });
  // Do not advance timers: even one retained exit frame exposes a private hand.
  expect(receipt()).toBeNull();
  expect(container.querySelector('[data-testid="received-card-GREEN-12"]')).toBeNull();
  advance(400);
  renderReceipt({ available: true });
  expect(receipt()).not.toBeNull();
  advance(999);
  expect(receipt()).not.toBeNull();
  advance(1);
  expect(receipt()).toBeNull();
});

test("changing the private recipient's scope never retains the previous player's artwork", () => {
  renderReceipt();
  advance(300);
  renderReceipt({ scopeKey: "round-0-seat-1", cards: null });
  expect(receipt()).toBeNull();
  expect(container.querySelector('[data-testid="received-card-GREEN-12"]')).toBeNull();
  renderReceipt({ scopeKey: "round-0-seat-1", cards: exchange("GREEN-11", "Jade") });
  expect(container.querySelector('[data-testid="received-card-GREEN-12"]')).toBeNull();
  expect(container.querySelector('[data-testid="received-card-GREEN-11"]')).not.toBeNull();
  expect(receipt().querySelector("h3").textContent).toContain("Jade");
});

function ChatSoundProbe({ messages, identity }) {
  useChatSounds({ chatMessages: messages }, identity);
  return null;
}
const sound = (id, soundId = "siren", createdAt = Date.now()) => ({ id, sound: soundId, createdAt, text: "" });
const renderSounds = (messages, identity) => act(() => root.render(<StrictMode><ChatSoundProbe messages={messages} identity={identity} /></StrictMode>));

test("chat suppresses the initial transcript and plays each newly received sound only once", () => {
  const identity = {};
  const old = sound("existing");
  renderSounds([old], identity);
  expect(sfx.chatSound).not.toHaveBeenCalled();
  const fresh = sound("fresh", "scratch");
  renderSounds([old, fresh], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(1);
  expect(sfx.chatSound).toHaveBeenLastCalledWith("scratch");
  advance(1100);
  renderSounds([{ ...old }, { ...fresh }], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(1);
});

test("hidden tabs consume sound messages without replaying them when the tab returns", () => {
  const identity = {};
  renderSounds([], identity);
  hidden = true;
  const fresh = sound("hidden-sound");
  renderSounds([fresh], identity);
  expect(sfx.chatSound).not.toHaveBeenCalled();
  hidden = false;
  advance(1100);
  renderSounds([{ ...fresh }], identity);
  expect(sfx.chatSound).not.toHaveBeenCalled();
  renderSounds([fresh, sound("visible-sound", "airhorn")], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(1);
  expect(sfx.chatSound).toHaveBeenLastCalledWith("airhorn");
});

test("unknown, expired and future sounds never autoplay and a new session suppresses its transcript", () => {
  const identity = {};
  renderSounds([], identity);
  const invalid = [sound("external", "https://example.test/file.mp3"), sound("old", "siren", Date.now() - 7000), sound("future", "siren", Date.now() + 500)];
  renderSounds(invalid, identity);
  expect(sfx.chatSound).not.toHaveBeenCalled();
  renderSounds([sound("other-session")], {});
  expect(sfx.chatSound).not.toHaveBeenCalled();
});

test("a burst plays only its newest sound and subsequent autoplay is rate-limited", () => {
  const identity = {};
  renderSounds([], identity);
  const first = sound("first", "siren");
  const second = sound("second", "airhorn");
  renderSounds([first, second], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(1);
  expect(sfx.chatSound).toHaveBeenLastCalledWith("airhorn");
  advance(500);
  const third = sound("third", "scratch");
  renderSounds([first, second, third], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(1);
  advance(500);
  renderSounds([first, second, third, sound("fourth", "scratch")], identity);
  expect(sfx.chatSound).toHaveBeenCalledTimes(2);
  expect(sfx.chatSound).toHaveBeenLastCalledWith("scratch");
});
