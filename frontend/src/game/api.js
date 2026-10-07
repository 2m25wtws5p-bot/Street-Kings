import axios from "axios";

const backendUrl = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
let configurationError = "";
try {
  if (!backendUrl) throw new Error("missing");
  const url = new URL(backendUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("invalid");
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "https:") {
    throw new Error("insecure");
  }
} catch {
  configurationError = "Der Online-Spielserver ist nicht eingerichtet. Die Veröffentlichung benötigt eine gültige HTTPS-Spielserver-Adresse (REACT_APP_BACKEND_URL).";
}
const API = backendUrl.endsWith("/api") ? backendUrl : `${backendUrl}/api`;
const client = axios.create({ timeout: 120000 });
client.interceptors.request.use((config) => {
  if (configurationError) {
    const error = new Error(configurationError);
    error.code = "ONLINE_CONFIG";
    throw error;
  }
  return config;
});

export function onlineErrorMessage(error) {
  if (error?.code === "ONLINE_CONFIG") return error.message;
  if (error?.code === "ONLINE_RESPONSE") return error.message;
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return "Der Spielserver antwortet nicht rechtzeitig. Kostenlose Server benötigen nach einer Ruhephase etwas Zeit zum Aufwachen. Bitte versuche es noch einmal.";
  }
  if (!error?.response) {
    return "Der Spielserver ist nicht erreichbar. Prüfe deine Verbindung; möglicherweise ist der Server offline oder blockiert die Verbindung.";
  }
  return "Die Anfrage an den Spielserver ist fehlgeschlagen. Bitte versuche es noch einmal.";
}

export function validateRoomView(view) {
  const seatValid = seat => Number.isInteger(seat) && seat >= 0 && seat < view.n;
  const cardValid = card => card && typeof card.id === "string" &&
    Number.isInteger(card.value) && card.value >= 0 && card.value <= 14 &&
    [null, "RED", "YELLOW", "BLUE", "GREEN"].includes(card.suit) &&
    (card.special == null || ["fire", "water", "earth", "air", "pygmy", "wizard"].includes(card.special));
  const trickValid = trick => Array.isArray(trick) && trick.length <= view.n &&
    trick.every(entry => entry && seatValid(entry.seat) && cardValid(entry.card));
  const optionalName = name => name == null || typeof name === "string";
  const optionalCards = cards => cards == null || (Array.isArray(cards) && cards.every(cardValid));
  const exchangeValid = exchange => exchange == null || (
    typeof exchange === "object" && !Array.isArray(exchange) &&
    optionalCards(exchange.sent) && optionalCards(exchange.received) &&
    optionalName(exchange.sentTo) && optionalName(exchange.receivedFrom));
  const valid = view && typeof view === "object" && typeof view.code === "string" &&
    ["lobby", "playing", "gameOver"].includes(view.status) &&
    Number.isInteger(view.n) && view.n >= (view.status === "lobby" ? 1 : 3) && view.n <= 6 &&
    Number.isSafeInteger(view.version) && view.version >= 0 &&
    Array.isArray(view.players) && view.players.length === view.n &&
    view.players.every((player, index) => player && player.seat === index && typeof player.name === "string") &&
    (view.yourSeat == null || seatValid(view.yourSeat)) &&
    (view.spectators == null || (Array.isArray(view.spectators) && view.spectators.every(name => typeof name === "string"))) &&
    exchangeValid(view.yourExchange) &&
    (view.status === "lobby" || (
      ["passing", "playing", "trickEnd", "roundScores", "gameOver"].includes(view.phase) &&
      Array.isArray(view.scores) && view.scores.length === view.n && view.scores.every(Number.isFinite) &&
      Array.isArray(view.handCounts) && view.handCounts.length === view.n && view.handCounts.every(count => Number.isInteger(count) && count >= 0) &&
      Array.isArray(view.yourHand) && view.yourHand.every(cardValid) &&
      trickValid(view.trick) && (view.lastTrick == null || trickValid(view.lastTrick)) &&
      seatValid(view.currentSeat) && (view.lastWinner == null || seatValid(view.lastWinner)) &&
      (view.phase !== "passing" || (Array.isArray(view.passedSeats) && view.passedSeats.length === view.n)) &&
      ((view.phase !== "roundScores" && view.phase !== "gameOver") ||
        (view.roundResult && Array.isArray(view.roundResult.results) && view.roundResult.results.length === view.n &&
          (view.roundResult.shooter == null || view.roundResult.shooter === -1 || seatValid(view.roundResult.shooter)) &&
          optionalName(view.roundResult.spellName) &&
          view.roundResult.results.every(result => result && Number.isFinite(result.total))))
    ));
  if (!valid) {
    const error = new Error("Der Spielserver hat unvollständige Spieldaten gesendet. Die Verbindung wird erneut versucht.");
    error.code = "ONLINE_RESPONSE";
    throw error;
  }
  return view;
}
const roomResponse = response => validateRoomView(response.data);
export function validateRoomSession(session) {
  if (!session || typeof session.code !== "string" || !/^[A-Z0-9]{4,6}$/.test(session.code) ||
      typeof session.token !== "string" || !session.token.trim()) {
    const error = new Error("Der Spielserver hat keinen gültigen Spielerzugang zurückgegeben. Bitte versuche es noch einmal.");
    error.code = "ONLINE_RESPONSE";
    throw error;
  }
  return session;
}
const sessionResponse = response => validateRoomSession(response.data);

export const roomApi = {
  create: (name, avatar) => client.post(`${API}/rooms`, { name, avatar }).then(sessionResponse),
  join: (code, name, avatar, token) => client.post(`${API}/rooms/${code}/join`, { name, avatar, ...(token ? { token } : {}) }).then(sessionResponse),
  watch: (code, name) => client.post(`${API}/rooms/${code}/watch`, { name }).then(sessionResponse),
  get: (code, token, options = {}) => client.get(`${API}/rooms/${code}`, { params: { token }, signal: options.signal }).then(roomResponse),
  start: (code, token) => client.post(`${API}/rooms/${code}/start`, { token }).then(roomResponse),
  bots: (code, token, action) => client.post(`${API}/rooms/${code}/bots`, { token, action }).then(roomResponse),
  replace: (code, token, seat) => client.post(`${API}/rooms/${code}/replace`, { token, seat }).then(roomResponse),
  rematch: (code, token) => client.post(`${API}/rooms/${code}/rematch`, { token }).then(roomResponse),
  action: (code, token, payload) => client.post(`${API}/rooms/${code}/action`, { token, ...payload }).then(roomResponse),
};

export function normalizeRecentGames(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(game => game && typeof game === "object" &&
    Number.isInteger(game.players) && game.players >= 3 && game.players <= 6 &&
    Number.isSafeInteger(game.rounds) && game.rounds >= 0 &&
    Array.isArray(game.winners) && game.winners.length > 0 &&
    game.winners.every(name => typeof name === "string" && name.trim())).slice(0, 8);
}

export const gameApi = {
  recent: (options = {}) => client.get(`${API}/games/recent`, { params: { limit: 8 }, signal: options.signal }).then(response => normalizeRecentGames(response.data)),
  record: (game) => client.post(`${API}/games`, game).then(response => response.data),
};
