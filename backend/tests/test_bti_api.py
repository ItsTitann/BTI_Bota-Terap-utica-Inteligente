"""BTI backend API tests.

Cubre:
- /api/health
- /api/config (GET/POST)
- /api/status (simulador)
- /api/modo (auto toggle)
- /api/manual (validación modo auto)
- /api/setpoints (validación histéresis y rango)
- Respeto de histéresis en auto (revisión simulator.read())
"""
import os
import time

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE_URL:
    # Fallback leyendo frontend/.env directamente
    env_path = "/app/frontend/.env"
    with open(env_path) as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def ensure_simulator_on(client):
    """Asegura que el modo simulador está activo antes de las pruebas."""
    r = client.post(f"{API}/config", json={"ip": "192.168.1.45", "simulator": True})
    assert r.status_code == 200
    # devolver al modo auto
    client.post(f"{API}/modo", params={"auto": 1})
    yield


# ----- Health -----

def test_health_ok(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    data = r.json()
    assert data == {"ok": True, "service": "bti-api"}


# ----- Config -----

def test_get_config_defaults(client):
    r = client.get(f"{API}/config")
    assert r.status_code == 200
    data = r.json()
    assert "ip" in data and "simulator" in data
    assert isinstance(data["ip"], str)
    assert isinstance(data["simulator"], bool)


def test_post_config_persists(client):
    payload = {"ip": "10.0.0.99", "simulator": True}
    r = client.post(f"{API}/config", json=payload)
    assert r.status_code == 200
    assert r.json() == payload

    r2 = client.get(f"{API}/config")
    assert r2.status_code == 200
    assert r2.json()["ip"] == "10.0.0.99"
    assert r2.json()["simulator"] is True

    # Restaurar default
    client.post(f"{API}/config", json={"ip": "192.168.1.45", "simulator": True})


# ----- Status -----

def test_status_simulator_fields(client):
    r = client.get(f"{API}/status")
    assert r.status_code == 200
    data = r.json()
    required = {"ok", "temperatura", "humedad", "modoAuto", "ventilador",
                "led", "setpointOn", "setpointOff", "timestampMs", "source"}
    assert required.issubset(data.keys())
    assert data["source"] == "simulator"
    assert data["ok"] is True
    assert isinstance(data["temperatura"], (int, float))
    assert isinstance(data["humedad"], (int, float))


# ----- Modo -----

def test_set_modo_auto_0_y_1(client):
    r = client.post(f"{API}/modo", params={"auto": 0})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["modoAuto"] is False
    # GET verifica
    s = client.get(f"{API}/status").json()
    assert s["modoAuto"] is False

    r2 = client.post(f"{API}/modo", params={"auto": 1})
    assert r2.status_code == 200
    assert r2.json()["modoAuto"] is True
    s2 = client.get(f"{API}/status").json()
    assert s2["modoAuto"] is True


# ----- Manual -----

def test_manual_funciona_en_modo_manual(client):
    # Pasar a manual
    client.post(f"{API}/modo", params={"auto": 0})
    r = client.post(f"{API}/manual", params={"vent": 1, "led": 1})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["ventilador"] is True
    assert data["led"] is True

    # Verificar via /status
    s = client.get(f"{API}/status").json()
    assert s["ventilador"] is True
    assert s["led"] is True

    # Apagarlo
    r2 = client.post(f"{API}/manual", params={"vent": 0, "led": 0})
    assert r2.status_code == 200
    assert r2.json()["ventilador"] is False
    assert r2.json()["led"] is False


def test_manual_en_modo_auto_devuelve_400(client):
    client.post(f"{API}/modo", params={"auto": 1})
    r = client.post(f"{API}/manual", params={"vent": 1, "led": 1})
    assert r.status_code == 400
    assert "detail" in r.json()


# ----- Setpoints -----

def test_setpoints_validos(client):
    r = client.post(f"{API}/setpoints", params={"on": 30, "off": 29})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["setpointOn"] == 30
    assert data["setpointOff"] == 29

    s = client.get(f"{API}/status").json()
    assert s["setpointOn"] == 30
    assert s["setpointOff"] == 29


def test_setpoints_histeresis_invalida(client):
    r = client.post(f"{API}/setpoints", params={"on": 29, "off": 30})
    assert r.status_code == 400
    assert "Histéresis" in r.json()["detail"] or "hist" in r.json()["detail"].lower()


def test_setpoints_fuera_de_rango(client):
    r = client.post(f"{API}/setpoints", params={"on": 90, "off": 85})
    assert r.status_code == 400
    assert "detail" in r.json()


def test_setpoints_iguales_invalido(client):
    r = client.post(f"{API}/setpoints", params={"on": 30, "off": 30})
    assert r.status_code == 400


# ----- Histéresis en auto -----

def test_histeresis_auto_fuerza_on_off(client):
    """Con setpoints extremos, el simulador debe encender o apagar
    automáticamente ventilador y LED según la temperatura."""
    client.post(f"{API}/modo", params={"auto": 1})

    # Forzar OFF: temperatura siempre es < 50, con setpointOff=50, on=55 -> OFF
    r = client.post(f"{API}/setpoints", params={"on": 55, "off": 50})
    assert r.status_code == 200
    time.sleep(0.5)
    s = client.get(f"{API}/status").json()
    assert s["temperatura"] < 50  # sanity
    assert s["ventilador"] is False
    assert s["led"] is False

    # Forzar ON: temperatura ~29 oscilando, con setpointOn=10, setpointOff=5 -> ON
    r2 = client.post(f"{API}/setpoints", params={"on": 10, "off": 5})
    assert r2.status_code == 200
    time.sleep(0.5)
    s2 = client.get(f"{API}/status").json()
    assert s2["temperatura"] > 10  # sanity
    assert s2["ventilador"] is True
    assert s2["led"] is True

    # Restaurar
    client.post(f"{API}/setpoints", params={"on": 30, "off": 29})
