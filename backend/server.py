"""BTI - Backend API (FastAPI).

Actúa como proxy HTTPS↔HTTP hacia un ESP32 local y ofrece un
simulador integrado en memoria para desarrollo/demostración.

Endpoints bajo el prefijo /api:
    GET  /health
    GET  /config
    POST /config
    GET  /status
    POST /modo?auto=0|1
    POST /manual?vent=0|1&led=0|1
    POST /setpoints?on=30&off=29
"""

from __future__ import annotations

import math
import os
import time
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# ---------------------------------------------------------------------------
# Simulador en memoria
# ---------------------------------------------------------------------------


class Simulator:
    """Simulador sencillo de sensor DHT11 + actuadores."""

    def __init__(self) -> None:
        self.start = time.time()
        self.modo_auto: bool = True
        self.ventilador: bool = False
        self.led: bool = False
        self.setpoint_on: float = 30.0
        self.setpoint_off: float = 29.0

    def _now(self) -> float:
        return time.time() - self.start

    def read(self) -> dict:
        t = self._now()
        temperatura = round(29 + math.sin(t / 5.0) * 1.8, 2)
        humedad = round(43 + math.cos(t / 7.0) * 3, 2)

        if self.modo_auto:
            if temperatura >= self.setpoint_on:
                self.ventilador = True
                self.led = True
            elif temperatura <= self.setpoint_off:
                self.ventilador = False
                self.led = False
            # Si está entre medio, se mantiene el último estado (histéresis)

        return {
            "ok": True,
            "temperatura": temperatura,
            "humedad": humedad,
            "modoAuto": self.modo_auto,
            "ventilador": self.ventilador,
            "led": self.led,
            "setpointOn": self.setpoint_on,
            "setpointOff": self.setpoint_off,
            "timestampMs": int(time.time() * 1000),
        }

    def set_modo(self, auto: bool) -> None:
        self.modo_auto = auto

    def set_manual(self, vent: Optional[bool], led: Optional[bool]) -> None:
        if self.modo_auto:
            raise ValueError("No se puede controlar manualmente en modo automático")
        if vent is not None:
            self.ventilador = vent
        if led is not None:
            self.led = led

    def set_setpoints(self, on: float, off: float) -> None:
        if off >= on:
            raise ValueError("Histéresis inválida: off debe ser menor que on")
        if not (-20 <= on <= 80) or not (-20 <= off <= 80):
            raise ValueError("Setpoints fuera de rango permitido [-20, 80] °C")
        self.setpoint_on = on
        self.setpoint_off = off


simulator = Simulator()

# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

DEFAULT_CONFIG = {"ip": "192.168.1.45", "simulator": True}


async def get_config_doc() -> dict:
    doc = await db.config.find_one({"_id": "default"}, {"_id": 0})
    if not doc:
        await db.config.insert_one({"_id": "default", **DEFAULT_CONFIG})
        return DEFAULT_CONFIG.copy()
    return {"ip": doc.get("ip", DEFAULT_CONFIG["ip"]),
            "simulator": bool(doc.get("simulator", DEFAULT_CONFIG["simulator"]))}


async def save_config_doc(ip: str, simulator_flag: bool) -> dict:
    await db.config.update_one(
        {"_id": "default"},
        {"$set": {"ip": ip, "simulator": simulator_flag}},
        upsert=True,
    )
    return {"ip": ip, "simulator": simulator_flag}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ConfigModel(BaseModel):
    ip: str = Field(..., min_length=1, max_length=255)
    simulator: bool = True


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="BTI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def esp32_base_url() -> str:
    cfg = await get_config_doc()
    ip = cfg["ip"].strip()
    if "://" not in ip:
        ip = f"http://{ip}"
    return ip.rstrip("/")


async def esp32_get(path: str) -> dict:
    base = await esp32_base_url()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.get(f"{base}{path}")
        r.raise_for_status()
        return r.json()


async def esp32_post(path: str, params: dict) -> dict:
    base = await esp32_base_url()
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{base}{path}", params=params)
        r.raise_for_status()
        try:
            return r.json()
        except Exception:
            return {"ok": True}


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "service": "bti-api"}


@app.get("/api/config")
async def get_config() -> dict:
    return await get_config_doc()


@app.post("/api/config")
async def set_config(payload: ConfigModel) -> dict:
    return await save_config_doc(payload.ip, payload.simulator)


@app.get("/api/status")
async def status() -> dict:
    cfg = await get_config_doc()
    if cfg["simulator"]:
        data = simulator.read()
        data["source"] = "simulator"
        return data

    try:
        data = await esp32_get("/status")
        data["source"] = "esp32"
        return data
    except Exception as exc:  # pragma: no cover - error red real
        raise HTTPException(status_code=502, detail=f"ESP32 no responde: {exc}")


@app.post("/api/modo")
async def set_modo(auto: int = Query(..., ge=0, le=1)) -> dict:
    cfg = await get_config_doc()
    auto_bool = bool(auto)
    if cfg["simulator"]:
        simulator.set_modo(auto_bool)
        return {"ok": True, "modoAuto": auto_bool, "source": "simulator"}
    data = await esp32_post("/modo", {"auto": auto})
    data["source"] = "esp32"
    return data


@app.post("/api/manual")
async def set_manual(
    vent: Optional[int] = Query(None, ge=0, le=1),
    led: Optional[int] = Query(None, ge=0, le=1),
) -> dict:
    cfg = await get_config_doc()
    if cfg["simulator"]:
        try:
            simulator.set_manual(
                None if vent is None else bool(vent),
                None if led is None else bool(led),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return {
            "ok": True,
            "ventilador": simulator.ventilador,
            "led": simulator.led,
            "source": "simulator",
        }

    # En hardware real, confiamos en el ESP32 para validar modo auto.
    params: dict = {}
    if vent is not None:
        params["vent"] = vent
    if led is not None:
        params["led"] = led
    try:
        data = await esp32_post("/manual", params)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            raise HTTPException(
                status_code=400,
                detail="El ESP32 rechazó el control manual (probablemente está en modo automático)",
            )
        raise HTTPException(status_code=502, detail=str(exc))
    data["source"] = "esp32"
    return data


@app.post("/api/setpoints")
async def set_setpoints(
    on: float = Query(...),
    off: float = Query(...),
) -> dict:
    if off >= on:
        raise HTTPException(
            status_code=400,
            detail="Histéresis inválida: el setpoint OFF debe ser menor que el ON",
        )
    if not (-20 <= on <= 80) or not (-20 <= off <= 80):
        raise HTTPException(
            status_code=400,
            detail="Los setpoints deben estar en el rango [-20, 80] °C",
        )

    cfg = await get_config_doc()
    if cfg["simulator"]:
        simulator.set_setpoints(on, off)
        return {
            "ok": True,
            "setpointOn": on,
            "setpointOff": off,
            "source": "simulator",
        }

    data = await esp32_post("/setpoints", {"on": on, "off": off})
    data["source"] = "esp32"
    return data


@app.on_event("shutdown")
async def shutdown_event() -> None:
    mongo_client.close()
