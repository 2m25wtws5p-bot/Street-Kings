import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { SelectedCards } from "./SelectedCards";

let container, root;
const hand = [
  { id:"RED-11", suit:"RED", value:11, special:"fire" },
  { id:"GREEN-12", suit:"GREEN", value:12, special:"pygmy" },
  { id:"BLUE-4", suit:"BLUE", value:4 },
  { id:"W1", suit:null, value:0, special:"wizard" },
];
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (selected, remove = () => {}, language = "de") => act(() => root.render(
  <I18nScope language={language}><SelectedCards hand={hand} selected={selected} count={4} onRemove={remove} /></I18nScope>));

test("empty and selected exchanges share four compact slots, not duplicated card art", () => {
  render([]);
  expect(container.querySelectorAll(".selected-card-token-slot")).toHaveLength(4);
  expect(container.querySelectorAll(".selected-card-token-empty")).toHaveLength(4);
  render(hand.map(card => card.id));
  expect(container.querySelectorAll(".selected-card-token-slot")).toHaveLength(4);
  expect(container.querySelectorAll(".selected-card-token")).toHaveLength(4);
  expect(container.querySelectorAll(".street-card, img")).toHaveLength(0);
  expect(container.textContent).toContain("4/4");
});
test("compact tokens retain each suit/rank and remove only the clicked identity", () => {
  const remove = jest.fn(); render(hand.map(card => card.id), remove);
  const tokens = [...container.querySelectorAll(".selected-card-token")];
  expect(tokens.map(token => token.dataset.suit)).toEqual(["RED","GREEN","BLUE","NEUTRAL"]);
  expect(tokens.map(token => token.querySelector("b").textContent)).toEqual(["11","12","4","0"]);
  act(() => tokens[1].click());
  expect(remove).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledWith("GREEN-12");
});
test("selection removal labels respect personal English without changing card IDs", () => {
  render(["GREEN-12"], () => {}, "en");
  const token = container.querySelector("button");
  expect(token.dataset.testid).toBe("selected-card-GREEN-12");
  expect(token.getAttribute("aria-label")).toMatch(/^Remove .*12.*Godmother.* from selection$/);
});
test("a stale selection from a different hand cannot render or remove a foreign card", () => {
  const remove = jest.fn(); render(["foreign"], remove);
  expect(container.querySelectorAll("button")).toHaveLength(0);
  expect(container.querySelectorAll(".selected-card-token-empty")).toHaveLength(4);
  expect(remove).not.toHaveBeenCalled();
});
