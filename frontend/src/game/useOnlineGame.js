import { useCallback, useEffect, useRef, useState } from "react";
import { roomApi, onlineErrorMessage } from "./api";

const configuredPollMs = Number(process.env.REACT_APP_GAME_POLL_MS);
const pollMs = Number.isFinite(configuredPollMs) && configuredPollMs >= 500 ? configuredPollMs : 650;

export function useOnlineGame(code, token) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(null);
  const viewIdentity = useRef(null);
  const session = useRef(null);
  // Change identity during render: even a response that settles before effects
  // run must not reveal another token's hand (including the same room code).
  if (!session.current || session.current.code !== code || session.current.token !== token) {
    session.current = { code, token, version: -1, polling: false, action: false, chat: false, lastChatAt: null, disposed: false, presence: null, presenceSending: null };
  }
  const identity = session.current;
  const current = useCallback((request) => session.current === request && !request.disposed, []);

  useEffect(() => {
    identity.disposed = false;
    setView(null); setError(null); setActionError(null); setBusy(false); setChatBusy(false); setChatError(null);
    return () => {
      identity.disposed = true;
      identity.pollController?.abort();
      identity.pollController = null;
      identity.polling = false;
    };
  }, [identity]);

  const acceptView = useCallback((value, request) => {
    if (!current(request) || !value || value.code !== request.code) return false;
    const version = value.version ?? 0;
    if (!Number.isFinite(version) || version < request.version) return false;
    request.version = version;
    viewIdentity.current = request;
    setView(value);
    return true;
  }, [current]);

  const poll = useCallback(async () => {
    const request = identity;
    if (!request.code || !request.token || request.polling || !current(request)) return;
    request.polling = true;
    const controller = new AbortController();
    request.pollController = controller;
    try {
      const value = await roomApi.get(request.code, request.token, { signal: controller.signal });
      if (current(request)) {
        acceptView(value, request);
        setError(null);
      }
    } catch (failure) {
      if (current(request) && !controller.signal.aborted) setError(onlineErrorMessage(failure));
    } finally {
      if (request.pollController === controller) {
        request.pollController = null;
        request.polling = false;
      }
    }
  }, [identity, current, acceptView]);

  useEffect(() => {
    if (!code || !token) return;
    poll();
    const timer = setInterval(poll, pollMs);
    return () => clearInterval(timer);
  }, [code, token, poll]);

  const runAction = useCallback(async (send, presence = false) => {
    const request = identity;
    if (!current(request) || !request.code || !request.token || (!presence && request.action)) return false;
    if (!presence) { request.action = true; setBusy(true); setActionError(null); }
    try {
      const value = await send(request.code, request.token);
      if (!current(request)) return false;
      acceptView(value, request);
      if (!presence) setActionError(null);
      return true;
    } catch (failure) {
      if (current(request) && !presence) setActionError(onlineErrorMessage(failure));
      // Keep the last good table and selection mounted; recover in the background.
      if (current(request)) poll();
      return false;
    } finally {
      if (!presence) {
        request.action = false;
        if (current(request)) setBusy(false);
      }
    }
  }, [identity, current, acceptView, poll]);

  // Chat has its own submission lock. A slow send cannot stop a card action,
  // abort polling, or overwrite a newer table received from another request.
  const sendChat = useCallback(async (text) => {
    const request = identity;
    if (!current(request) || !request.code || !request.token || request.chat) return false;
    const message = typeof text === "string" ? text.replace(/\r\n|[\r\n\t\u2028\u2029]/g, " ").trim() : "";
    if (!message || Array.from(message).length > 140) {
      setChatError("Schreib eine Nachricht mit höchstens 140 Zeichen.");
      return false;
    }
    if (request.lastChatAt != null && Date.now() - request.lastChatAt < 1500) {
      setChatError("Warte kurz vor deiner nächsten Nachricht (1,5 Sekunden).");
      return false;
    }
    const sentAt = Date.now();
    request.chat = true; setChatBusy(true); setChatError(null);
    try {
      const value = await roomApi.chat(request.code, request.token, message);
      if (!current(request)) return false;
      request.lastChatAt = sentAt;
      acceptView(value, request);
      return true;
    } catch (failure) {
      if (current(request)) setChatError(onlineErrorMessage(failure));
      return false;
    } finally {
      request.chat = false;
      if (current(request)) setChatBusy(false);
    }
  }, [identity, current, acceptView]);

  const doAction = (payload, presence = false) => runAction((room, auth) => roomApi.action(room, auth, payload), presence);
  const reviewLastTrick = (reviewing) => {
    const request = identity;
    request.presence = !!reviewing;
    if (request.presenceSending) return request.presenceSending;
    // Preserve open/close order without queuing an unbounded number of heartbeats
    // on a slow network, and independently of gameplay's submission lock.
    request.presenceSending = (async () => {
      while (request.presence != null && current(request)) {
        const intent = request.presence;
        request.presence = null;
        await doAction({ type: "reviewLastTrick", reviewing: intent }, true);
      }
    })().finally(() => { request.presenceSending = null; });
    return request.presenceSending;
  };
  return {
    view: viewIdentity.current === identity ? view : null,
    error, actionError, busy, poll, chatBusy, chatError, sendChat,
    dismissActionError: () => setActionError(null),
    pass: (cards) => doAction({ type: "pass", cards }),
    play: (cardId) => doAction({ type: "play", cardId }),
    continueTrick: () => doAction({ type: "continueTrick" }),
    nextRound: () => doAction({ type: "nextRound" }),
    // Presence updates must not block or cancel actual game actions.
    reviewLastTrick,
    start: () => runAction(roomApi.start),
    addBot: () => runAction((room, auth) => roomApi.bots(room, auth, "add")),
    removeBot: () => runAction((room, auth) => roomApi.bots(room, auth, "remove")),
    replaceWithBot: (seat) => runAction((room, auth) => roomApi.replace(room, auth, seat)),
    rematch: () => runAction(roomApi.rematch),
  };
}
