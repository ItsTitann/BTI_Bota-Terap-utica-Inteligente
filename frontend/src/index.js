import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Registro PWA best-effort (opcional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Service worker simple inline como Blob para habilitar instalabilidad mínima
    const swCode = "self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',()=>{});";
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
