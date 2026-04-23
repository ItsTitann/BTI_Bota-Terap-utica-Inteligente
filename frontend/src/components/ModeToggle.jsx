import React from 'react';

/**
 * Dos pestañas grandes: Automático / Manual.
 */
export default function ModeToggle({ auto, onChange, disabled = false }) {
  const tabBase =
    'flex-1 h-14 rounded-xl font-display text-base transition-all duration-200 select-none flex items-center justify-center';
  const active = 'bg-amber-500 text-stone-950 shadow-md font-bold';
  const inactive = 'bg-transparent text-stone-400 hover:text-stone-200';

  return (
    <div data-testid="mode-toggle" className="w-full">
      <div
        className={`flex gap-1.5 p-1.5 rounded-2xl bg-stone-900/70 border border-stone-800 ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <button
          data-testid="mode-auto-button"
          onClick={() => onChange(true)}
          className={`${tabBase} ${auto ? active : inactive}`}
        >
          Automático
        </button>
        <button
          data-testid="mode-manual-button"
          onClick={() => onChange(false)}
          className={`${tabBase} ${!auto ? active : inactive}`}
        >
          Manual
        </button>
      </div>
      <p data-testid="mode-description" className="text-xs text-stone-400 mt-2.5 px-1 leading-relaxed">
        {auto
          ? 'El sistema ajusta ventilador y LED automáticamente según los setpoints.'
          : 'Tú controlas ventilador y LED manualmente desde los botones de abajo.'}
      </p>
    </div>
  );
}
