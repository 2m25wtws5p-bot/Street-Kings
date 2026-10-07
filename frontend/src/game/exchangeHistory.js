// Presentation snapshots: these never participate in the rules or scoring.
export function captureCardExchange(hands, pending, dir, players) {
  const n = players.length;
  if (!dir || !n) return Array(n).fill(null);
  const seatAt = (seat) => ((seat % n) + n) % n;
  return players.map((player, seat) => {
    const source = seatAt(seat - dir);
    const target = seatAt(seat + dir);
    const sentIds = new Set(pending[seat] || []);
    const receivedIds = new Set(pending[source] || []);
    return {
      sent: hands[seat].filter((card) => sentIds.has(card.id)).map((card) => ({ ...card })),
      received: hands[source].filter((card) => receivedIds.has(card.id)).map((card) => ({ ...card })),
      sentTo: players[target].name,
      receivedFrom: players[source].name,
    };
  });
}

export function exchangeHistoryAvailable(phase, trickNumber, exchange) {
  return (phase === "playing" || phase === "trickEnd") &&
    Number.isInteger(trickNumber) && trickNumber >= 1 && trickNumber <= 3 &&
    !!exchange && ((exchange.sent?.length || 0) > 0 || (exchange.received?.length || 0) > 0);
}

// In hot-seat play a locked screen must never show the previous holder's deal.
// While bots act, the last human who revealed their hand still holds the device.
export function localExchangeSeat(state, revealedSeat) {
  if (state.phase !== "playing" && state.phase !== "trickEnd") return null;
  if (state.phase === "playing" && state.players[state.currentSeat] && !state.players[state.currentSeat].isBot) {
    return state.currentSeat;
  }
  return Number.isInteger(revealedSeat) && state.players[revealedSeat] && !state.players[revealedSeat].isBot
    ? revealedSeat : null;
}
