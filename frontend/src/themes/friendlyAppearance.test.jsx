import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { ThemeProvider } from "./ThemeProvider";
import { CardView } from "../components/CardView";
import { LeadSuitIndicator } from "../components/LeadSuitIndicator";
import { SelectedCards } from "../components/SelectedCards";
import { PlayerIdentity } from "../components/PlayerIdentity";
import { SUITS } from "../game/constants";

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });
const render = (element, theme = "animal", language = "de") => act(() => root.render(
  <I18nScope language={language}><ThemeProvider theme={theme}>{element}</ThemeProvider></I18nScope>));
const noStreetSymbols = () => expect(container.querySelectorAll(
  ".lucide-siren,.lucide-flame,.lucide-banknote,.lucide-venetian-mask,.lucide-package,.lucide-footprints,.lucide-triangle-alert,.lucide-coins,.lucide-gem,.lucide-handshake"
)).toHaveLength(0);
const suits = [
  ["RED", "sun", "siren", "Trubel", "Mischief"],
  ["YELLOW", "cookie", "venetian-mask", "Leckereien", "Treats"],
  ["BLUE", "droplets", "banknote", "Wasser", "Water"],
  ["GREEN", "leaf", "package", "Garten", "Garden"],
];

test.each(suits)("%s cards change icons and artwork, never suit, value or printed dimensions", (suit, animalIcon, streetIcon, label) => {
  const card = Object.freeze({ id: `${suit}-4`, suit, value: 4 });
  const unchanged = JSON.stringify(card);
  const props = { card, size: "lg", testId: `card-${card.id}` };
  render(<CardView {...props} />);
  const animal = container.querySelector(".street-card");
  expect(animal.dataset.suit).toBe(suit); expect(animal.dataset.cardSize).toBe("lg");
  expect(animal.querySelector(".card-pip-top > span").textContent).toBe("4");
  expect(animal.querySelector(`.lucide-${animalIcon}`)).not.toBeNull(); noStreetSymbols();
  expect(animal.querySelector("[data-animal-art]").dataset.animalArt).toBe(suit);
  expect(animal.getAttribute("aria-label")).toContain(`${label} 4`);
  const presentation = { className: animal.className, border: animal.style.border, color: animal.style.getPropertyValue("--suit-accent") };
  render(<CardView {...props} />, "street");
  const street = container.querySelector(".street-card");
  expect(street.dataset.suit).toBe(suit); expect(street.dataset.cardSize).toBe("lg");
  expect(street.querySelector(`.lucide-${streetIcon}`)).not.toBeNull();
  expect(street.querySelector("img.card-art")).not.toBeNull();
  expect(street.querySelector("[data-animal-art]")).toBeNull();
  expect(street.querySelector(".card-pip-top > span").textContent).toBe("4");
  expect({ className: street.className, border: street.style.border, color: street.style.getPropertyValue("--suit-accent") }).toEqual(presentation);
  expect(JSON.stringify(card)).toBe(unchanged);
});

test("the suitless zero card uses a rabbit only in Animal, retaining its canonical identity", () => {
  const card = Object.freeze({ id: "W1", suit: null, value: 0, special: "runner" });
  render(<CardView card={card} testId="zero-card" />);
  expect(container.querySelector(".street-card").dataset.suit).toBe("NEUTRAL");
  expect(container.querySelector(".card-pip-top > span").textContent).toBe("0");
  expect(container.querySelector(".lucide-rabbit")).not.toBeNull(); noStreetSymbols();
  expect(container.querySelector("[data-animal-art]").dataset.animalArt).toBe("runner");
  expect(container.textContent).toContain("Hoppelhase");
  render(<CardView card={card} testId="zero-card" />, "street");
  expect(container.querySelector(".lucide-footprints")).not.toBeNull();
  expect(container.querySelector(".lucide-rabbit")).toBeNull();
  expect(container.textContent).toContain("Laufjunge");
  expect(card).toEqual({ id: "W1", suit: null, value: 0, special: "runner" });
});

test.each([
  ["kingpin", "RED", 11, "sparkles", "triangle-alert", "×2"],
  ["informant", "GREEN", 11, "sparkles", "triangle-alert", "+5"],
  ["godmother", "GREEN", 12, "sparkles", "triangle-alert", "+10"],
  ["briber", "YELLOW", 11, "heart", "shield-check", "−5"],
  ["fixer", "BLUE", 11, "heart", "shield-check", "Ø"],
  ["runner", null, 0, "rabbit", "footprints", "0"],
])("%s special badges keep the same numeric effect while replacing only theme symbols", (special, suit, value, animalIcon, streetIcon, effect) => {
  const card = Object.freeze({ id: suit ? `${suit}-${value}` : "W2", suit, value, special });
  for (const [theme, expectedIcon] of [["animal", animalIcon], ["street", streetIcon]]) {
    render(<CardView card={card} testId={`special-${card.id}`} />, theme, "en");
    const element = container.querySelector(".street-card");
    expect(element.dataset.suit).toBe(suit || "NEUTRAL");
    expect(element.querySelector(".card-pip-top > span").textContent).toBe(String(value));
    expect(element.querySelector(`.card-special-stamp .lucide-${expectedIcon}`)).not.toBeNull();
    expect(element.querySelector(".card-hand-effect b").textContent).toBe(effect);
    if (theme === "animal") noStreetSymbols();
  }
  expect(card.special).toBe(special); expect(card.value).toBe(value);
});

