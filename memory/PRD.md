# BTI · Monitor de cápsula de conservación de miel

## Problem statement (original)
App PWA móvil llamada BTI para monitoreo de temperatura/humedad y control de un ESP32 (cápsula de conservación de miel). Frontend React 18 PWA mobile-first (max-w-[430px]) + Tailwind + @phosphor-icons/react + axios. Backend FastAPI actuando como proxy HTTPS↔HTTP hacia ESP32 local + modo Simulador integrado en memoria. MongoDB solo para config (bti_db, colección config, _id="default", campos ip y simulator). Idioma español. Tema visual dark stone-950/stone-900/amber-500 con Outfit/Work Sans/IBM Plex Mono.

## Arquitectura
- **Frontend** (`/app/frontend`): React 18 + Tailwind + Phosphor + axios, PWA con manifest y service worker mínimo. Layout `max-w-app` (430px).
- **Backend** (`/app/backend`): FastAPI + Motor + httpx. Endpoints bajo `/api`. Simulador singleton en memoria.
- **DB**: MongoDB (`bti_db`), colección `config`, documento único `_id="default"`.
- **Firmware** (`/app/firmware/esp32_bti.ino`): Arduino de referencia (DHT11 GPIO4, Fan GPIO26, LED GPIO27, servidor :80, CORS abierto).

## Core requirements (estáticos)
- Contrato con el ESP32: `GET /status`, `POST /modo?auto=0|1`, `POST /manual?vent=0|1&led=0|1`, `POST /setpoints?on&off`.
- Backend debe validar histéresis (`off < on`) y rango `[-20, 80]` °C.
- Simulador: `temp = 29 + sin(t/5)*1.8`, `hum = 43 + cos(t/7)*3`, reglas auto con histéresis.
- Polling del frontend cada 2 s.
- Todos los elementos interactivos con `data-testid` en kebab-case.
- Áreas táctiles ≥ 44-56 px.

## Implementado (2026-01)
- ✅ Backend completo con todos los endpoints y validaciones.
- ✅ Simulador funcional con lógica de histéresis en auto.
- ✅ Persistencia de config en MongoDB.
- ✅ Frontend PWA completo: StatusBanner, MetricCard x2, Sensor card con refresh animado, ModeToggle, ControlButton x2 (Fan con animate-spin cuando ON, LED con glow ámbar cuando ON), SetpointsForm con validación, SettingsModal bottom-sheet, banner de error global con reintentar, toast bottom-center.
- ✅ Validación de IP (IPv4 con puerto o hostname/mDNS) en frontend y backend.
- ✅ Footer con disclaimer.
- ✅ Firmware Arduino de referencia para ESP32.
- ✅ README con arquitectura, API, instrucciones, checklist de validación y sugerencias V2.
- ✅ Testing: 100% backend (12/12 pytest), 100% flujos frontend críticos.

## Backlog / V2
- P1: Historial de lecturas en MongoDB + mini-gráfica (sparkline 1h/24h).
- P1: Exportar CSV (endpoint streaming).
- P2: Notificaciones push (Web Push + VAPID) ante alertas.
- P2: Soporte multi-dispositivo (alias por ESP32, selector en banner).
- P2: OTA updates (`ArduinoOTA` + panel en PWA).
- P2: Auth simple (PIN o Emergent Google Auth) para proteger setpoints.
- P2: Observabilidad (Prometheus/InfluxDB).
- P2: Pausar polling en `document.visibilityState === 'hidden'` para ahorrar red/batería.
