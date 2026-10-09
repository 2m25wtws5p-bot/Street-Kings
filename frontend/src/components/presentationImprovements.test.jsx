import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { SPECIAL_MAP } from "../game/constants";
import { PlayOrder } from "./PlayOrder";
import { RoundScores } from "./RoundScores";
import { RulesDialog } from "./RulesDialog";
import { SpecialCardReference } from "./SpecialCardReference";

jest.mock("../game/sound", () => ({ sfx: { witchReveal: jest.fn(), select: jest.fn(), reveal: jest.fn() } }));

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

const render = (element, language = "de") => act(() => root.render(<I18nScope language={language}>{element}</I18nScope>));
const players = count => Array.from({ length: count }, (_, seat) => ({ name: `Crew ${seat + 1}`, avatar: { key: "boss", color: "#facc15" }, isBot: seat === count - 1 }));
const state = (count = 3) => ({
  players: players(count), scores: Array(count).fill(12), roundIndex: 0,
  roundResult: { shooter: -1, results: Array.from({ length: count }, () => ({ total: 0, fireCards: 2, fireWitch: true, water: true, pygmy: true, air: true, earth: true })) },
});

test.each([3, 4, 5, 6])("play order exposes every seat and the active crew with %i crews", count => {
  const crews = players(count);
  render(<PlayOrder players={crews} currentSeat={count - 1} />);
  const items = [...container.querySelectorAll("ol > li")];
  expect(items).toHaveLength(count);
  expect(items.map(item => Number(item.dataset.orderSeat))).toEqual(crews.map((_, index) => index));
  expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  expect(items.at(-1).getAttribute("aria-current")).toBe("step");
  expect(container.textContent).toContain(`Crew ${count} ist am Zug`);
  render(<PlayOrder players={crews} currentSeat={0} />);
  expect(container.querySelector('[aria-current="step"]').dataset.orderSeat).toBe("0");
  expect(container.querySelectorAll("ol > li")).toHaveLength(count);
});

test("reference artwork retains the deck's actual special suit and rank", () => {
  for (const [cardKey, identity] of Object.entries({ ...SPECIAL_MAP, wizard: { suit: null, value: 0 } })) {
    render(<SpecialCardReference cardKey={cardKey} />);
    const card = container.querySelector(".street-card");
    expect(card.dataset.suit).toBe(identity.suit || "NEUTRAL");
    expect(card.querySelector(".card-pip-top").textContent).toBe(String(identity.value));
    expect(card.querySelector("img.card-art")).not.toBeNull();
  }
});

test("all six rules show their full card artwork with readable localized explanations", () => {
  render(<RulesDialog open onOpenChange={() => {}} />, "en");
  const rows = [...document.querySelectorAll("[data-rule-card]")];
  expect(rows.map(row => row.dataset.ruleCard)).toEqual(["fire", "water", "pygmy", "air", "earth", "wizard"]);
  for (const row of rows) {
    expect(row.querySelector("img.card-art")).not.toBeNull();
    expect(row.querySelector(".rule-special-copy p").textContent.length).toBeGreaterThan(20);
  }
  expect(rows.find(row => row.dataset.ruleCard === "pygmy").querySelector(".street-card").dataset.suit).toBe("GREEN");
  expect(document.querySelector('[data-testid="rules-dialog"]').textContent).toContain("Godmother");
});

test("score explanations show all captured special identities without changing authoritative totals", () => {
  render(<RoundScores state={state()} onReady={() => {}} />);
  const score = container.querySelector('[data-testid="score-row-player-0"]');
  for (const cardKey of ["fire", "water", "pygmy", "air", "earth"]) {
    expect(score.querySelector(`[data-score-step="${cardKey}"] [data-reference-card="${cardKey}"] img.card-art`)).not.toBeNull();
  }
  expect(score.querySelector("[data-score-total]").dataset.scoreTotal).toBe("0");
  expect(score.querySelector('[data-testid="score-ledger-player-0"]').textContent).toContain("12 + 0 = 12");
});

