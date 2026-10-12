import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { HandCards } from "./HandCards";
import { HAND_PREFERENCE_KEY } from "../game/handPreferences";

let container, root;
const hand = Array.from({ length: 12 }, (_, index) => ({
  id: `card-${index}`, suit: ["RED", "YELLOW", "BLUE", "GREEN"][index % 4], value: index + 1,
}));
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem(HAND_PREFERENCE_KEY, JSON.stringify({ mode: "chaos", seed: 47 }));
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); });
const render = (props = {}, language = "de") => act(() => root.render(
  <I18nScope language={language}><HandCards cards={hand} initialCount={12} handScopeKey="room-a-round-1-player-0"
    interactionKey="turn-1" {...props} /></I18nScope>));
const order = () => [...container.querySelectorAll(".spread-hand-row > [data-testid]")].map(node => node.dataset.testid.replace("hand-card-item-", ""));
const cardNode = id => [...container.querySelectorAll(".spread-hand-row > [data-testid]")].find(node => node.dataset.testid === `hand-card-item-${id}`);
const click = node => act(() => node.click());
const begin = () => click(container.querySelector('[data-testid="hand-arrange-toggle"]'));
const rect = (left, top, width = 40, height = 58) => ({ left, right: left + width, top, bottom: top + height, width, height });
function pointer(node, type, x, y, more = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, ...more });
  act(() => node.dispatchEvent(event));
}

test("chaos cards can be arranged by tap/keyboard while waiting, without selecting or playing", () => {
  const select = jest.fn(), play = jest.fn(); render({ onCardClick: select, onCardDrop: play, canDrag: false, legalIds: [] });
  const original = order(); begin();
  expect(container.querySelector(".hand-cards-shell").dataset.arranging).toBe("true");
  click(cardNode(original[0]));
  expect(cardNode(original[0]).classList.contains("hand-card-arrange-picked")).toBe(true);
  click(cardNode(original[3]));
  expect(order()[3]).toBe(original[0]);
  expect(document.activeElement).toBe(cardNode(original[0]));
  expect(select).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
  click(container.querySelector('[data-testid="hand-arrange-toggle"]'));
  click(cardNode(original[0]));
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(hand.find(card => card.id === original[0]));
});

test("manual arrangement belongs to each room/round/player and does not leak into another hand", () => {
  render(); const original = order(); begin(); click(cardNode(original[0])); click(cardNode(original[4]));
  const arranged = order(); expect(arranged).not.toEqual(original);
  render({ interactionKey: "turn-9" }); expect(order()).toEqual(arranged);
  render({ handScopeKey: "room-a-round-1-player-1" });
  expect(order()).toEqual(original); expect(container.querySelector('[data-testid="hand-arrange-toggle"]').getAttribute("aria-pressed")).toBe("false");
  render({ handScopeKey: "room-b-round-1-player-0" }); expect(order()).toEqual(original);
  render({ handScopeKey: "room-a-round-2-player-0" }); expect(order()).toEqual(original);
  render(); expect(order()).toEqual(arranged);
  const stored = JSON.parse(localStorage.getItem(HAND_PREFERENCE_KEY));
  expect(Object.keys(stored).sort()).toEqual(["mode", "seed"]);
});

test("played cards disappear cleanly, incoming cards append, and shuffle clears manual arrangement", () => {
  render(); const original = order(); begin(); click(cardNode(original[0])); click(cardNode(original[3]));
  const arranged = order(), removed = arranged[2], incoming = { id: "incoming", suit: "GREEN", value: 14 };
  render({ cards: [...hand.filter(card => card.id !== removed), incoming] });
  expect(order()).toEqual([...arranged.filter(id => id !== removed), "incoming"]);
  const random = jest.spyOn(Math, "random").mockReturnValue(.5);
  click(container.querySelector(".hand-shuffle-button")); random.mockRestore();
  expect(container.querySelector('[data-testid="hand-arrange-toggle"]').getAttribute("aria-pressed")).toBe("false");
  expect(JSON.parse(localStorage.getItem(HAND_PREFERENCE_KEY)).seed).not.toBe(47);
});

