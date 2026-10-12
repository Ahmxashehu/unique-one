import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const PWA_CACHE_MIGRATION = 'unique-one-pwa-cache-migration-v13';

async function recoverStalePwaCache(): Promise<boolean> {
  if (window.localStorage.getItem(PWA_CACHE_MIGRATION) === 'done') return false;
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.filter((key) => key.startsWith('unique-platform-app-')).map((key) => caches.delete(key)));
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
    window.location.reload();
    return true;
  } catch (error) {
    console.warn('PWA cache recovery was skipped:', error);
    window.localStorage.setItem(PWA_CACHE_MIGRATION, 'done');
    return false;
  }
}

function installRuntimeDiagnostics() {
  const showRuntimeFailure = (message: string) => {
    const root = document.getElementById('root');
    if (!root) return;
    root.replaceChildren();
    const shell = document.createElement('div');
    shell.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:system-ui,sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(100%,420px);padding:24px;border:1px solid #e2e8f0;border-radius:24px;background:white;box-shadow:0 20px 50px rgba(15,23,42,.12)';
    const title = document.createElement('div');
    title.textContent = 'UniquePlatform';
    title.style.cssText = 'font-size:20px;font-weight:900;color:#0f172a';
    const detail = document.createElement('div');
    detail.textContent = 'The app hit a loading error. Please reload once.';
    detail.style.cssText = 'margin-top:8px;font-size:14px;color:#64748b';
    const messageBox = document.createElement('div');
    messageBox.textContent = message;
    messageBox.style.cssText = 'margin-top:12px;padding:10px;border-radius:12px;background:#f1f5f9;color:#475569;font-size:11px;word-break:break-word';
    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.type = 'button';
    reload.style.cssText = 'margin-top:16px;border:0;border-radius:14px;background:#059669;color:white;padding:12px 18px;font-weight:800';
    reload.addEventListener('click', () => window.location.reload());
    card.append(title, detail, messageBox, reload);
    shell.append(card);
    root.append(shell);
  };

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const source = (target as HTMLScriptElement | HTMLLinkElement).src || (target as HTMLLinkElement).href || '';
      if (!source || new URL(source, window.location.href).origin !== window.location.origin) return;
      showRuntimeFailure('Failed to load app ' + target.tagName.toLowerCase() + ' resource.');
      return;
    }
    const errorEvent = event as ErrorEvent;
    if (errorEvent.message && errorEvent.message !== 'Script error.') showRuntimeFailure(errorEvent.message);
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '');
    console.error('Unhandled application promise rejection:', reason);
    if (/failed to fetch dynamically imported module|loading chunk .* failed|importing a module script failed/i.test(message)) showRuntimeFailure(message);
  });
}

async function startApp() {
  const reloadStarted = await recoverStalePwaCache();
  if (reloadStarted) return;
  installRuntimeDiagnostics();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
