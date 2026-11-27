import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DesktopAuthBridge } from './components/DesktopAuthBridge.tsx';
import { DesktopBrowserLogin } from './components/DesktopBrowserLogin.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

const searchParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const isDesktopAuthBridge = searchParams?.get('qikkiDesktopAuth') === '1';
const isDesktopBrowserLogin = searchParams?.get('desktopLogin') === '1';

const isDesktopRuntime =
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { qikkiDesktop?: { isDesktop?: boolean } }).qikkiDesktop?.isDesktop);

if (
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol !== 'file:'
) {
  if (import.meta.env.DEV || isDesktopRuntime || isDesktopAuthBridge || isDesktopBrowserLogin) {
    // Clear any stale dev/desktop service worker & caches so updates always load immediately
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => void reg.unregister());
    });
    if (typeof caches !== 'undefined') {
      void caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key));
      });
    }
  } else {
    window.addEventListener('load', () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });

      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(
  isDesktopAuthBridge ? (
    <DesktopAuthBridge />
  ) : isDesktopBrowserLogin ? (
    <DesktopBrowserLogin />
  ) : (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
);