test("mouse/touch reorder can cross rows and cannot accidentally play an illegal card", () => {
  const play = jest.fn(), select = jest.fn(); render({ onCardDrop: play, onCardClick: select, canDrag: true, legalIds: [] });
  const original = order(); begin();
  [...container.querySelectorAll(".spread-hand-row")].forEach((row, rowIndex) => {
    [...row.children].forEach((node, index) => { node.getBoundingClientRect = () => rect(20 + index * 20, 100 + rowIndex * 80); });
  });
  const source = cardNode(original[0]);
  const target = cardNode(original.at(-1)).getBoundingClientRect();
  pointer(source, "pointerdown", 25, 110);
  pointer(source, "pointermove", target.left + 5, target.top + 10, { pointerType: "touch" });
  pointer(source, "pointerup", target.left + 5, target.top + 10, { pointerType: "touch" });
  expect(order().at(-1)).toBe(original[0]);
  expect(play).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  const trailingClick = new MouseEvent("click", { bubbles: true, detail: 1 });
  act(() => cardNode(original[0]).dispatchEvent(trailingClick));
  expect(container.querySelector(".hand-card-arrange-picked")).toBeNull();
});

test("cancelled, out-of-hand and stale-turn gestures never reorder", () => {
  render(); const original = order(); begin();
  const nodes = [...container.querySelectorAll(".spread-hand-row > [data-testid]")];
  nodes.forEach((node, index) => { node.getBoundingClientRect = () => rect(20 + index * 20, 100); });
  const source = cardNode(original[0]);
  pointer(source, "pointerdown", 25, 110); pointer(source, "pointermove", 85, 110); pointer(source, "pointercancel", 85, 110);
  expect(order()).toEqual(original);
  pointer(source, "pointerdown", 25, 110); pointer(source, "pointermove", 85, 110); pointer(source, "pointerup", 600, 600);
  expect(order()).toEqual(original);
  pointer(source, "pointerdown", 25, 110); pointer(source, "pointermove", 85, 110);
  render({ interactionKey: "turn-2" }); pointer(cardNode(original[0]), "pointerup", 85, 110);
  expect(order()).toEqual(original);
});

test("normal chaos mode still drags a legal card to the table, without rearranging or a trailing click", () => {
  const play = jest.fn(), select = jest.fn();
  render({ onCardDrop: play, onCardClick: select, canDrag: true, legalIds: hand.map(card => card.id) });
  const original = order(), source = cardNode(original[0]);
  const zone = document.createElement("div"); zone.dataset.cardDropZone = "";
  zone.getBoundingClientRect = () => rect(200, 200, 100, 100); document.body.append(zone);
  try {
    pointer(source, "pointerdown", 25, 110); pointer(source, "pointermove", 220, 220); pointer(source, "pointerup", 220, 220);
    expect(play).toHaveBeenCalledTimes(1); expect(play).toHaveBeenCalledWith(hand.find(card => card.id === original[0]));
    expect(order()).toEqual(original);
    act(() => source.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
    expect(select).not.toHaveBeenCalled();
  } finally { zone.remove(); }
});

test("face-down and confirmed private passes cannot expose or rearrange cards", () => {
  render({ faceDown: true });
  expect(container.querySelector('[data-testid="hand-arrange-toggle"]').disabled).toBe(true);
  expect(container.querySelectorAll(".street-card")).toHaveLength(0);
  render({ canArrange: false });
  expect(container.querySelector('[data-testid="hand-arrange-toggle"]').disabled).toBe(true);
  expect(container.querySelector(".hand-shuffle-button").disabled).toBe(true);
});

test("sorting by suit exits arrangement and English instructions follow the viewer language", () => {
  render({}, "en"); begin();
  expect(container.querySelector('[data-testid="hand-arrange-toggle"]').textContent).toBe("Done");
  expect(container.querySelector('[data-testid="hand-card-detail"]').textContent).toMatch(/Drag a card/);
  const select = container.querySelector("select");
  act(() => { select.value = "suit"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(container.querySelector('[data-testid="hand-arrange-toggle"]')).toBeNull();
  expect(container.querySelector(".hand-cards-shell").dataset.arranging).toBeUndefined();
});
