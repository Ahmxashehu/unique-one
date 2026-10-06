import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const PWA_CACHE_MIGRATION = 'unique-one-pwa-cache-migration-v12';

async function recoverStalePwaCache() {
  if (window.localStorage.getItem(PWA_CACHE_MIGRATION) === 'done') return;
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith('unique-platform-app-'))
        .map((key) => caches.delete(key)),
    );
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
    window.location.reload();
  } catch {
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
  }
}

function installRuntimeDiagnostics() {
  const showRuntimeFailure = (message: string) => {
    const root = document.getElementById('root');
    if (!root) return;
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:system-ui,sans-serif">
        <div style="width:min(100%,420px);padding:24px;border:1px solid #e2e8f0;border-radius:24px;background:white;box-shadow:0 20px 50px rgba(15,23,42,.12)">
          <div style="font-size:20px;font-weight:900;color:#0f172a">UniquePlatform</div>
          <div style="margin-top:8px;font-size:14px;color:#64748b">The app hit a loading error. Please reload once.</div>
          <div style="margin-top:12px;padding:10px;border-radius:12px;background:#f1f5f9;color:#475569;font-size:11px;word-break:break-word">${message}</div>
          <button onclick="location.reload()" style="margin-top:16px;border:0;border-radius:14px;background:#059669;color:white;padding:12px 18px;font-weight:800">Reload</button>
        </div>
      </div>`;
  };

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      showRuntimeFailure(`Failed to load ${target.tagName.toLowerCase()} resource.`);
    } else {
      showRuntimeFailure(event.message || 'Unknown runtime error.');
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    showRuntimeFailure(event.reason?.message || String(event.reason || 'Unhandled promise rejection.'));
  });
}

installRuntimeDiagnostics();
void recoverStalePwaCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
