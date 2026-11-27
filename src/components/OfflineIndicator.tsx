import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Offline Mode — Reminders run locally from IndexedDB.</span>
    </div>
  );
};
