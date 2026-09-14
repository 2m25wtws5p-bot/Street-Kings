import { useCallback, useEffect, useRef, useState } from "react";
import { roomApi } from "./api";

export function useOnlineGame(code, token) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const poll = useCallback(async () => {
    if (!code) return;
    try {
      const v = await roomApi.get(code, tokenRef.current);
      setView(v);
      setError(null);
    } catch (e) {
      setError(e?.response?.status || "error");
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    poll();
    const id = setInterval(poll, 1300);
    return () => clearInterval(id);
  }, [code, poll]);

  const doAction = useCallback(
    async (payload) => {
      try {
        const v = await roomApi.action(code, tokenRef.current, payload);
        setView(v);
      } catch (e) {
        poll();
      }
    },
    [code, poll]
  );

  return {
    view,
    error,
    poll,
    pass: (cards) => doAction({ type: "pass", cards }),
    play: (cardId) => doAction({ type: "play", cardId }),
    continueTrick: () => doAction({ type: "continueTrick" }),
    nextRound: () => doAction({ type: "nextRound" }),
    start: () => roomApi.start(code, tokenRef.current).then(setView).catch(poll),
    addBot: () => roomApi.bots(code, tokenRef.current, "add").then(setView).catch(poll),
    removeBot: () => roomApi.bots(code, tokenRef.current, "remove").then(setView).catch(poll),
    replaceWithBot: (seat) => roomApi.replace(code, tokenRef.current, seat).then(setView).catch(poll),
    rematch: () => roomApi.rematch(code, tokenRef.current).then(setView).catch(poll),
  };
}
