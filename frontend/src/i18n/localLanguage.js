// Viewer preference only: this never changes turns, cards or the reducer.
export function localLanguageSeat(state, previousSeat = null) {
  const players = state.players || [];
  const humans = players.flatMap((player, seat) => player.isBot ? [] : [seat]);
  if (humans.length === 1) return humans[0];
  if (['passGate', 'passing'].includes(state.phase) && humans.includes(state.passSeat)) return state.passSeat;
  if (['playGate', 'playing', 'trickEnd'].includes(state.phase) && humans.includes(state.currentSeat)) return state.currentSeat;
  return humans.includes(previousSeat) ? previousSeat : humans[0] ?? null;
}