test("hotseat readies only the selected human and requires a separate confirmation from each", () => {
  const onReady = jest.fn();
  const onNext = jest.fn();
  const snapshot = state(4);
  render(<RoundScores state={snapshot} readySeats={[false, false, false, true]} onReady={onReady} onNext={onNext} />);
  expect(container.querySelectorAll('[data-testid^="btn-ready-player-"]')).toHaveLength(3);
  expect(container.querySelector('[data-testid="btn-start-next-round"]')).toBeNull();
  act(() => container.querySelector('[data-testid="btn-ready-player-1"]').click());
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledWith(1);
  expect(onNext).not.toHaveBeenCalled();
  render(<RoundScores state={snapshot} readySeats={[false, true, false, true]} onReady={onReady} />);
  expect(container.querySelector('[data-testid="btn-ready-player-1"]')).toBeNull();
  expect(container.querySelector('[data-testid="round-ready-status"]').textContent).toBe("1 von 3 Mitspielern bereit");
  expect(container.querySelector('[data-testid="round-ready-player-3"]').dataset.ready).toBe("true");
});

test("online readiness only confirms the viewer; spectators and repeated ready clicks cannot start a round", () => {
  const onNext = jest.fn();
  const snapshot = state();
  render(<RoundScores state={snapshot} readySeats={[false, false, true]} yourSeat={1} onNext={onNext} />);
  const ownButton = container.querySelector('[data-testid="btn-start-next-round"]');
  expect(ownButton.textContent).toBe("Ich bin bereit");
  act(() => ownButton.click());
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll('[data-testid^="btn-ready-player-"]')).toHaveLength(0);
  render(<RoundScores state={snapshot} readySeats={[false, true, true]} yourSeat={1} onNext={onNext} />);
  expect(container.querySelector('[data-testid="btn-start-next-round"]').disabled).toBe(true);
  act(() => container.querySelector('[data-testid="btn-start-next-round"]').click());
  expect(onNext).toHaveBeenCalledTimes(1);
  render(<RoundScores state={snapshot} readySeats={[false, true, true]} onNext={onNext} spectator />);
  expect(container.querySelectorAll("button")).toHaveLength(0);
  expect(container.querySelector('[data-testid="spectator-waiting-next-round"]')).not.toBeNull();
});

test("pending readiness requests disable confirmation", () => {
  render(<RoundScores state={state()} onReady={() => {}} busy />);
  for (const button of container.querySelectorAll("button")) expect(button.disabled).toBe(true);
});

test("host can replace only another offline human while awaiting readiness", () => {
  const snapshot = state(4);
  snapshot.players = snapshot.players.map((player, seat) => ({ ...player, connected: seat === 2 }));
  const onReplaceSeat = jest.fn();
  const onNext = jest.fn();
  const props = { state: snapshot, yourSeat: 0, onReplaceSeat, onNext };
  render(<RoundScores {...props} />);
  const buttons = [...container.querySelectorAll('[data-testid^="btn-replace-bot-"]')];
  expect(buttons).toHaveLength(1);
  expect(buttons[0].dataset.testid).toBe("btn-replace-bot-1");
  expect(buttons[0].textContent).toBe("Durch KI ersetzen");
  act(() => buttons[0].click());
  expect(onReplaceSeat).toHaveBeenCalledWith(1);
  expect(onNext).not.toHaveBeenCalled();
  render(<RoundScores {...props} busy />);
  expect(container.querySelector('[data-testid="btn-replace-bot-1"]').disabled).toBe(true);
  render(<RoundScores {...props} onReplaceSeat={undefined} />);
  expect(container.querySelector('[data-testid^="btn-replace-bot-"]')).toBeNull();
  render(<RoundScores {...props} spectator />);
  expect(container.querySelector('[data-testid^="btn-replace-bot-"]')).toBeNull();
  render(<RoundScores {...props} state={{ ...snapshot, scores: [70, 12, 12, 12] }} />);
  expect(container.querySelector('[data-testid^="btn-replace-bot-"]')).toBeNull();
  const crownButton = container.querySelector('[data-testid="btn-start-next-round"]');
  expect(crownButton.textContent).toBe("Street King krönen");
  act(() => crownButton.click());
  expect(onNext).toHaveBeenCalledTimes(1);
});
