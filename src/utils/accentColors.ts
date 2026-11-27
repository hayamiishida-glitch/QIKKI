export type AccentColorId =
  | 'blue'
  | 'violet'
  | 'teal'
  | 'emerald'
  | 'rose'
  | 'orange';

export interface AccentColorPreset {
  id: AccentColorId;
  label: string;
  swatchHex: string;
  btnBg: string;
  btnHover: string;
  btnDarkBg: string;
  btnDarkHover: string;
  btnBorder: string;
  btnRing: string;
  btnGlow: string;
}

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  {
    id: 'blue',
    label: 'Blue',
    swatchHex: '#2563EB',
    btnBg: '#2563EB',
    btnHover: '#1D4ED8',
    btnDarkBg: '#3B82F6',
    btnDarkHover: '#60A5FA',
    btnBorder: 'rgba(96, 165, 250, 0.45)',
    btnRing: '#2563EB',
    btnGlow: 'rgba(37, 99, 235, 0.55)',
  },
  {
    id: 'violet',
    label: 'Violet',
    swatchHex: '#7C3AED',
    btnBg: '#7C3AED',
    btnHover: '#6D28D9',
    btnDarkBg: '#8B5CF6',
    btnDarkHover: '#A78BFA',
    btnBorder: 'rgba(167, 139, 250, 0.45)',
    btnRing: '#7C3AED',
    btnGlow: 'rgba(124, 58, 237, 0.52)',
  },
  {
    id: 'teal',
    label: 'Teal',
    swatchHex: '#0D9488',
    btnBg: '#0D9488',
    btnHover: '#0F766E',
    btnDarkBg: '#14B8A6',
    btnDarkHover: '#2DD4BF',
    btnBorder: 'rgba(45, 212, 191, 0.45)',
    btnRing: '#0D9488',
    btnGlow: 'rgba(13, 148, 136, 0.5)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatchHex: '#059669',
    btnBg: '#059669',
    btnHover: '#047857',
    btnDarkBg: '#10B981',
    btnDarkHover: '#34D399',
    btnBorder: 'rgba(52, 211, 153, 0.45)',
    btnRing: '#059669',
    btnGlow: 'rgba(5, 150, 105, 0.5)',
  },
  {
    id: 'rose',
    label: 'Rose',
    swatchHex: '#E11D48',
    btnBg: '#E11D48',
    btnHover: '#BE123C',
    btnDarkBg: '#F43F5E',
    btnDarkHover: '#FB7185',
    btnBorder: 'rgba(251, 113, 133, 0.45)',
    btnRing: '#E11D48',
    btnGlow: 'rgba(225, 29, 72, 0.5)',
  },
  {
    id: 'orange',
    label: 'Orange',
    swatchHex: '#EA580C',
    btnBg: '#EA580C',
    btnHover: '#C2410C',
    btnDarkBg: '#F97316',
    btnDarkHover: '#FB923C',
    btnBorder: 'rgba(251, 146, 60, 0.45)',
    btnRing: '#EA580C',
    btnGlow: 'rgba(234, 88, 12, 0.5)',
  },
];

export function isValidAccentColorId(value: unknown): value is AccentColorId {
  return ACCENT_COLOR_PRESETS.some((preset) => preset.id === value);
}

export function getAccentPreset(id: AccentColorId): AccentColorPreset {
  return (
    ACCENT_COLOR_PRESETS.find((preset) => preset.id === id) ??
    ACCENT_COLOR_PRESETS[0]
  );
}

export function applyAccentColorToDocument(id: AccentColorId): void {
  if (typeof document === 'undefined') return;
  const preset = getAccentPreset(id);
  const root = document.documentElement;
  root.setAttribute('data-accent', preset.id);
  root.style.setProperty('--qikki-btn-bg', preset.btnBg);
  root.style.setProperty('--qikki-btn-hover', preset.btnHover);
  root.style.setProperty('--qikki-btn-dark-bg', preset.btnDarkBg);
  root.style.setProperty('--qikki-btn-dark-hover', preset.btnDarkHover);
  root.style.setProperty('--qikki-btn-border', preset.btnBorder);
  root.style.setProperty('--qikki-btn-ring', preset.btnRing);
  root.style.setProperty('--qikki-btn-glow', preset.btnGlow);
}
