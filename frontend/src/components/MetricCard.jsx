import React from 'react';

/**
 * Tarjeta grande con valor métrico (temperatura/humedad).
 */
export default function MetricCard({ label, value, unit, icon, accent = 'amber', testId }) {
  const accents = {
    amber: 'text-amber-400 border-amber-500/20',
    sky: 'text-sky-400 border-sky-500/20',
  };
  const ring = accents[accent] || accents.amber;

  const display =
    value === null || value === undefined || Number.isNaN(value) ? '—' : Number(value).toFixed(1);

  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden rounded-2xl bg-stone-900/70 border ${ring} p-5 backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.18em] text-stone-400 font-medium">{label}</span>
        <span className={accent === 'amber' ? 'text-amber-400' : 'text-sky-400'}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          data-testid={`${testId}-value`}
          className="font-mono text-5xl font-semibold text-stone-50 tabular-nums"
        >
          {display}
        </span>
        <span className="text-stone-400 font-mono text-lg">{unit}</span>
      </div>
    </div>
  );
}
