// Lokale (Browser-)Persistenz für die Akte.
const KEY = "witches_coven_stats_v1";

export function loadStats() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    return { ...emptyStats(), ...parsed };
  } catch {
    return emptyStats();
  }
}

function emptyStats() {
  return { gamesPlayed: 0, roundsPlayed: 0, lowestScore: null, players: {} };
}

export function recordGame({ players, scores, winnerNames, rounds }) {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  stats.roundsPlayed += rounds || 0;
  const minScore = Math.min(...scores);
  if (stats.lowestScore == null || minScore < stats.lowestScore) {
    stats.lowestScore = minScore;
  }
  players.forEach((p, i) => {
    const name = p.name || `Gangster ${i + 1}`;
    const rec = stats.players[name] || { games: 0, wins: 0, totalFire: 0 };
    rec.games += 1;
    rec.totalFire += scores[i];
    if (winnerNames.includes(name)) rec.wins += 1;
    stats.players[name] = rec;
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* ignore quota errors */
  }
  return stats;
}

export function clearStats() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return emptyStats();
}
