import { useReducer, useCallback } from "react";
import {
  makeDeck,
  shuffle,
  deal,
  passInfo,
  targetSeat,
  resolveTrick,
  scoreRound,
  isGameOver,
  sortCards,
} from "./engine";

function newHands(n) {
  return deal(shuffle(makeDeck()), n);
}

function beginRound(base) {
  const { players, n, scores, roundIndex } = base;
  const hands = newHands(n);
  const piles = Array.from({ length: n }, () => []);
  const { count, dir } = passInfo(n, roundIndex);
  const common = {
    players,
    n,
    scores,
    roundIndex,
    totalRounds: base.totalRounds,
    hands,
    piles,
    trick: [],
    trickNumber: 1,
    roundResult: null,
    lastTrick: null,
    lastWinner: null,
    justPlayed: null,
  };
  if (count > 0 && dir !== 0) {
    return {
      ...common,
      phase: "passGate",
      passCount: count,
      passDir: dir,
      passSeat: 0,
      pendingSelections: [],
    };
  }
  return startTricks({ ...common, passCount: 0, passDir: 0 });
}

function applyPasses(hands, pending, dir, n, players) {
  const remaining = hands.map((h) => [...h]);
  const incoming = Array.from({ length: n }, () => []);
  for (let seat = 0; seat < n; seat++) {
    const sel = pending[seat] || [];
    const give = [];
    remaining[seat] = remaining[seat].filter((c) => {
      if (sel.includes(c.id)) {
        give.push({ ...c, receivedFrom: players[seat].name });
        return false;
      }
      return true;
    });
    incoming[targetSeat(seat, dir, n)].push(...give);
  }
  return remaining.map((h, seat) => {
    const nh = [...h, ...incoming[seat]];
    nh.sort(sortCards);
    return nh;
  });
}

function startTricks(state) {
  const leader = state.roundIndex % state.n;
  return { ...state, phase: "playGate", leader, currentSeat: leader, trick: [], trickNumber: 1 };
}

function playCard(state, cardId) {
  const seat = state.currentSeat;
  const hands = state.hands.map((h) => [...h]);
  const idx = hands[seat].findIndex((c) => c.id === cardId);
  if (idx < 0) return state;
  const [card] = hands[seat].splice(idx, 1);
  const trick = [...state.trick, { seat, card }];
  if (trick.length < state.n) {
    return { ...state, hands, trick, currentSeat: (seat + 1) % state.n, phase: "playGate", justPlayed: card };
  }
  const winner = resolveTrick(trick);
  const piles = state.piles.map((p) => [...p]);
  piles[winner].push(...trick.map((t) => t.card));
  return { ...state, hands, trick, piles, phase: "trickEnd", lastWinner: winner, lastTrick: trick, justPlayed: card };
}

function continueTrick(state) {
  const handsEmpty = state.hands.every((h) => h.length === 0);
  if (handsEmpty) {
    const { results, shooter, spellName } = scoreRound(state.piles);
    const scores = state.scores.map((s, i) => s + results[i].total);
    return { ...state, phase: "roundScores", roundResult: { results, shooter, spellName }, scores, totalRounds: state.totalRounds + 1 };
  }
  const winner = state.lastWinner;
  return { ...state, phase: "playGate", leader: winner, currentSeat: winner, trick: [], trickNumber: state.trickNumber + 1 };
}

function reducer(state, action) {
  switch (action.type) {
    case "START_GAME": {
      const players = action.players;
      const n = players.length;
      return beginRound({ players, n, scores: Array(n).fill(0), roundIndex: 0, totalRounds: 0 });
    }
    case "REVEAL":
      if (state.phase === "passGate") return { ...state, phase: "passing" };
      if (state.phase === "playGate") return { ...state, phase: "playing" };
      return state;
    case "CONFIRM_PASS": {
      const pending = [...state.pendingSelections];
      pending[state.passSeat] = action.cardIds;
      const nextSeat = state.passSeat + 1;
      if (nextSeat < state.n)
        return { ...state, pendingSelections: pending, passSeat: nextSeat, phase: "passGate" };
      const hands = applyPasses(state.hands, pending, state.passDir, state.n, state.players);
      return startTricks({ ...state, hands, pendingSelections: pending });
    }
    case "PLAY_CARD":
      return playCard(state, action.cardId);
    case "CONTINUE_TRICK":
      return continueTrick(state);
    case "NEXT_ROUND":
      if (isGameOver(state.scores)) return { ...state, phase: "gameOver" };
      return beginRound({
        players: state.players,
        n: state.n,
        scores: state.scores,
        roundIndex: state.roundIndex + 1,
        totalRounds: state.totalRounds,
      });
    case "RESTART_SAME":
      return beginRound({
        players: state.players,
        n: state.n,
        scores: Array(state.n).fill(0),
        roundIndex: 0,
        totalRounds: 0,
      });
    case "NEW_GAME":
      return { phase: "setup" };
    default:
      return state;
  }
}

export function useWitchesGame() {
  const [state, dispatch] = useReducer(reducer, { phase: "setup" });
  const actions = {
    startGame: useCallback((players) => dispatch({ type: "START_GAME", players }), []),
    reveal: useCallback(() => dispatch({ type: "REVEAL" }), []),
    confirmPass: useCallback((cardIds) => dispatch({ type: "CONFIRM_PASS", cardIds }), []),
    playCard: useCallback((cardId) => dispatch({ type: "PLAY_CARD", cardId }), []),
    continueTrick: useCallback(() => dispatch({ type: "CONTINUE_TRICK" }), []),
    nextRound: useCallback(() => dispatch({ type: "NEXT_ROUND" }), []),
    restartSame: useCallback(() => dispatch({ type: "RESTART_SAME" }), []),
    newGame: useCallback(() => dispatch({ type: "NEW_GAME" }), []),
  };
  return { state, actions };
}

