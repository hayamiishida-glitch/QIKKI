import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react';
import { AVATAR_PRESETS } from '../utils/avatarPresets';
import { UserAvatar } from './UserAvatar';

interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  onSaveAvatar: (url: string) => Promise<void> | void;
}

const MAX_AVATAR_DATA_CHARS = 64000;

function compressImageToDataUrl(img: HTMLImageElement): string {
  const attempts: Array<{ size: number; quality: number }> = [
    { size: 160, quality: 0.84 },
    { size: 144, quality: 0.74 },
    { size: 120, quality: 0.65 },
    { size: 96, quality: 0.56 },
  ];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const minDim = Math.min(img.width, img.height);
  const sx = (img.width - minDim) / 2;
  const sy = (img.height - minDim) / 2;

  for (const { size, quality } of attempts) {
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_CHARS) {
      return dataUrl;
    }
  }
  return '';
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  isOpen,
  onClose,
  currentPhotoURL,
  displayName,
  email,
  onSaveAvatar,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string>(
    currentPhotoURL || ''
  );
  const [activeTab, setActiveTab] = useState<'presets' | 'gallery'>('presets');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPhoto(currentPhotoURL || '');
    setFileError(null);
    setIsProcessingFile(false);
    setIsSaving(false);
    setActiveTab('presets');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen, currentPhotoURL]);

  const handleProcessFile = (file: File) => {
    setFileError(null);
    if (!file.type.startsWith('image/')) {
      setFileError('Please select a valid image file (PNG, JPG, WebP, GIF, or SVG).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFileError('Image is too large. Please select an image under 8 MB.');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setIsProcessingFile(false);
        setFileError('Could not read image file.');
        return;
      }

      if (
        file.type === 'image/svg+xml' &&
        result.length <= MAX_AVATAR_DATA_CHARS
      ) {
        setSelectedPhoto(result);
        setIsProcessingFile(false);
        return;
      }

      // Resize & center-crop square via Canvas so image fits smoothly in Firestore & localStorage
      const img = new Image();
      img.onload = () => {
        try {
          const compressedDataUrl = compressImageToDataUrl(img);
          if (!compressedDataUrl) {
            setFileError('Image is too complex to store. Please choose a smaller photo.');
          } else {
            setSelectedPhoto(compressedDataUrl);
          }
        } catch {
          if (result.length <= MAX_AVATAR_DATA_CHARS) {
            setSelectedPhoto(result);
          } else {
            setFileError('Could not process this image. Please try another photo.');
          }
        } finally {
          setIsProcessingFile(false);
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setFileError('Failed to load image preview.');
      };
      img.src = result;
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      setFileError('Could not load selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFileError(null);
    try {
      await onSaveAvatar(selectedPhoto);
      onClose();
    } catch (err) {
      console.error('Failed to save profile picture:', err);
      setFileError('Could not update profile picture right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToInitials = async () => {
    setIsSaving(true);
    setFileError(null);
    try {
      await onSaveAvatar('');
      onClose();
    } catch (err) {
      console.error('Failed to clear avatar:', err);
      setFileError('Could not reset profile picture right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md backdrop-saturate-150"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="qikki-glass-card qikki-glass-modal relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_28px_60px_-14px_rgba(15,23,42,0.32),inset_0_1.5px_0_rgba(255,255,255,0.9)] backdrop-blur-[32px] sm:p-6 dark:border-white/18 dark:bg-slate-900/65 dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7),inset_0_1.5px_0_rgba(255,255,255,0.2)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900/[0.08] pb-4 dark:border-white/[0.08]">
              <div>
                <h2
                  id="avatar-modal-title"
                  className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  Choose Profile Picture
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a cute hand-crafted avatar or upload from your device
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Live Preview with Neon Tracing Animation */}
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="relative">
                <UserAvatar
                  photoURL={selectedPhoto}
                  displayName={displayName}
                  email={email}
                  size="xl"
                  showTracing={true}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                Live Preview
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                <Sparkles className="h-3 w-3" />
                Animated neon border tracing active
              </span>
            </div>

            {/* Segmented Mode Selector */}
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-900/10 bg-slate-900/5 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
                  activeTab === 'presets'
                    ? 'border border-white/60 bg-white text-slate-900 shadow-xs dark:border-white/15 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Cute Presets ({AVATAR_PRESETS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gallery')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
                  activeTab === 'gallery'
                    ? 'border border-white/60 bg-white text-slate-900 shadow-xs dark:border-white/15 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Upload from Gallery</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {activeTab === 'presets' ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = selectedPhoto === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPhoto(preset.url)}
                        className={`group relative flex flex-col items-center rounded-2xl border p-2.5 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/40 dark:border-blue-400 dark:bg-blue-950/40'
                            : 'border-slate-900/10 bg-white/50 hover:border-slate-900/20 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="relative">
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="h-12 w-12 rounded-full object-cover shadow-xs transition-transform group-hover:scale-105"
                          />
                          {isSelected && (
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className="mt-1.5 truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4 py-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleProcessFile(file);
                    }}
                    className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/40 dark:border-white/20 dark:bg-slate-800/40 dark:hover:border-blue-400 dark:hover:bg-blue-950/20"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Upload className="h-6 w-6 stroke-[2]" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-white">
                      {isProcessingFile ? 'Processing image...' : 'Click or drag image here'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Supports PNG, JPG, WebP, GIF, or SVG
                    </p>
                  </div>

                  {fileError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{fileError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/[0.08] pt-4 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={handleResetToInitials}
                disabled={isSaving}
                className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Reset to Initials
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-900/10 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="qikki-accent-btn inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Apply Profile Picture'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
