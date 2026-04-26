import React, { useEffect, useState } from 'react';
import { FloppyDisk } from '@phosphor-icons/react';
import { validateSetpoints } from '../lib/validation';
import { setSetpoints } from '../lib/api';

export default function SetpointsForm({ currentOn, currentOff, onSaved, source }) {
  const [on, setOn] = useState('');
  const [off, setOff] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOn !== undefined && currentOn !== null) setOn(String(currentOn));
  }, [currentOn]);
  useEffect(() => {
    if (currentOff !== undefined && currentOff !== null) setOff(String(currentOff));
  }, [currentOff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const err = validateSetpoints(on, off, { profile: source === 'esp32' ? 'esp32' : 'default' });
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSaving(true);
    try {
      await setSetpoints(Number(on), Number(off));
      setMessage({ type: 'ok', text: 'Setpoints guardados correctamente' });
      onSaved && onSaved(Number(on), Number(off));
    } catch (e2) {
      const detail =
        e2?.userMessage ||
        e2?.response?.data?.detail ||
        e2?.response?.data?.error ||
        e2?.message ||
        'No se pudieron guardar los setpoints';
      setMessage({ type: 'error', text: detail });
    } finally {
      setSaving(false);
    }
  };

  const rangeHint =
    source === 'esp32'
      ? 'Firmware ESP32: ON [15, 60] y OFF [10, 55]'
      : 'Rango permitido: [-20, 80] °C';

  const inputCls =
    'w-full h-12 px-4 bg-stone-950/60 border border-stone-800 rounded-xl font-mono text-lg text-stone-50 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 transition-colors';

  return (
    <form data-testid="setpoints-form" onSubmit={handleSubmit} className="rounded-2xl bg-stone-900/70 border border-stone-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-stone-100">Setpoints (°C)</h3>
        <span className="text-[10px] uppercase tracking-widest text-stone-500">Histéresis</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone-400">Encender (ON)</span>
          <input
            data-testid="setpoint-on-input"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={on}
            onChange={(e) => setOn(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone-400">Apagar (OFF)</span>
          <input
            data-testid="setpoint-off-input"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={off}
            onChange={(e) => setOff(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-stone-500">{rangeHint}</p>

      {message && (
        <div
          data-testid="setpoints-message"
          className={`mt-4 text-sm px-3 py-2.5 rounded-lg border ${
            message.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        data-testid="save-setpoints-button"
        type="submit"
        disabled={saving}
        className="mt-4 w-full h-12 rounded-xl bg-amber-500 text-stone-950 font-bold font-display flex items-center justify-center gap-2 transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-60"
      >
        <FloppyDisk size={20} weight="bold" />
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
