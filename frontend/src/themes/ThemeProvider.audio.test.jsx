import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./ThemeProvider";
import { getSoundTheme, isSoundEnabled, setSoundEnabled, setSoundTheme } from "../game/sound";

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  setSoundTheme("street"); setSoundEnabled(true);
  delete document.documentElement.dataset.gameTheme;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount()); container.remove();
  setSoundTheme("street"); setSoundEnabled(true);
  delete document.documentElement.dataset.gameTheme;
});
const render = element => act(() => root.render(element));

test("visual theme and audio palette change together, without changing mute", () => {
  setSoundEnabled(false);
  for (const theme of ["animal", "space", "street", "animal"]) {
    render(<ThemeProvider theme={theme}><span>Game</span></ThemeProvider>);
    expect(getSoundTheme()).toBe(theme);
    expect(document.documentElement.dataset.gameTheme).toBe(theme);
    expect(isSoundEnabled()).toBe(false);
  }
  render(<span>Home</span>);
  expect(getSoundTheme()).toBe("street");
  expect(document.documentElement.dataset.gameTheme).toBeUndefined();
  expect(isSoundEnabled()).toBe(false);
});

test("the innermost room controls audio even when the outer theme changes", () => {
  const nested = outer => <ThemeProvider theme={outer}><ThemeProvider theme="space"><span>Room</span></ThemeProvider></ThemeProvider>;
  render(nested("animal"));
  expect(getSoundTheme()).toBe("space");
  render(nested("street"));
  expect(getSoundTheme()).toBe("space");
  expect(document.documentElement.dataset.gameTheme).toBe("space");
  render(<ThemeProvider theme="animal"><span>Setup</span></ThemeProvider>);
  expect(getSoundTheme()).toBe("animal");
  render(<span>Home</span>);
  expect(getSoundTheme()).toBe("street");
});

test("strict-mode mounting and cleanup restore the pre-existing sound palette", () => {
  setSoundTheme("space");
  document.documentElement.dataset.gameTheme = "outside";
  render(<StrictMode><ThemeProvider theme="animal"><span>Game</span></ThemeProvider></StrictMode>);
  expect(getSoundTheme()).toBe("animal");
  render(<span>Exit</span>);
  expect(getSoundTheme()).toBe("space");
  expect(document.documentElement.dataset.gameTheme).toBe("outside");
});

test("invalid themes safely select the original Street palette", () => {
  setSoundTheme("__proto__"); expect(getSoundTheme()).toBe("street");
  render(<ThemeProvider theme="constructor"><span>Game</span></ThemeProvider>);
  expect(getSoundTheme()).toBe("street");
  expect(document.documentElement.dataset.gameTheme).toBe("street");
});
