import axios from 'axios';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CACHE_KEY = 'bti.config.cache';
const REQUEST_TIMEOUT_MS = 6000;
const IS_NATIVE_APP = Capacitor.isNativePlatform();
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').trim();
const HAS_EXPLICIT_BACKEND = BACKEND_URL.length > 0;
const BACKEND_BASE = HAS_EXPLICIT_BACKEND ? BACKEND_URL.replace(/\/+$/, '') : '';
export const API = HAS_EXPLICIT_BACKEND ? `${BACKEND_BASE}/api` : '/api';

export const api = axios.create({
  baseURL: API,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

function createInvalidResponseError(message) {
  const error = new Error(message);
  error.code = 'INVALID_BACKEND_RESPONSE';
  return error;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureStatusPayload(data) {
  if (!isPlainObject(data) || typeof data.ok !== 'boolean') {
    throw createInvalidResponseError('Respuesta de /status inválida');
  }
  return data;
}

function ensureConfigPayload(data) {
  if (!isPlainObject(data) || typeof data.simulator !== 'boolean' || typeof data.ip !== 'string') {
    throw createInvalidResponseError('Respuesta de /config inválida');
  }
  return data;
}

function parseMaybeJson(data) {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function describeError(error) {
  const status = error?.response?.status ?? error?.status;
  if (status) return `HTTP ${status}`;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error?.error === 'string' && error.error.trim()) return error.error.trim();
  return 'Network Error';
}

function createEspNetworkError(url, error) {
  const reason = describeError(error);
  const wrapped = new Error(`No se pudo conectar con ${url}: ${reason}`);
  wrapped.code = 'ESP_NETWORK_ERROR';
  wrapped.userMessage = `Sin respuesta del ESP32 en ${url} (${reason})`;
  wrapped.cause = error;
  return wrapped;
}

function readCachedConfig() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function normalizeAddress(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function getEspBaseUrl() {
  const cached = readCachedConfig();
  if (!cached || cached.simulator) return null;
  const address = normalizeAddress(cached.ip || '');
  if (!address) return null;
  return `http://${address}`;
}

async function requestEsp(espBaseUrl, path, { method = 'GET', params } = {}) {
  const url = `${espBaseUrl}${path}`;
  try {
    if (IS_NATIVE_APP) {
      const response = await CapacitorHttp.request({
        method,
        url,
        params,
        data: method === 'POST' ? {} : undefined,
        headers: { Accept: 'application/json' },
        connectTimeout: REQUEST_TIMEOUT_MS,
        readTimeout: REQUEST_TIMEOUT_MS,
      });
      return parseMaybeJson(response.data);
    }

    if (method === 'POST') {
      const response = await axios.post(url, null, {
        params,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
      return response.data;
    }

    const response = await axios.get(url, {
      params,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
    return response.data;
  } catch (error) {
    throw createEspNetworkError(url, error);
  }
}

function isBackendUnavailable(error) {
  if (error?.code === 'INVALID_BACKEND_RESPONSE') return true;
  const status = error?.response?.status;
  if (!status) return true;
  if (status >= 500) return true;
  return [404, 405].includes(status);
}

async function withEspFallback(backendRequest, espRequest) {
  try {
    return await backendRequest();
  } catch (error) {
    if (!isBackendUnavailable(error)) {
      throw error;
    }
    const espBaseUrl = getEspBaseUrl();
    if (!espBaseUrl) {
      throw error;
    }
    return espRequest(espBaseUrl);
  }
}

export async function getStatus() {
  const data = await withEspFallback(
    async () => {
      const response = await api.get('/status');
      return ensureStatusPayload(response.data);
    },
    async (espBaseUrl) => {
      const data = await requestEsp(espBaseUrl, '/status', { method: 'GET' });
      return { ...ensureStatusPayload(data), source: 'esp32' };
    }
  );
  return data;
}

export async function getConfig() {
  try {
    const { data } = await api.get('/config');
    const validated = ensureConfigPayload(data);
    localStorage.setItem(CACHE_KEY, JSON.stringify(validated));
    return validated;
  } catch (error) {
    const cached = readCachedConfig();
    if (cached) return cached;
    return { ip: '192.168.1.45', simulator: true };
  }
}

export async function saveConfig(payload) {
  const normalized = {
    ip: normalizeAddress(payload?.ip || ''),
    simulator: !!payload?.simulator,
  };

  try {
    const { data } = await api.post('/config', normalized);
    const validated = ensureConfigPayload(data);
    localStorage.setItem(CACHE_KEY, JSON.stringify(validated));
    return validated;
  } catch (error) {
    if (!isBackendUnavailable(error)) {
      throw error;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
    return normalized;
  }
}

export async function setModo(auto) {
  const data = await withEspFallback(
    async () => {
      const response = await api.post(`/modo`, null, { params: { auto: auto ? 1 : 0 } });
      return ensureStatusPayload(response.data);
    },
    async (espBaseUrl) => {
      const data = await requestEsp(espBaseUrl, '/modo', {
        method: 'POST',
        params: { auto: auto ? 1 : 0 },
      });
      return { ...ensureStatusPayload(data), source: 'esp32' };
    }
  );
  return data;
}

export async function setManual({ vent, led }) {
  const params = {};
  if (typeof vent === 'boolean') params.vent = vent ? 1 : 0;
  if (typeof led === 'boolean') params.led = led ? 1 : 0;
  const data = await withEspFallback(
    async () => {
      const response = await api.post(`/manual`, null, { params });
      return ensureStatusPayload(response.data);
    },
    async (espBaseUrl) => {
      const data = await requestEsp(espBaseUrl, '/manual', { method: 'POST', params });
      return { ...ensureStatusPayload(data), source: 'esp32' };
    }
  );
  return data;
}

export async function setSetpoints(on, off) {
  const data = await withEspFallback(
    async () => {
      const response = await api.post(`/setpoints`, null, { params: { on, off } });
      return ensureStatusPayload(response.data);
    },
    async (espBaseUrl) => {
      const data = await requestEsp(espBaseUrl, '/setpoints', {
        method: 'POST',
        params: { on, off },
      });
      return { ...ensureStatusPayload(data), source: 'esp32' };
    }
  );
  return data;
}
