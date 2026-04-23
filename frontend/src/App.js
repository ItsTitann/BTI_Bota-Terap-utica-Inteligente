import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Thermometer,
  Drop,
  CheckCircle,
  Warning,
  ArrowsClockwise,
  Fan,
  Lightbulb,
  LightbulbFilament,
} from '@phosphor-icons/react';
import './App.css';
import useStatus from './hooks/useStatus';
import StatusBanner from './components/StatusBanner';
import MetricCard from './components/MetricCard';
import ModeToggle from './components/ModeToggle';
import ControlButton from './components/ControlButton';
import SetpointsForm from './components/SetpointsForm';
import SettingsModal from './components/SettingsModal';
import { getConfig, setModo as apiSetModo, setManual as apiSetManual } from './lib/api';

function formatTime(d) {
  if (!d) return '—';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
  const { status, error, loading, lastUpdate, refresh } = useStatus(2000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState({ simulator: true, ip: '192.168.1.45' });

  const reloadConfig = useCallback(async () => {
    try {
      const c = await getConfig();
      setConfig(c);
    } catch {
      /* ignorar */
    }
  }, []);

  useEffect(() => {
    reloadConfig();
  }, [reloadConfig]);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const bannerMode = useMemo(() => {
    if (error) return 'offline';
    if (!status) return 'offline';
    return status.source === 'simulator' ? 'simulator' : 'esp32';
  }, [error, status]);

  const online = !!status && !error;
  const auto = !!status?.modoAuto;
  const controlsDisabled = !online || auto;

  const handleModeChange = async (newAuto) => {
    if (!online) return;
    try {
      await apiSetModo(newAuto);
      showToast(newAuto ? 'Modo automático activado' : 'Modo manual activado');
      refresh();
    } catch (e) {
      showToast('No se pudo cambiar el modo');
    }
  };

  const toggleVent = async () => {
    if (controlsDisabled) return;
    try {
      await apiSetManual({ vent: !status.ventilador });
      showToast(!status.ventilador ? 'Ventilador encendido' : 'Ventilador apagado');
      refresh();
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Error al controlar el ventilador';
      showToast(detail);
    }
  };

  const toggleLed = async () => {
    if (controlsDisabled) return;
    try {
      await apiSetManual({ led: !status.led });
      showToast(!status.led ? 'LED encendido' : 'LED apagado');
      refresh();
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Error al controlar el LED';
      showToast(detail);
    }
  };

  const sensorOk = !!status?.ok && !error;

  return (
    <div className="bti-grain min-h-screen text-stone-50 font-body">
      <div className="mx-auto w-full max-w-app min-h-screen flex flex-col">
        <StatusBanner mode={bannerMode} onOpenSettings={() => setSettingsOpen(true)} />

        <main data-testid="app-main" className="px-5 pt-5 pb-28 flex-1 flex flex-col gap-5">
          {/* Banner de error global */}
          {error && (
            <div
              data-testid="global-error-banner"
              className="bti-fade rounded-2xl border border-rose-500/50 bg-rose-500/10 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Warning size={22} className="text-rose-400 shrink-0" weight="duotone" />
                <div className="min-w-0">
                  <div className="font-display font-semibold text-rose-100">Sin respuesta del ESP32</div>
                  <p className="text-xs text-rose-200/80 truncate">{error}</p>
                </div>
              </div>
              <button
                data-testid="retry-button"
                onClick={refresh}
                className="shrink-0 h-10 px-4 rounded-lg bg-rose-500 text-stone-950 font-bold text-sm hover:bg-rose-400 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Métricas */}
          <section className="grid grid-cols-2 gap-3">
            <MetricCard
              testId="metric-temperature"
              label="Temperatura"
              unit="°C"
              value={status?.temperatura}
              icon={<Thermometer size={22} weight="duotone" />}
              accent="amber"
            />
            <MetricCard
              testId="metric-humidity"
              label="Humedad"
              unit="%"
              value={status?.humedad}
              icon={<Drop size={22} weight="duotone" />}
              accent="sky"
            />
          </section>

          {/* Card de sensor */}
          <section
            data-testid="sensor-card"
            className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {sensorOk ? (
                <CheckCircle size={26} weight="duotone" className="text-emerald-400 shrink-0" />
              ) : (
                <Warning size={26} weight="duotone" className="text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-display font-semibold text-stone-100">
                  Sensor DHT11: {sensorOk ? 'OK' : 'Sin datos'}
                </div>
                <div data-testid="last-update" className="text-xs text-stone-400 truncate">
                  Última lectura: {formatTime(lastUpdate)}
                </div>
              </div>
            </div>
            <button
              data-testid="refresh-button"
              onClick={refresh}
              aria-label="Refrescar"
              className="w-11 h-11 rounded-full bg-stone-800 text-stone-200 flex items-center justify-center hover:bg-stone-700 hover:text-amber-400 transition-colors"
            >
              <ArrowsClockwise size={20} weight="bold" className={loading ? 'animate-spin' : ''} />
            </button>
          </section>

          {/* Mode toggle */}
          <section>
            <ModeToggle auto={auto} onChange={handleModeChange} disabled={!online} />
          </section>

          {/* Control buttons */}
          <section className="grid grid-cols-2 gap-3">
            <ControlButton
              testId="control-vent"
              label="Ventilador"
              active={!!status?.ventilador}
              onToggle={toggleVent}
              disabled={controlsDisabled}
              icon={
                <Fan
                  size={22}
                  weight="duotone"
                  className={status?.ventilador ? 'animate-spin' : ''}
                />
              }
              activeIcon={<Fan size={22} weight="fill" className="animate-spin" />}
            />
            <ControlButton
              testId="control-led"
              label="LED"
              active={!!status?.led}
              onToggle={toggleLed}
              disabled={controlsDisabled}
              glow
              icon={<Lightbulb size={22} weight="duotone" />}
              activeIcon={<LightbulbFilament size={22} weight="fill" />}
            />
          </section>

          {/* Setpoints */}
          <section>
            <SetpointsForm
              currentOn={status?.setpointOn}
              currentOff={status?.setpointOff}
              onSaved={() => {
                showToast('Setpoints guardados');
                refresh();
              }}
            />
          </section>

          <footer className="mt-auto pt-6 text-center">
            <p data-testid="footer-disclaimer" className="text-[11px] text-stone-500 leading-relaxed px-4">
              BTI · Esto es apoyo tecnológico y no sustituye tratamiento médico.
            </p>
          </footer>
        </main>

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSaved={(saved) => {
            setConfig(saved);
            showToast('Configuración guardada');
            refresh();
          }}
        />

        {toast && (
          <div
            data-testid="toast"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bti-fade"
          >
            <div className="px-4 py-2.5 rounded-full bg-stone-50 text-stone-950 font-semibold text-sm shadow-xl shadow-black/40">
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
