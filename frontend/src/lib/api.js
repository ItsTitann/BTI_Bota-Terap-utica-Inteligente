import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 6000,
});

export async function getStatus() {
  const { data } = await api.get('/status');
  return data;
}

export async function getConfig() {
  const { data } = await api.get('/config');
  return data;
}

export async function saveConfig(payload) {
  const { data } = await api.post('/config', payload);
  return data;
}

export async function setModo(auto) {
  const { data } = await api.post(`/modo`, null, { params: { auto: auto ? 1 : 0 } });
  return data;
}

export async function setManual({ vent, led }) {
  const params = {};
  if (typeof vent === 'boolean') params.vent = vent ? 1 : 0;
  if (typeof led === 'boolean') params.led = led ? 1 : 0;
  const { data } = await api.post(`/manual`, null, { params });
  return data;
}

export async function setSetpoints(on, off) {
  const { data } = await api.post(`/setpoints`, null, { params: { on, off } });
  return data;
}
