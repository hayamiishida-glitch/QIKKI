import { useCallback, useEffect, useState } from 'react';
import { isDesktopApp } from '../services/notificationService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIOSUA = /iphone|ipad|ipod/.test(ua);
  const isIPadOSDesktopMode =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOSUA || isIPadOSDesktopMode;
}

export function detectIsMacOS(): boolean {
  if (typeof window !== 'undefined' && window.qikkiDesktop?.platform === 'darwin') {
    return true;
  }
  if (typeof navigator === 'undefined') return false;
  if (detectIsIOS()) return false;
  const ua = navigator.userAgent.toLowerCase();
  return /macintosh|mac os x/.test(ua);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      isDesktopApp() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);
    setIsIOS(detectIsIOS());
    setIsMacOS(detectIsMacOS());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isMacOS,
    install,
  };
}
