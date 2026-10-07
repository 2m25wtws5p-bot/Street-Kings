// Lokale (Browser-)Persistenz für die Akte.
const KEY = "witches_coven_stats_v1";
const ROOM_KEY = "witches_room";
const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const counter = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function normalizeStats(parsed) {
  const stats = emptyStats();
  if (!isRecord(parsed)) return stats;
  stats.gamesPlayed = counter(parsed.gamesPlayed);
  stats.roundsPlayed = counter(parsed.roundsPlayed);
  stats.lowestScore = Number.isFinite(parsed.lowestScore) ? parsed.lowestScore : null;
  if (isRecord(parsed.players)) {
    for (const [name, value] of Object.entries(parsed.players)) {
      if (!isRecord(value)) continue;
      const games = counter(value.games);
      stats.players[name] = {
        games,
        wins: Math.min(counter(value.wins), games),
        totalFire: Number.isFinite(value.totalFire) ? value.totalFire : 0,
      };
    }
  }
  return stats;
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    return normalizeStats(parsed);
  } catch {
    return emptyStats();
  }
}

function emptyStats() {
  // Player names such as "__proto__" must not address Object's prototype.
  return { gamesPlayed: 0, roundsPlayed: 0, lowestScore: null, players: Object.create(null) };
}

export function recordGame({ players, scores, winnerNames, rounds } = {}) {
  const stats = loadStats();
  if (!Array.isArray(players) || !players.length || !Array.isArray(scores) ||
      scores.length !== players.length || !scores.every(Number.isFinite)) return stats;
  const winners = new Set(Array.isArray(winnerNames) ? winnerNames : []);
  stats.gamesPlayed += 1;
  stats.roundsPlayed += counter(rounds);
  const minScore = Math.min(...scores);
  if (stats.lowestScore == null || minScore < stats.lowestScore) {
    stats.lowestScore = minScore;
  }
  players.forEach((p, i) => {
    const name = typeof p?.name === "string" && p.name.trim() ? p.name : `Gangster ${i + 1}`;
    const rec = stats.players[name] || { games: 0, wins: 0, totalFire: 0 };
    rec.games += 1;
    rec.totalFire += scores[i];
    if (winners.has(name)) rec.wins += 1;
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

export function loadRoomSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROOM_KEY));
    if (!isRecord(parsed) || typeof parsed.code !== "string" ||
        !/^[A-Z0-9]{4,6}$/.test(parsed.code) || typeof parsed.token !== "string" ||
        !parsed.token.trim()) return null;
    return { code: parsed.code, token: parsed.token, spectator: !!parsed.spectator };
  } catch {
    return null;
  }
}

export function saveRoomSession(session) {
  try {
    localStorage.setItem(ROOM_KEY, JSON.stringify({ code: session.code, token: session.token, spectator: !!session.spectator }));
    return true;
  } catch {
    // Private browsing or a storage quota must not interrupt an active game.
    return false;
  }
}

export function clearRoomSession() {
  try { localStorage.removeItem(ROOM_KEY); } catch { /* browser storage may be disabled */ }
}
