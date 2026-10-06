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

export const roomApi = {
  create: (name, avatar) => client.post(`${API}/rooms`, { name, avatar }).then((r) => r.data),
  join: (code, name, avatar) => client.post(`${API}/rooms/${code}/join`, { name, avatar }).then((r) => r.data),
  watch: (code, name) => client.post(`${API}/rooms/${code}/watch`, { name }).then((r) => r.data),
  get: (code, token) => client.get(`${API}/rooms/${code}`, { params: { token } }).then((r) => r.data),
  start: (code, token) => client.post(`${API}/rooms/${code}/start`, { token }).then((r) => r.data),
  bots: (code, token, action) => client.post(`${API}/rooms/${code}/bots`, { token, action }).then((r) => r.data),
  replace: (code, token, seat) => client.post(`${API}/rooms/${code}/replace`, { token, seat }).then((r) => r.data),
  rematch: (code, token) => client.post(`${API}/rooms/${code}/rematch`, { token }).then((r) => r.data),
  action: (code, token, payload) => client.post(`${API}/rooms/${code}/action`, { token, ...payload }).then((r) => r.data),
};
