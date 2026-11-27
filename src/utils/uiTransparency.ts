export const DEFAULT_UI_TRANSPARENCY = 50;

export interface UiTransparencyPreset {
  id: string;
  label: string;
  value: number;
}

export const UI_TRANSPARENCY_PRESETS: UiTransparencyPreset[] = [
  { id: 'solid', label: 'Solid', value: 10 },
  { id: 'frosted', label: 'Frosted', value: 30 },
  { id: 'glass', label: 'Liquid Glass', value: 50 },
  { id: 'crystal', label: 'Crystal', value: 75 },
  { id: 'ultra', label: 'Ultra Clear', value: 95 },
];

export function clampUiTransparency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_UI_TRANSPARENCY;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundAlpha(alpha: number): string {
  return (Math.round(alpha * 1000) / 1000).toString();
}

function piecewiseAlpha(
  t: number,
  solidAlpha: number,
  midAlpha: number,
  clearAlpha: number
): string {
  const val =
    t <= 0.5
      ? lerp(solidAlpha, midAlpha, t / 0.5)
      : lerp(midAlpha, clearAlpha, (t - 0.5) / 0.5);
  return roundAlpha(val);
}

export function applyUiTransparencyToDocument(transparency: number): void {
  if (typeof document === 'undefined') return;
  const clamped = clampUiTransparency(transparency);
  const t = clamped / 100;
  const root = document.documentElement;

  const cardLightAlpha = piecewiseAlpha(t, 0.95, 0.58, 0.14);
  const cardDarkAlpha = piecewiseAlpha(t, 0.9, 0.38, 0.08);

  const modalLightAlpha = piecewiseAlpha(t, 0.97, 0.74, 0.38);
  const modalDarkAlpha = piecewiseAlpha(t, 0.94, 0.64, 0.34);

  const topbarLightAlpha = piecewiseAlpha(t, 0.88, 0.24, 0.06);
  const topbarDarkAlpha = piecewiseAlpha(t, 0.84, 0.18, 0.05);

  const dockLightAlpha = piecewiseAlpha(t, 0.96, 0.78, 0.28);
  const dockDarkAlpha = piecewiseAlpha(t, 0.94, 0.74, 0.26);

  root.style.setProperty(
    '--qikki-glass-card-light',
    `rgba(255, 255, 255, ${cardLightAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-card-dark',
    `rgba(15, 23, 42, ${cardDarkAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-modal-light',
    `rgba(255, 255, 255, ${modalLightAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-modal-dark',
    `rgba(15, 23, 42, ${modalDarkAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-topbar-light',
    `rgba(255, 255, 255, ${topbarLightAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-topbar-dark',
    `rgba(2, 6, 23, ${topbarDarkAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-dock-light',
    `rgba(255, 255, 255, ${dockLightAlpha})`
  );
  root.style.setProperty(
    '--qikki-glass-dock-dark',
    `rgba(15, 23, 42, ${dockDarkAlpha})`
  );
}
