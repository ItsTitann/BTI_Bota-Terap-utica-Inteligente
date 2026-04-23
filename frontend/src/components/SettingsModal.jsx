import React, { useEffect, useState } from 'react';
import { X, FloppyDisk, Cpu } from '@phosphor-icons/react';
import { isValidEsp32Address } from '../lib/validation';
import { getConfig, saveConfig } from '../lib/api';

const CACHE_KEY = 'bti.config.cache';

export default function SettingsModal({ open, onClose, onSaved }) {
  const [simulator, setSimulator] = useState(true);
  const [ip, setIp] = useState('192.168.1.45');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setMessage(null);
      setLoading(true);
      try {
        const data = await getConfig();
        setSimulator(!!data.simulator);
        setIp(data.ip || '192.168.1.45');
      } catch (e) {
        // fallback a localStorage si el backend falla
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
          if (cached) {
            setSimulator(!!cached.simulator);
            setIp(cached.ip || '192.168.1.45');
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!simulator && !isValidEsp32Address(ip)) {
      setMessage({ type: 'error', text: 'Dirección inválida. Usa IPv4 (con puerto opcional) o un hostname con un punto (ej. bti.local).' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ip: ip.trim(), simulator: !!simulator };
      const saved = await saveConfig(payload);
      localStorage.setItem(CACHE_KEY, JSON.stringify(saved));
      setMessage({ type: 'ok', text: 'Configuración guardada' });
      onSaved && onSaved(saved);
      setTimeout(() => onClose && onClose(), 350);
    } catch (e2) {
      const detail = e2?.response?.data?.detail || 'No se pudo guardar la configuración';
      setMessage({ type: 'error', text: detail });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bti-slideup w-full max-w-app sm:rounded-3xl rounded-t-3xl bg-stone-900 border-t border-x sm:border border-stone-800 p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-stone-700 mb-4" />
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Cpu size={20} weight="duotone" />
            </span>
            <h2 className="font-display text-xl font-bold text-stone-50">Configuración</h2>
          </div>
          <button
            data-testid="close-settings-button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center hover:text-stone-50"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-stone-950/70 border border-stone-800">
            <div>
              <div className="font-display font-semibold text-stone-50">Modo Simulador</div>
              <p className="text-xs text-stone-400 mt-0.5">Usa datos sintéticos sin conectarse al ESP32.</p>
            </div>
            <input
              data-testid="simulator-toggle"
              type="checkbox"
              checked={simulator}
              onChange={(e) => setSimulator(e.target.checked)}
              className="w-6 h-6 accent-amber-500"
            />
          </label>

          <label className={`block ${simulator ? 'opacity-50' : ''}`}>
            <span className="text-xs text-stone-400">Dirección del ESP32 (IP o mDNS)</span>
            <input
              data-testid="ip-input"
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              disabled={simulator}
              placeholder="192.168.1.45 o bti.local"
              className="mt-1.5 w-full h-12 px-4 bg-stone-950/60 border border-stone-800 rounded-xl font-mono text-stone-50 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40"
            />
          </label>

          {loading && <div className="text-xs text-stone-500">Cargando configuración…</div>}

          {message && (
            <div
              data-testid="settings-message"
              className={`text-sm px-3 py-2.5 rounded-lg border ${
                message.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            data-testid="save-settings-button"
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl bg-amber-500 text-stone-950 font-bold font-display flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            <FloppyDisk size={20} weight="bold" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
