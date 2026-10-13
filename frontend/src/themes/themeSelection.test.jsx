import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { I18nScope } from "../i18n/I18nProvider";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { ThemeSelector } from "./ThemeSelector";
import { SetupScreen } from "../components/SetupScreen";
import { Lobby } from "../components/OnlineFlow";
import { useOnlineGame } from "../game/useOnlineGame";
import { roomApi } from "../game/api";

jest.mock("../game/sound", () => ({ sfx: { select: jest.fn(), fanfare: jest.fn() }, getSoundTheme: jest.fn(() => "street"), setSoundTheme: jest.fn() }));

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  delete document.documentElement.dataset.gameTheme;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); delete document.documentElement.dataset.gameTheme; jest.restoreAllMocks(); });
const render = (element, language = "de") => act(() => root.render(<I18nScope language={language}>{element}</I18nScope>));
const click = node => act(() => node.click());
function Consumer() { const { theme } = useTheme(); return <span data-testid="consumed-theme">{theme}</span>; }

test("theme context and portal appearance follow the chosen room and clean up on exit", () => {
  document.documentElement.dataset.gameTheme = "outside";
  render(<ThemeProvider theme="animal"><Consumer />{createPortal(<Consumer />, document.body)}</ThemeProvider>);
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("animal");
  expect(document.documentElement.dataset.gameTheme).toBe("animal");
  expect(container.querySelector(".theme-surface").dataset.theme).toBe("animal");
  render(<ThemeProvider theme="street"><Consumer /></ThemeProvider>);
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("street");
  expect(document.documentElement.dataset.gameTheme).toBe("street");
  render(<span>Home</span>);
  expect(document.documentElement.dataset.gameTheme).toBe("outside");
});

test("unknown themes are safe and disabled controls cannot change them", () => {
  const onChange = jest.fn();
  render(<ThemeProvider theme="__proto__"><Consumer /><ThemeSelector theme="__proto__" onChange={onChange} disabled shared /></ThemeProvider>);
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("street");
  expect(container.querySelector('[data-testid="theme-selector-street"]').getAttribute("aria-pressed")).toBe("true");
  for (const button of container.querySelectorAll("button")) { expect(button.disabled).toBe(true); click(button); }
  expect(onChange).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Der Spielführer wählt");
});

test("a nested room theme wins over an outer default scope and restores on exit", () => {
  render(<ThemeProvider theme="street"><ThemeProvider theme="animal"><Consumer /></ThemeProvider></ThemeProvider>);
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("animal");
  expect(document.documentElement.dataset.gameTheme).toBe("animal");
  render(<ThemeProvider theme="street"><Consumer /></ThemeProvider>);
  expect(document.documentElement.dataset.gameTheme).toBe("street");
});

test("local host selects a theme before starting without modifying player count, language, or identities", () => {
  const onStart = jest.fn();
  function Setup() { const [theme, setTheme] = useState("street"); return <ThemeProvider theme={theme} onThemeChange={setTheme}><SetupScreen theme={theme} onThemeChange={setTheme} onStart={onStart} /></ThemeProvider>; }
  render(<Setup />);
  click(container.querySelector('[data-testid="local-theme-selector-animal"]'));
  expect(document.documentElement.dataset.gameTheme).toBe("animal");
  expect(container.querySelector('[data-testid="local-theme-selector-animal"]').getAttribute("aria-pressed")).toBe("true");
  click(container.querySelector('[data-testid="btn-start-street-game"]'));
  expect(onStart).toHaveBeenCalledTimes(1);
  const [players, options] = onStart.mock.calls[0];
  expect(options).toEqual({ theme: "animal" }); expect(players).toHaveLength(4);
  expect(players.every(player => player.language === "de" && typeof player.name === "string" && player.avatar.key)).toBe(true);
});

const room = { code: "ROOM", n: 3, theme: "street", yourSeat: 0, hostSeat: 0, isHost: true,
  players: Array.from({ length: 3 }, (_, seat) => ({ seat, name: `Crew ${seat}`, avatar: { key: "boss", color: "#abc" }, connected: true })) };
const actions = () => ({ setTheme: jest.fn(), addBot: jest.fn(), removeBot: jest.fn(), start: jest.fn(), busy: false });

test("only the lobby host can change the shared theme, with clear English labels", () => {
  const callbacks = actions();
  render(<ThemeProvider theme="street"><Lobby view={room} actions={callbacks} onLeave={() => {}} /></ThemeProvider>, "en");
  click(container.querySelector('[data-testid="lobby-theme-selector-animal"]'));
  expect(callbacks.setTheme).toHaveBeenCalledWith("animal");
  expect(container.textContent).toContain("For the whole room");
  render(<ThemeProvider theme="animal"><Lobby view={{ ...room, theme: "animal", isHost: false, yourSeat: 1 }} actions={callbacks} onLeave={() => {}} /></ThemeProvider>, "en");
  expect(container.querySelector('[data-testid="lobby-theme-selector-street"]').disabled).toBe(true);
  expect(container.querySelector('[data-testid="lobby-theme-selector-animal"]').getAttribute("aria-pressed")).toBe("true");
  click(container.querySelector('[data-testid="lobby-theme-selector-street"]'));
  expect(callbacks.setTheme).toHaveBeenCalledTimes(1);
});

test("spectators and busy hosts cannot change a theme, and an older room defaults safely", () => {
  const callbacks = actions();
  for (const view of [{ ...room, isSpectator: true }, { ...room, theme: undefined }]) {
    render(<ThemeProvider theme={view.theme}><Lobby view={view} actions={{ ...callbacks, busy: !view.isSpectator }} onLeave={() => {}} /></ThemeProvider>);
    expect(container.querySelector('[data-testid="lobby-theme-selector-street"]').getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="lobby-theme-selector-animal"]').disabled).toBe(true);
    click(container.querySelector('[data-testid="lobby-theme-selector-animal"]'));
  }
  expect(callbacks.setTheme).not.toHaveBeenCalled();
});

test("shared theme actions use the room token and authoritative responses update context", async () => {
  const view = { ...room, version: 1, status: "lobby", phase: "lobby" };
  const get = jest.spyOn(roomApi, "get").mockResolvedValue(view);
  const action = jest.spyOn(roomApi, "action").mockResolvedValue({ ...view, version: 2, theme: "animal" });
  let online;
  function RoomView() {
    online = useOnlineGame("ROOM", "host-token");
    return <ThemeProvider theme={online.view?.theme}><Consumer /></ThemeProvider>;
  }
  await act(async () => { root.render(<I18nScope language="de"><RoomView /></I18nScope>); });
  expect(get).toHaveBeenCalledWith("ROOM", "host-token", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("street");
  await act(async () => { await online.setTheme("animal"); });
  expect(action).toHaveBeenCalledWith("ROOM", "host-token", { type: "setTheme", theme: "animal" });
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("animal");
  expect(document.documentElement.dataset.gameTheme).toBe("animal");
  get.mockResolvedValue({ ...view, version: 1, theme: "street" });
  await act(async () => { await online.poll(); });
  expect(container.querySelector('[data-testid="consumed-theme"]').textContent).toBe("animal");
});
