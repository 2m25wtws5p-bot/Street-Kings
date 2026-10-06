import { useCallback, useEffect, useRef, useState } from "react";
import { roomApi, onlineErrorMessage } from "./api";

const configuredPollMs = Number(process.env.REACT_APP_GAME_POLL_MS);
const pollMs = Number.isFinite(configuredPollMs) && configuredPollMs >= 500 ? configuredPollMs : 650;

export function useOnlineGame(code, token) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const tokenRef = useRef(token);
  const codeRef = useRef(code);
  const polling = useRef(false);
  const versionRef = useRef(-1);
  tokenRef.current = token;
  codeRef.current = code;
  useEffect(() => { versionRef.current = -1; setView(null); setError(null); }, [code, token]);

  const acceptView = useCallback((v) => {
    if (v.code !== codeRef.current) return;
    // A slow poll must not undo a newer action or another player's move.
    if ((v.version ?? 0) < versionRef.current) return;
    versionRef.current = v.version ?? 0;
    setView(v);
  }, []);

  const poll = useCallback(async () => {
    if (!code || polling.current) return;
    polling.current = true;
    try {
      const v = await roomApi.get(code, tokenRef.current);
      acceptView(v);
      setError(null);
    } catch (e) {
      setError(onlineErrorMessage(e));
    } finally {
      polling.current = false;
    }
  }, [code, acceptView]);

  useEffect(() => {
    if (!code) return;
    poll();
    const id = setInterval(poll, pollMs);
    return () => clearInterval(id);
  }, [code, poll]);

  const doAction = useCallback(
    async (payload) => {
      try {
        const v = await roomApi.action(code, tokenRef.current, payload);
        acceptView(v);
      } catch (e) {
        poll();
      }
    },
    [code, poll, acceptView]
  );

  return {
    view,
    error,
    poll,
    pass: (cards) => doAction({ type: "pass", cards }),
    play: (cardId) => doAction({ type: "play", cardId }),
    continueTrick: () => doAction({ type: "continueTrick" }),
    nextRound: () => doAction({ type: "nextRound" }),
    reviewLastTrick: (reviewing) => doAction({ type: "reviewLastTrick", reviewing }),
    start: () => roomApi.start(code, tokenRef.current).then(acceptView).catch(poll),
    addBot: () => roomApi.bots(code, tokenRef.current, "add").then(acceptView).catch(poll),
    removeBot: () => roomApi.bots(code, tokenRef.current, "remove").then(acceptView).catch(poll),
    replaceWithBot: (seat) => roomApi.replace(code, tokenRef.current, seat).then(acceptView).catch(poll),
    rematch: () => roomApi.rematch(code, tokenRef.current).then(acceptView).catch(poll),
  };
}

