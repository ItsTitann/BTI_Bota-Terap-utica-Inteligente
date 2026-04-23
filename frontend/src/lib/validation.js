// Validación de dirección del ESP32: IPv4 (con puerto opcional) o hostname/mDNS con al menos un punto.

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(:\d{1,5})?$/;
const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(:\d{1,5})?$/;

export function isValidEsp32Address(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (IPV4.test(v)) {
    const portMatch = v.match(/:(\d{1,5})$/);
    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      if (port < 1 || port > 65535) return false;
    }
    return true;
  }
  return HOSTNAME.test(v);
}

export function validateSetpoints(on, off) {
  const nOn = Number(on);
  const nOff = Number(off);
  if (Number.isNaN(nOn) || Number.isNaN(nOff)) {
    return 'Los setpoints deben ser números válidos';
  }
  if (nOn < -20 || nOn > 80 || nOff < -20 || nOff > 80) {
    return 'Los setpoints deben estar en el rango [-20, 80] °C';
  }
  if (nOff >= nOn) {
    return 'Histéresis inválida: OFF debe ser menor que ON';
  }
  return null;
}
