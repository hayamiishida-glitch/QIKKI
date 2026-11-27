import React from 'react';
import { Camera } from 'lucide-react';

export interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTracing?: boolean;
  className?: string;
  onClick?: () => void;
  showEditBadge?: boolean;
}

const SIZE_MAP = {
  xs: {
    container: 'h-6 w-6',
    text: 'text-[10px]',
    ringInset: '-inset-[2px]',
    glowInset: '-inset-[3px]',
    badge: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5',
    badgeIcon: 'h-2 w-2',
  },
  sm: {
    container: 'h-8 w-8',
    text: 'text-xs',
    ringInset: '-inset-[2px]',
    glowInset: '-inset-[4px]',
    badge: 'h-4 w-4 -bottom-0.5 -right-0.5',
    badgeIcon: 'h-2.5 w-2.5',
  },
  md: {
    container: 'h-10 w-10',
    text: 'text-sm',
    ringInset: '-inset-[2.5px]',
    glowInset: '-inset-[5px]',
    badge: 'h-5 w-5 -bottom-0.5 -right-0.5',
    badgeIcon: 'h-2.5 w-2.5',
  },
  lg: {
    container: 'h-14 w-14',
    text: 'text-lg',
    ringInset: '-inset-[3px]',
    glowInset: '-inset-[6px]',
    badge: 'h-6 w-6 -bottom-1 -right-1',
    badgeIcon: 'h-3 w-3',
  },
  xl: {
    container: 'h-20 w-20',
    text: 'text-2xl',
    ringInset: '-inset-[3.5px]',
    glowInset: '-inset-[8px]',
    badge: 'h-7 w-7 -bottom-1 -right-1',
    badgeIcon: 'h-3.5 w-3.5',
  },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  email,
  size = 'md',
  showTracing = true,
  className = '',
  onClick,
  showEditBadge = false,
}) => {
  const currentSize = SIZE_MAP[size] || SIZE_MAP.md;

  const initials = (displayName || email || 'Q')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const effectivePhotoURL = photoURL && photoURL.trim() ? photoURL : null;

  const content = (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${currentSize.container} ${className}`}
    >
      {/* Outer spinning neon trace beam + soft breathing aura */}
      {showTracing && (
        <>
          <div
            aria-hidden="true"
            className={`qikki-avatar-trace-halo pointer-events-none absolute ${currentSize.glowInset} overflow-hidden rounded-full blur-[5px]`}
          >
            <div className="qikki-avatar-trace-beam" />
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute ${currentSize.ringInset} overflow-hidden rounded-full opacity-95`}
          >
            <div className="qikki-avatar-trace-beam" />
          </div>
        </>
      )}

      {/* Avatar Container with solid background so spinning gradient stays strictly on the border */}
      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white shadow-xs dark:border-slate-900/90 dark:bg-slate-900">
        {effectivePhotoURL ? (
          <img
            src={effectivePhotoURL}
            alt={displayName || 'User Avatar'}
            referrerPolicy="no-referrer"
            draggable={false}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-inner">
            <span className={currentSize.text}>{initials}</span>
          </div>
        )}
      </div>

      {/* Optional Edit / Camera indicator */}
      {showEditBadge && (
        <span
          className={`absolute z-20 flex items-center justify-center rounded-full border border-white bg-blue-600 text-white shadow-md transition-transform group-hover:scale-110 dark:border-slate-800 ${currentSize.badge}`}
          title="Change profile picture"
        >
          <Camera className={`${currentSize.badgeIcon} stroke-[2.2]`} />
        </span>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Change profile picture"
        aria-label="Change profile picture"
        className="group relative inline-flex shrink-0 cursor-pointer rounded-full transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {content}
      </button>
    );
  }

  return content;
};
