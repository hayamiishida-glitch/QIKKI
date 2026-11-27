import React from 'react';
import type { ThemeMode } from '../hooks/useTheme';

interface AmbientDarkBackdropProps {
  theme?: ThemeMode;
}

export const AmbientDarkBackdrop: React.FC<AmbientDarkBackdropProps> = ({
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  if (isLight) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef4ff]"
      >
        {/* Sunlit morning pearl base pool */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 130% 95% at 20% 10%, rgba(224, 242, 254, 0.96) 0%, #eef4ff 76%)',
          }}
        />

        {/* Gradient Phase 1: Soft Sky Azure */}
        <div
          className="qikki-water-1 absolute -top-[22%] -left-[16%] h-[78vmax] w-[86vmax] rounded-[46%_54%_52%_48%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 45% 45%, rgba(56, 189, 248, 0.42) 0%, rgba(224, 242, 254, 0) 68%)',
          }}
        />

        {/* Gradient Phase 2: Fresh Seafoam Aqua */}
        <div
          className="qikki-water-2 absolute top-[4%] -right-[18%] h-[72vmax] w-[78vmax] rounded-[54%_46%_48%_52%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 52% 48%, rgba(45, 212, 191, 0.36) 0%, rgba(204, 251, 241, 0) 68%)',
          }}
        />

        {/* Gradient Phase 3: Periwinkle Mist */}
        <div
          className="qikki-water-3 absolute -bottom-[24%] left-[12%] h-[74vmax] w-[82vmax] rounded-[48%_52%_55%_45%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(129, 140, 248, 0.32) 0%, rgba(224, 231, 255, 0) 68%)',
          }}
        />

        {/* Gradient Phase 4: Sunlit Mint Cyan */}
        <div
          className="qikki-water-4 absolute bottom-[4%] right-[6%] h-[62vmax] w-[70vmax] rounded-[52%_48%_44%_56%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 48% 52%, rgba(34, 211, 238, 0.32) 0%, rgba(207, 250, 254, 0) 68%)',
          }}
        />

        {/* Gradient Phase 5: Soft Lilac Iris */}
        <div
          className="qikki-water-5 absolute top-[22%] left-[22%] h-[64vmax] w-[70vmax] rounded-[50%_50%_46%_54%] blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(192, 132, 252, 0.25) 0%, rgba(243, 232, 255, 0) 68%)',
          }}
        />

        {/* Flowing luminous aurora ribbons for liquid depth */}
        <div
          className="qikki-aurora-ribbon-1 absolute -inset-[18%] blur-2xl"
          style={{
            background:
              'linear-gradient(115deg, rgba(255, 255, 255, 0) 24%, rgba(56, 189, 248, 0.16) 44%, rgba(255, 255, 255, 0.55) 54%, rgba(45, 212, 191, 0.14) 64%, rgba(255, 255, 255, 0) 82%)',
          }}
        />
        <div
          className="qikki-aurora-ribbon-2 absolute -inset-[18%] blur-2xl"
          style={{
            background:
              'linear-gradient(62deg, rgba(255, 255, 255, 0) 26%, rgba(129, 140, 248, 0.14) 48%, rgba(255, 255, 255, 0.42) 58%, rgba(255, 255, 255, 0) 78%)',
          }}
        />

        {/* Gentle sunlit water caustic shimmer */}
        <div
          className="qikki-water-caustic absolute -inset-[12%] blur-2xl"
          style={{
            background:
              'linear-gradient(120deg, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.52) 45%, rgba(125, 211, 252, 0.28) 58%, rgba(255, 255, 255, 0) 80%)',
          }}
        />

        {/* Subtle drifting micro-bokeh shimmer */}
        <div
          className="qikki-ambient-shimmer absolute -inset-[8%]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 24%, rgba(255,255,255,0.65) 0, rgba(255,255,255,0) 18%), radial-gradient(circle at 78% 18%, rgba(186,230,253,0.45) 0, rgba(186,230,253,0) 22%), radial-gradient(circle at 64% 76%, rgba(199,210,254,0.4) 0, rgba(199,210,254,0) 20%), radial-gradient(circle at 26% 72%, rgba(165,243,252,0.4) 0, rgba(165,243,252,0) 18%)',
          }}
        />

        {/* Soft luminous veil so dark foreground text stays effortless to read */}
        <div className="absolute inset-0 bg-white/18" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#040711]"
    >
      {/* Deep abyssal base pool */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 130% 95% at 20% 10%, rgba(12, 24, 52, 0.94) 0%, #040711 76%)',
        }}
      />

      {/* Gradient Phase 1: Deep Lagoon Sapphire */}
      <div
        className="qikki-water-1 absolute -top-[22%] -left-[16%] h-[78vmax] w-[86vmax] rounded-[46%_54%_52%_48%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 45% 45%, rgba(29, 78, 216, 0.54) 0%, rgba(15, 23, 42, 0) 68%)',
        }}
      />

      {/* Gradient Phase 2: Deep Seafoam Teal */}
      <div
        className="qikki-water-2 absolute top-[4%] -right-[18%] h-[72vmax] w-[78vmax] rounded-[54%_46%_48%_52%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 52% 48%, rgba(13, 148, 136, 0.48) 0%, rgba(6, 24, 34, 0) 68%)',
        }}
      />

      {/* Gradient Phase 3: Midnight Indigo & Violet */}
      <div
        className="qikki-water-3 absolute -bottom-[24%] left-[12%] h-[74vmax] w-[82vmax] rounded-[48%_52%_55%_45%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(91, 33, 182, 0.46) 0%, rgba(14, 15, 36, 0) 68%)',
        }}
      />

      {/* Gradient Phase 4: Abyssal Cyan Emerald */}
      <div
        className="qikki-water-4 absolute bottom-[4%] right-[6%] h-[62vmax] w-[70vmax] rounded-[52%_48%_44%_56%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 48% 52%, rgba(8, 145, 178, 0.42) 0%, rgba(6, 18, 30, 0) 68%)',
        }}
      />

      {/* Gradient Phase 5: Twilight Plum */}
      <div
        className="qikki-water-5 absolute top-[22%] left-[22%] h-[64vmax] w-[70vmax] rounded-[50%_50%_46%_54%] blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(109, 40, 217, 0.34) 0%, rgba(12, 10, 28, 0) 68%)',
        }}
      />

      {/* Flowing aurora silk ribbons for dimensional motion */}
      <div
        className="qikki-aurora-ribbon-1 absolute -inset-[18%] blur-2xl"
        style={{
          background:
            'linear-gradient(115deg, rgba(15, 23, 42, 0) 24%, rgba(56, 189, 248, 0.14) 46%, rgba(45, 212, 191, 0.12) 56%, rgba(15, 23, 42, 0) 80%)',
        }}
      />
      <div
        className="qikki-aurora-ribbon-2 absolute -inset-[18%] blur-2xl"
        style={{
          background:
            'linear-gradient(62deg, rgba(15, 23, 42, 0) 28%, rgba(139, 92, 246, 0.14) 48%, rgba(59, 130, 246, 0.12) 58%, rgba(15, 23, 42, 0) 78%)',
        }}
      />

      {/* Gentle surface ripple sweep across liquid glass */}
      <div
        className="qikki-water-caustic absolute -inset-[12%] blur-2xl"
        style={{
          background:
            'linear-gradient(120deg, rgba(14, 116, 144, 0) 20%, rgba(56, 189, 248, 0.13) 45%, rgba(45, 212, 191, 0.11) 58%, rgba(15, 23, 42, 0) 80%)',
        }}
      />

      {/* Subtle drifting luminous depth bokeh */}
      <div
        className="qikki-ambient-shimmer absolute -inset-[8%]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 26%, rgba(56,189,248,0.12) 0, rgba(56,189,248,0) 20%), radial-gradient(circle at 76% 22%, rgba(139,92,246,0.12) 0, rgba(139,92,246,0) 22%), radial-gradient(circle at 62% 76%, rgba(45,212,191,0.1) 0, rgba(45,212,191,0) 20%), radial-gradient(circle at 24% 74%, rgba(59,130,246,0.11) 0, rgba(59,130,246,0) 18%)',
        }}
      />

      {/* Controlled dark veil so foreground text stays effortless to read */}
      <div className="absolute inset-0 bg-[#040711]/26" />
    </div>
  );
};
