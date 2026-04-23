import React from 'react';
import { Gear } from '@phosphor-icons/react';

/**
 * Banner superior sticky con estado y acceso a configuración.
 * Estados soportados: simulator | esp32 | offline
 */
export default function StatusBanner({ mode, onOpenSettings }) {
  const palette = {
    simulator: { color: 'bg-emerald-400', label: 'Simulador activo', ring: 'shadow-emerald-500/40' },
    esp32:     { color: 'bg-emerald-400', label: 'ESP32 conectado',  ring: 'shadow-emerald-500/40' },
    offline:   { color: 'bg-rose-500',    label: 'Sin conexión',     ring: 'shadow-rose-500/40' },
  };
  const p = palette[mode] || palette.offline;

  return (
    <div
      data-testid="status-banner"
      className="sticky top-0 z-30 px-5 pt-5 pb-4 backdrop-blur-xl bg-stone-950/70 border-b border-stone-800/70"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            data-testid="status-dot"
            className={`bti-pulse inline-block w-2.5 h-2.5 rounded-full ${p.color} shadow-[0_0_10px] ${p.ring}`}
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display font-extrabold tracking-tight text-xl text-stone-50">BTI</span>
            <span data-testid="status-label" className="text-xs text-stone-400">{p.label}</span>
          </div>
        </div>
        <button
          data-testid="open-settings-button"
          onClick={onOpenSettings}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
          aria-label="Abrir configuración"
        >
          <Gear size={22} weight="duotone" />
        </button>
      </div>
    </div>
  );
}
