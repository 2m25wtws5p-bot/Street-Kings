import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { TurnStatus } from "./TurnStatus";

let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = (props, language = "de") => act(() => root.render(
  <I18nScope language={language}><TurnStatus {...props} /></I18nScope>
));

test.each([
  ["waiting", "Du wartest", "Milo ist am Zug"],
  ["active", "Du bist dran", "Wähle deine Karte"],
  ["complete", "Stich beendet", "Nia kassiert den Stich"],
])("%s has its own state symbol without hiding readable status text", (state, title, subtitle) => {
  render({ state, title, subtitle });
  const card = container.querySelector('[data-testid="turn-status"]');
  expect(card.dataset.state).toBe(state);
  expect(card.classList.contains("turn-clarity")).toBe(true);
  expect(card.querySelector(".turn-status-title").textContent).toBe(title);
  expect(card.querySelector(".turn-status-subtitle").textContent).toBe(subtitle);
  const icon = card.querySelector(`[data-testid="turn-status-icon-${state}"]`);
  expect(icon.getAttribute("aria-hidden")).toBe("true");
  expect(card.querySelectorAll(".turn-status-icon")).toHaveLength(1);
});

test("state changes keep one status footprint and preserve the existing action", () => {
  const onCollect = jest.fn();
  render({ state: "waiting", title: "Waiting", subtitle: "Milo's turn" }, "en");
  const original = container.querySelector('[data-testid="turn-status"]');
  render({ state: "active", title: "Your turn", subtitle: "Choose a card" }, "en");
  expect(container.querySelector('[data-testid="turn-status"]')).toBe(original);
  expect(container.querySelector('[data-testid="turn-status-icon-waiting"]')).toBeNull();
  render({ state: "complete", title: "Trick complete", subtitle: "You won", children: <button onClick={onCollect}>Collect</button> }, "en");
  expect(container.querySelector('[data-testid="turn-status"]')).toBe(original);
  act(() => container.querySelector("button").click());
  expect(onCollect).toHaveBeenCalledTimes(1);
});

test("only an active turn repeats the localized reminder; confirmation hides its duplicate message", () => {
  render({ state: "active", title: "Your turn", reminderCount: 2 }, "en");
  expect(container.querySelector('[data-testid="turn-reminder-pulse"]')).not.toBeNull();
  expect(container.querySelector('[role="status"]').textContent.length).toBeGreaterThan(0);
  expect(container.querySelector(".turn-reminder-message")).not.toBeNull();
  render({ state: "active", title: "Your turn", reminderCount: 3, confirming: true }, "en");
  expect(container.querySelector(".turn-reminder-message")).toBeNull();
  expect(container.querySelector('[role="status"]').textContent.length).toBeGreaterThan(0);
  for (const state of ["waiting", "complete"]) {
    render({ state, title: state, reminderCount: 3 }, "en");
    expect(container.querySelector('[data-testid="turn-reminder-pulse"]')).toBeNull();
    expect(container.querySelector('[role="status"]').textContent).toBe("");
  }
});
