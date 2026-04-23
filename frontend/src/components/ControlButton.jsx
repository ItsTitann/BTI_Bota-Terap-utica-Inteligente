import React from 'react';

/**
 * Botón grande de control con estado ON/OFF.
 */
export default function ControlButton({
  label,
  active,
  onToggle,
  icon,
  activeIcon,
  disabled = false,
  glow = false,
  testId,
}) {
  const displayedIcon = active && activeIcon ? activeIcon : icon;
  return (
    <button
      data-testid={testId}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 min-h-[124px]',
        active
          ? 'bg-amber-500/15 border-amber-500/60 text-stone-50'
          : 'bg-stone-900/70 border-stone-800 text-stone-300 hover:border-stone-700',
        disabled ? 'opacity-40 grayscale pointer-events-none' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            'flex w-11 h-11 rounded-xl items-center justify-center',
            active ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300',
            glow && active ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]' : '',
          ].join(' ')}
        >
          {displayedIcon}
        </span>
        <span
          data-testid={`${testId}-state`}
          className={[
            'text-[10px] tracking-[0.2em] uppercase font-bold px-2.5 py-1 rounded-full',
            active ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400',
          ].join(' ')}
        >
          {active ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="mt-4">
        <span className="font-display text-lg font-semibold">{label}</span>
      </div>
    </button>
  );
}
