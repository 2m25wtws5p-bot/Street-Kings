import axios from "axios";
import { de as onlineGerman } from "../i18n/messages/online";

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

// The server remains language-neutral for room state. Translate known failures
// on each player's device, never expose unknown/raw server text in another language.
const defaultTranslate = (key, params = {}) => {
  const value = onlineGerman[key];
  const text = typeof value === "object" ? value[params.count === 1 ? "one" : "other"] : value;
  return (text || onlineGerman["error.generic"]).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
};
const serverErrorKeys = new Map(Object.entries(onlineGerman)
  .filter(([key, value]) => key.startsWith("error.") && typeof value === "string")
  .map(([key, value]) => [value, key]));
export function onlineErrorMessage(error, t = defaultTranslate) {
  if (error?.translationKey) return t(error.translationKey, error.translationParams);
  if (error?.code === "ONLINE_CONFIG") return t("error.config");
  if (error?.code === "ONLINE_RESPONSE") return t("error.response");
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && serverErrorKeys.has(detail)) return t(serverErrorKeys.get(detail));
  if (typeof detail === "string" && /^Chat-Nachrichten müssen 1 bis \d+ Zeichen enthalten$/.test(detail)) return t("error.chatLength");
  if (error?.response?.status === 429) return t("error.chatCooldown");
  if (error?.response?.status === 422) return t("error.validation");
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return t("error.timeout");
  }
  if (!error?.response) {
    return t("error.network");
  }
  return t("error.generic");
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
  const chatValid = messages => messages == null || (Array.isArray(messages) && messages.length <= 30 &&
    messages.every(message => message && typeof message.id === "string" && message.id.length > 0 &&
      seatValid(message.seat) && typeof message.name === "string" && typeof message.text === "string" &&
      Array.from(message.text).length > 0 && Array.from(message.text).length <= 140 &&
      Number.isSafeInteger(message.createdAt) && message.createdAt >= 0 && message.createdAt <= 8640000000000000));
  const valid = view && typeof view === "object" && typeof view.code === "string" &&
    ["lobby", "playing", "gameOver"].includes(view.status) &&
    Number.isInteger(view.n) && view.n >= (view.status === "lobby" ? 1 : 3) && view.n <= 6 &&
    Number.isSafeInteger(view.version) && view.version >= 0 &&
    Array.isArray(view.players) && view.players.length === view.n &&
    view.players.every((player, index) => player && player.seat === index && typeof player.name === "string") &&
    (view.yourSeat == null || seatValid(view.yourSeat)) &&
    (view.spectators == null || (Array.isArray(view.spectators) && view.spectators.every(name => typeof name === "string"))) &&
    exchangeValid(view.yourExchange) &&
    chatValid(view.chatMessages) &&
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
    error.translationKey = "error.session";
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
  chat: (code, token, text) => client.post(`${API}/rooms/${code}/chat`, { token, text }).then(roomResponse),
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
