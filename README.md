# BTI · Monitor de cápsula de conservación de miel

Aplicación PWA móvil (React 18 + Tailwind) con backend FastAPI que actúa como **proxy HTTPS↔HTTP** hacia un ESP32 local. Incluye un **simulador en memoria** para desarrollo/demostración sin hardware.

## Arquitectura

```
┌──────────────────────┐    HTTPS     ┌────────────────────┐    HTTP (LAN)    ┌────────────┐
│  PWA Mobile (React)  │ ───────────▶ │  Backend FastAPI   │ ───────────────▶ │   ESP32    │
│  max-w-[430px]       │              │  /api/*            │                  │ DHT11+FAN  │
│  Polling cada 2 s    │ ◀─────────── │  Proxy + Simulador │ ◀─────────────── │   +LED     │
└──────────────────────┘              └────────────────────┘                  └────────────┘
                                            │
                                            ▼
                                      ┌──────────┐
                                      │ MongoDB  │  (solo config)
                                      │ bti_db   │
                                      └──────────┘
```

* **Frontend**: React 18 + Tailwind + `@phosphor-icons/react` + `axios`. Mobile-first, tema dark IoT (stone-950 / stone-900 / amber-500), tipografías Outfit, Work Sans, IBM Plex Mono.
* **Backend**: FastAPI con `httpx` (timeout 3 s) como proxy, validación de setpoints, simulador integrado.
* **DB**: MongoDB `bti_db` colección `config`, doc único `_id="default"` con `{ip, simulator}`.

## API del backend (prefijo `/api`)

| Método | Ruta         | Descripción |
|-------:|--------------|-------------|
| GET    | `/health`    | `{ok, service:"bti-api"}` |
| GET    | `/config`    | `{ip, simulator}` (default `192.168.1.45`, `true`) |
| POST   | `/config`    | body `{ip, simulator}` |
| GET    | `/status`    | `{ok, temperatura, humedad, modoAuto, ventilador, led, setpointOn, setpointOff, timestampMs, source}` |
| POST   | `/modo?auto=0\|1` | Cambia modo automático |
| POST   | `/manual?vent=0\|1&led=0\|1` | 400 si modo auto |
| POST   | `/setpoints?on=30&off=29` | 400 si `off >= on` o fuera de `[-20, 80]` |

Todas las respuestas de `/status`, `/modo`, `/manual`, `/setpoints` agregan `source: "simulator"|"esp32"`.

### Contrato asumido del ESP32

```
GET  /status   → {ok, temperatura, humedad, modoAuto, ventilador, led, setpointOn, setpointOff, timestampMs}
POST /modo?auto=0|1
POST /manual?vent=0|1&led=0|1
POST /setpoints?on=30.0&off=29.0
```

## Simulador

* Temperatura: `29 + sin(t/5) * 1.8`
* Humedad: `43 + cos(t/7) * 3`
* En `auto`, aplica histéresis:
  * `temp >= setpointOn` → ventilador + LED ON
  * `temp <= setpointOff` → ambos OFF
  * entre ambos → conserva último estado
* Setpoints por defecto: on=30.0, off=29.0

## Ejecución local

### Backend

```bash
cd backend
pip install -r requirements.txt
# .env ya contiene MONGO_URL, DB_NAME
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
# .env ya define REACT_APP_BACKEND_URL
yarn start   # puerto 3000
```

### En Emergent

Backend y frontend están gobernados por supervisor:

```bash
sudo supervisorctl restart backend frontend
```

Todas las llamadas del frontend usan `REACT_APP_BACKEND_URL + /api/...` y el ingress las enruta al backend `:8001`.

## Firmware ESP32

Código Arduino de referencia en [`firmware/esp32_bti.ino`](firmware/esp32_bti.ino).

* Sensor **DHT11** en **GPIO4**
* **Ventilador** en **GPIO26** (relé/MOSFET activo en ALTO)
* **LED** en **GPIO27** (activo en ALTO)
* Servidor web en el puerto **80** con las 4 rutas del contrato
* **CORS abierto** (`Access-Control-Allow-Origin: *`)
* Ciclo de lectura cada **2 s** + histéresis
* Librerías: `WiFi.h`, `WebServer.h`, `DHT.h` (Adafruit)

Configura `WIFI_SSID` y `WIFI_PASSWORD` al inicio del `.ino`. Tras flashear, abre el monitor serial para ver la IP asignada e introdúcela desde la pantalla de **Configuración** de la PWA (apagando el modo Simulador).

## Checklist manual de validación

- [ ] El banner superior muestra dot verde pulsante y "Simulador activo".
- [ ] Las métricas de Temperatura y Humedad se actualizan cada 2 s.
- [ ] El card de sensor muestra "Sensor DHT11: OK" y hora de última lectura.
- [ ] Botón de refresco animado (`animate-spin`) durante la petición manual.
- [ ] Toggle Automático/Manual cambia el `modoAuto` en backend.
- [ ] En **Manual**, los botones de Ventilador y LED alternan ON/OFF (fan gira, LED brilla con glow ámbar).
- [ ] En **Auto**, los controles aparecen `opacity-40 grayscale`.
- [ ] Formulario setpoints rechaza `off >= on` con mensaje rosa.
- [ ] Formulario setpoints acepta valores válidos y muestra mensaje verde.
- [ ] Modal de configuración es bottom-sheet, toggle Simulador habilita/deshabilita el input IP.
- [ ] IP inválida muestra error; IP válida guarda en backend y en `localStorage` (`bti.config.cache`).
- [ ] Al apagar el simulador sin ESP32 real accesible, aparece el banner rojo "Sin respuesta del ESP32" + botón Reintentar.
- [ ] Toast inferior confirma cada acción (modo cambiado, setpoints, configuración).
- [ ] Footer muestra: `BTI · Esto es apoyo tecnológico y no sustituye tratamiento médico.`
- [ ] Áreas táctiles ≥ 44–56 px; layout `max-w-[430px]`.

## Sugerencias para V2

* **Historial + mini-gráfica**: almacenar lecturas cada N segundos en Mongo y renderizar un sparkline 1h/24h con `recharts`.
* **Exportar CSV**: endpoint `/api/export?from=...&to=...` con streaming CSV de lecturas.
* **Notificaciones push** (Web Push API + VAPID) ante alertas de temperatura fuera de rango o desconexión prolongada.
* **Multi-dispositivo**: permitir registrar varios ESP32 (por alias) y cambiar entre ellos desde el banner.
* **OTA updates**: firmware con `ArduinoOTA` y panel en la PWA para subir `.bin` a cada dispositivo.
* **Auth simple** (PIN o Emergent Google Auth) para que solo usuarios autorizados cambien setpoints.
* **Integración con backend de analítica** (Prometheus/Grafana o InfluxDB) para observabilidad industrial.
