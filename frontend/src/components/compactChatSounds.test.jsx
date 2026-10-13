import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ChatPanel } from "./ChatPanel";
import { I18nScope } from "../i18n/I18nProvider";
import { CHAT_SOUNDS } from "../game/chat";
import { sfx, unlockSound } from "../game/sound";

jest.mock("../game/sound", () => ({ sfx: { chatSound: jest.fn() }, unlockSound: jest.fn(), getSoundTheme: jest.fn(() => "street"), setSoundTheme: jest.fn() }));

let container, root;
const view = { code: "SOUND", yourSeat: 0, players: [{ seat: 0, name: "Nia", isBot: false }], chatMessages: [] };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const renderChat = ({ current = view, actions = {}, language = "de" } = {}) => {
  const calls = { sendChat: jest.fn(), sendChatSound: jest.fn(), ...actions };
  act(() => root.render(<I18nScope language={language}><ChatPanel view={current} actions={calls} /></I18nScope>));
  return calls;
};
const click = element => act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));

test("twelve localized sound controls start inside one collapsed palette", () => {
  renderChat();
  const palette = container.querySelector('[data-testid="chat-sound-palette"]');
  expect(palette.tagName).toBe("DETAILS");
  expect(palette.open).toBe(false);
  expect(palette.querySelector("summary").textContent).toBe("Sounds (12)");
  expect(palette.querySelectorAll("button").length).toBe(12);
  for (const sound of CHAT_SOUNDS) {
    const button = palette.querySelector(`[data-testid="chat-sound-${sound.id}"]`);
    expect(button.getAttribute("aria-label")).not.toContain("chat.");
    expect(button.getAttribute("title")).toBe(button.getAttribute("aria-label"));
    expect(button.textContent).not.toContain("chat.");
  }
});

test("sending each compact cue unlocks mobile sound and sends one allowlisted ID", () => {
  const actions = renderChat({ language: "en" });
  for (const sound of CHAT_SOUNDS) click(container.querySelector(`[data-testid="chat-sound-${sound.id}"]`));
  expect(unlockSound).toHaveBeenCalledTimes(12);
  expect(actions.sendChatSound.mock.calls).toEqual(CHAT_SOUNDS.map(sound => [sound.id]));
  expect(sfx.chatSound).not.toHaveBeenCalled(); // Playback is driven by the received room message.
});

test("busy controls cannot send and spectators never receive a sound palette", () => {
  const actions = renderChat({ actions: { chatBusy: true } });
  for (const sound of CHAT_SOUNDS) {
    const button = container.querySelector(`[data-testid="chat-sound-${sound.id}"]`);
    expect(button.disabled).toBe(true);
    click(button);
  }
  expect(actions.sendChatSound).not.toHaveBeenCalled();
  renderChat({ current: { ...view, yourSeat: null, isSpectator: true } });
  expect(container.querySelector('[data-testid="chat-sound-palette"]')).toBeNull();
});

test("all new sound messages display localized replay controls without remote media", () => {
  const chatMessages = CHAT_SOUNDS.map(sound => ({ id: sound.id, seat: 0, name: "Nia", sound: sound.id, text: "", createdAt: Date.now() }));
  renderChat({ current: { ...view, chatMessages }, language: "en" });
  for (const sound of CHAT_SOUNDS) {
    const replay = container.querySelector(`[data-testid="chat-replay-${sound.id}"]`);
    expect(replay.textContent).not.toContain("chat.");
    click(replay);
  }
  expect(unlockSound).toHaveBeenCalledTimes(12);
  expect(sfx.chatSound.mock.calls).toEqual(CHAT_SOUNDS.map(sound => [sound.id]));
  expect(container.querySelector("audio, video, iframe")).toBeNull();
});
