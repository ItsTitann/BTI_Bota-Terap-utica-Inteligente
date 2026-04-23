/*
 * BTI - Firmware de referencia para ESP32
 * ----------------------------------------
 * Cápsula de conservación de miel.
 *  - Sensor DHT11 en GPIO4
 *  - Ventilador en GPIO26 (relé o MOSFET, activo en ALTO)
 *  - LED en GPIO27 (indicador o tira, activo en ALTO)
 *  - Servidor web con 4 rutas (JSON, CORS abierto)
 *  - Lectura del sensor cada 2 s
 *
 * Librerías requeridas (Arduino Library Manager):
 *   - DHT sensor library (by Adafruit)
 *   - Adafruit Unified Sensor
 *
 * Board: "ESP32 Dev Module"
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>

// -------------------- Configuración --------------------
const char* WIFI_SSID     = "TU_SSID";
const char* WIFI_PASSWORD = "TU_PASSWORD";

#define DHTPIN        4
#define DHTTYPE       DHT11
#define PIN_VENT      26
#define PIN_LED       27
#define READ_INTERVAL 2000UL   // ms

// -------------------- Estado ---------------------------
DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);

float  temperatura = NAN;
float  humedad     = NAN;
bool   modoAuto    = true;
bool   ventilador  = false;
bool   led         = false;
float  setpointOn  = 30.0;
float  setpointOff = 29.0;
unsigned long lastRead = 0;

// -------------------- Helpers CORS ---------------------
void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleOptions() {
  sendCors();
  server.send(204);
}

void sendJson(int code, const String& body) {
  sendCors();
  server.send(code, "application/json", body);
}

void applyOutputs() {
  digitalWrite(PIN_VENT, ventilador ? HIGH : LOW);
  digitalWrite(PIN_LED,  led        ? HIGH : LOW);
}

void autoControl() {
  if (!modoAuto) return;
  if (isnan(temperatura)) return;
  if (temperatura >= setpointOn) {
    ventilador = true;
    led        = true;
  } else if (temperatura <= setpointOff) {
    ventilador = false;
    led        = false;
  }
  // Histéresis: entre ambos setpoints, conservar estado
}

// -------------------- Rutas ----------------------------
void handleStatus() {
  String body = "{";
  body += "\"ok\":" + String(!isnan(temperatura) ? "true" : "false") + ",";
  body += "\"temperatura\":" + String(isnan(temperatura) ? 0 : temperatura, 2) + ",";
  body += "\"humedad\":"     + String(isnan(humedad)     ? 0 : humedad, 2)     + ",";
  body += "\"modoAuto\":"    + String(modoAuto    ? "true" : "false") + ",";
  body += "\"ventilador\":"  + String(ventilador  ? "true" : "false") + ",";
  body += "\"led\":"         + String(led         ? "true" : "false") + ",";
  body += "\"setpointOn\":"  + String(setpointOn, 2)  + ",";
  body += "\"setpointOff\":" + String(setpointOff, 2) + ",";
  body += "\"timestampMs\":" + String(millis());
  body += "}";
  sendJson(200, body);
}

void handleModo() {
  if (!server.hasArg("auto")) { sendJson(400, "{\"ok\":false,\"error\":\"missing auto\"}"); return; }
  modoAuto = (server.arg("auto").toInt() == 1);
  sendJson(200, String("{\"ok\":true,\"modoAuto\":") + (modoAuto ? "true" : "false") + "}");
}

void handleManual() {
  if (modoAuto) {
    sendJson(400, "{\"ok\":false,\"error\":\"modo auto activo\"}");
    return;
  }
  if (server.hasArg("vent")) ventilador = (server.arg("vent").toInt() == 1);
  if (server.hasArg("led"))  led        = (server.arg("led").toInt()  == 1);
  applyOutputs();
  String body = String("{\"ok\":true,\"ventilador\":") + (ventilador ? "true" : "false") +
                ",\"led\":" + (led ? "true" : "false") + "}";
  sendJson(200, body);
}

void handleSetpoints() {
  if (!server.hasArg("on") || !server.hasArg("off")) {
    sendJson(400, "{\"ok\":false,\"error\":\"missing on/off\"}");
    return;
  }
  float on_  = server.arg("on").toFloat();
  float off_ = server.arg("off").toFloat();
  if (off_ >= on_) {
    sendJson(400, "{\"ok\":false,\"error\":\"histeresis invalida\"}");
    return;
  }
  if (on_ < -20 || on_ > 80 || off_ < -20 || off_ > 80) {
    sendJson(400, "{\"ok\":false,\"error\":\"fuera de rango\"}");
    return;
  }
  setpointOn  = on_;
  setpointOff = off_;
  String body = "{\"ok\":true,\"setpointOn\":" + String(setpointOn, 2) +
                ",\"setpointOff\":" + String(setpointOff, 2) + "}";
  sendJson(200, body);
}

// -------------------- Setup/loop -----------------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_VENT, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  applyOutputs();

  dht.begin();

  Serial.printf("Conectando a %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  server.on("/status",     HTTP_GET,  handleStatus);
  server.on("/modo",       HTTP_POST, handleModo);
  server.on("/manual",     HTTP_POST, handleManual);
  server.on("/setpoints",  HTTP_POST, handleSetpoints);
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) handleOptions();
    else sendJson(404, "{\"ok\":false,\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("HTTP server iniciado");
}

void loop() {
  server.handleClient();
  unsigned long now = millis();
  if (now - lastRead >= READ_INTERVAL) {
    lastRead = now;
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      humedad     = h;
      temperatura = t;
      autoControl();
      applyOutputs();
    }
  }
}
