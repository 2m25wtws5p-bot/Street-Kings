// Lokale (Browser-)Persistenz für die Akte.
const KEY = "street_kings_stats_v2";
const ROOM_KEY = "street_kings_room_v2";
// Exact previous ASCII namespaces, represented by length + FNV-1a 64-bit.
// A matching record from a different same-origin application is not ours.
const LEGACY_STATS_FINGERPRINT = "22:37ed8ed3adace274";
const LEGACY_ROOM_FINGERPRINT = "12:547e3d84183a13be";
const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const counter = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function namespaceFingerprint(key) {
  if (typeof key !== "string" || (key.length !== 12 && key.length !== 22)) return null;
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < key.length; index++) {
    const code = key.charCodeAt(index);
    if (code > 127) return null;
    hash = BigInt.asUintN(64, (hash ^ BigInt(code)) * 0x100000001b3n);
  }
  return `${key.length}:${hash.toString(16).padStart(16, "0")}`;
}

// Import only the exact known namespace AND structurally valid data. Do not
// inspect arbitrary suffix matches or forward another application's token.
function oldTotal(record) {
  if (Number.isFinite(record.totalHeat)) return record.totalHeat;
  const totals = Object.entries(record).filter(([key, value]) => key.startsWith("total") && Number.isFinite(value));
  return totals.length === 1 ? totals[0][1] : 0;
}

function statsRecord(value) {
  return isRecord(value) && Object.keys(value).length === 4 &&
    Number.isSafeInteger(value.gamesPlayed) && value.gamesPlayed >= 0 &&
    Number.isSafeInteger(value.roundsPlayed) && value.roundsPlayed >= 0 &&
    (value.lowestScore === null || Number.isFinite(value.lowestScore)) &&
    isRecord(value.players) && Object.values(value.players).every(record =>
      isRecord(record) && Object.keys(record).length === 3 &&
      Number.isSafeInteger(record.games) && record.games >= 0 &&
      Number.isSafeInteger(record.wins) && record.wins >= 0 && record.wins <= record.games &&
      Object.entries(record).filter(([key, total]) => key.startsWith("total") && Number.isFinite(total)).length === 1);
}

function sessionRecord(value) {
  return isRecord(value) && Object.keys(value).every(key => ["code", "token", "spectator"].includes(key)) &&
    typeof value.code === "string" && /^[A-Z0-9]{4,6}$/.test(value.code) &&
    typeof value.token === "string" && !!value.token.trim() &&
    (value.spectator == null || typeof value.spectator === "boolean");
}

function readSaved(primary, legacyFingerprint, validate, normalize) {
  const raw = localStorage.getItem(primary);
  if (raw !== null) return JSON.parse(raw);
  const candidates = [];
  const length = Math.min(Number(localStorage.length) || 0, 500);
  for (let index = 0; index < length; index++) {
    const key = localStorage.key(index);
    if (key === primary || namespaceFingerprint(key) !== legacyFingerprint) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (validate(value)) candidates.push(value);
    } catch { /* unrelated malformed browser data is never changed */ }
  }
  if (candidates.length !== 1) return null;
  const migrated = normalize(candidates[0]);
  try { localStorage.setItem(primary, JSON.stringify(migrated)); } catch { /* still usable for this session */ }
  return migrated;
}

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
        totalHeat: oldTotal(value),
      };
    }
  }
  return stats;
}

export function loadStats() {
  try {
    const parsed = readSaved(KEY, LEGACY_STATS_FINGERPRINT, statsRecord, normalizeStats);
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
    const rec = stats.players[name] || { games: 0, wins: 0, totalHeat: 0 };
    rec.games += 1;
    rec.totalHeat += scores[i];
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
    // Keep a cleared record so an older untouched backup cannot reappear.
    localStorage.setItem(KEY, JSON.stringify(emptyStats()));
  } catch {
    /* ignore */
  }
  return emptyStats();
}

export function loadRoomSession() {
  try {
    const parsed = readSaved(ROOM_KEY, LEGACY_ROOM_FINGERPRINT, sessionRecord, value => ({ code: value.code, token: value.token, spectator: !!value.spectator }));
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
  // A tombstone prevents resuming an older namespace after explicitly leaving.
  try { localStorage.setItem(ROOM_KEY, "null"); } catch { /* browser storage may be disabled */ }
}
