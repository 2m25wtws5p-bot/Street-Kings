import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const roomApi = {
  create: (name, avatar) => axios.post(`${API}/rooms`, { name, avatar }).then((r) => r.data),
  join: (code, name, avatar) => axios.post(`${API}/rooms/${code}/join`, { name, avatar }).then((r) => r.data),
  watch: (code, name) => axios.post(`${API}/rooms/${code}/watch`, { name }).then((r) => r.data),
  get: (code, token) => axios.get(`${API}/rooms/${code}`, { params: { token } }).then((r) => r.data),
  start: (code, token) => axios.post(`${API}/rooms/${code}/start`, { token }).then((r) => r.data),
  bots: (code, token, action) => axios.post(`${API}/rooms/${code}/bots`, { token, action }).then((r) => r.data),
  action: (code, token, payload) => axios.post(`${API}/rooms/${code}/action`, { token, ...payload }).then((r) => r.data),
};