test.each(suits)("%s led-suit marker shares the friendly icon and remains mechanically identical", (suit, animalIcon, streetIcon, _label, englishLabel) => {
  render(<LeadSuitIndicator suit={suit} />, "animal", "en");
  const animal = container.querySelector('[data-testid="active-lead-suit-indicator"]');
  expect(animal.dataset.suit).toBe(suit);
  expect(animal.style.getPropertyValue("--lead-color")).toBe(SUITS[suit].primary);
  expect(animal.querySelector(`.lucide-${animalIcon}`)).not.toBeNull(); noStreetSymbols();
  expect(animal.getAttribute("aria-label")).toBe(`Led suit: ${englishLabel}`);
  render(<LeadSuitIndicator suit={suit} />, "street", "en");
  const street = container.querySelector('[data-testid="active-lead-suit-indicator"]');
  expect(street.dataset.suit).toBe(suit);
  expect(street.style.getPropertyValue("--lead-color")).toBe(SUITS[suit].primary);
  expect(street.querySelector(`.lucide-${streetIcon}`)).not.toBeNull();
});

test("compact selection tokens switch icons without changing their slots, identities or removal callback", () => {
  const hand = Object.freeze([
    ...suits.map(([suit], index) => Object.freeze({ id: `${suit}-${index + 1}`, suit, value: index + 1 })),
    Object.freeze({ id: "W3", suit: null, value: 0, special: "runner" }),
  ]);
  const selected = Object.freeze(hand.map(card => card.id));
  const remove = jest.fn();
  for (const theme of ["animal", "street"]) {
    render(<SelectedCards hand={hand} selected={selected} count={5} onRemove={remove} />, theme);
    const tokens = [...container.querySelectorAll(".selected-card-token")];
    expect(container.querySelectorAll(".selected-card-token-slot")).toHaveLength(5);
    expect(tokens.map(token => token.dataset.suit)).toEqual(["RED", "YELLOW", "BLUE", "GREEN", "NEUTRAL"]);
    expect(tokens.map(token => token.querySelector("b").textContent)).toEqual(["1", "2", "3", "4", "0"]);
    const icons = theme === "animal" ? ["sun", "cookie", "droplets", "leaf", "rabbit"] : ["siren", "venetian-mask", "banknote", "package", "footprints"];
    tokens.forEach((token, index) => expect(token.querySelector(`.lucide-${icons[index]}`)).not.toBeNull());
    if (theme === "animal") noStreetSymbols();
    expect(remove).toHaveBeenCalledTimes(theme === "animal" ? 0 : 1);
    act(() => tokens[2].click());
    expect(remove).toHaveBeenLastCalledWith("BLUE-3");
  }
  expect(remove).toHaveBeenCalledTimes(2);
  expect(selected).toEqual(hand.map(card => card.id));
});

test("mounted face-down/face-up and theme changes preserve hook order and event handlers", () => {
  const card = Object.freeze({ id: "RED-11", suit: "RED", value: 11, special: "kingpin" });
  const click = jest.fn(), pointer = jest.fn();
  const errors = jest.spyOn(console, "error");
  for (const [theme, faceDown] of [["street", true], ["animal", true], ["animal", false], ["street", false], ["animal", true], ["animal", false]]) {
    expect(() => render(<CardView card={card} faceDown={faceDown} onClick={click} onPointerDown={pointer} testId="mounted-card" />, theme)).not.toThrow();
    const element = container.querySelector('[data-testid="mounted-card"]');
    expect(element).not.toBeNull();
    expect(element.classList.contains(faceDown ? "street-card-back" : "street-card")).toBe(true);
    if (faceDown && theme === "animal") expect(element.querySelector(".lucide-paw-print")).not.toBeNull();
    if (!faceDown) expect(element.querySelector(".card-pip-top > span").textContent).toBe("11");
  }
  expect(click).not.toHaveBeenCalled(); expect(pointer).not.toHaveBeenCalled();
  const element = container.querySelector('[data-testid="mounted-card"]');
  act(() => { element.dispatchEvent(new Event("pointerdown", { bubbles: true })); element.click(); });
  expect(pointer).toHaveBeenCalledTimes(1); expect(click).toHaveBeenCalledTimes(1);
  expect(pointer.mock.calls[0][0].type).toBe("pointerdown");
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/rendered more hooks|rendered fewer hooks|change in the order of hooks/i);
});

test("player points use friendly sparkles only in Animal, retaining names and point/card counts", () => {
  const name = "Flame Cash Straße";
  render(<PlayerIdentity name={name} heat={12} cards={7} />);
  expect(container.querySelector(".lucide-sparkles")).not.toBeNull(); noStreetSymbols();
  expect(container.querySelector(".crew-heat").getAttribute("aria-label")).toBe("12 Trubel");
  expect(container.querySelector(".crew-name").textContent).toBe(name);
  expect(container.querySelector(".crew-card-count").textContent).toBe("7");
  render(<PlayerIdentity name={name} heat={12} cards={7} />, "street");
  expect(container.querySelector(".lucide-flame")).not.toBeNull();
  expect(container.querySelector(".lucide-sparkles")).toBeNull();
  expect(container.querySelector(".crew-heat").getAttribute("aria-label")).toBe("12 Hitze");
  expect(container.querySelector(".crew-name").textContent).toBe(name);
});
