import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const PWA_CACHE_MIGRATION = 'unique-one-pwa-cache-migration-v2';

async function recoverStalePwaCache() {
  if (window.localStorage.getItem(PWA_CACHE_MIGRATION) === 'done') return;
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.filter((key) => key.startsWith('unique-platform-app-')).map((key) => caches.delete(key)));
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
    window.location.reload();
  } catch {
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
  }
}

void recoverStalePwaCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
