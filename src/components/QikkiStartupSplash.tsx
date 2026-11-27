import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface QikkiStartupSplashProps {
  isVisible: boolean;
}

export const QikkiStartupSplash: React.FC<QikkiStartupSplashProps> = ({ isVisible }) => {
  return (
    <AnimatePresence initial={true}>
      {isVisible && (
        <motion.div
          key="qikki-startup-splash"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.025 }}
          transition={{
            opacity: { duration: 1.35, ease: [0.16, 1, 0.3, 1] },
            y: { duration: 1.45, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
          }}
          style={{ willChange: 'opacity, transform' }}
          className="pointer-events-none fixed inset-0 z-[100] flex select-none items-center justify-center overflow-hidden bg-transparent"
        >
          {/* Floating translucent liquid-glass Qikki wordmark (no card or backdrop) */}
          <div className="qikki-splash-liquid-float relative">
            <span className="qikki-logo-font qikki-splash-liquid-base relative block text-6xl leading-none tracking-[0.12em] select-none sm:text-7xl md:text-8xl">
              Qikki
              {/* Prismatic liquid-glass refraction sweep */}
              <span
                aria-hidden="true"
                className="qikki-splash-liquid-refract pointer-events-none absolute inset-0"
              >
                Qikki
              </span>
              {/* Crisp specular liquid-glass highlight sheen */}
              <span
                aria-hidden="true"
                className="qikki-splash-liquid-specular pointer-events-none absolute inset-0"
              >
                Qikki
              </span>
              {/* Soft diffused liquid-glass glow around letterforms */}
              <span
                aria-hidden="true"
                className="qikki-splash-trace-halo pointer-events-none absolute inset-0"
              >
                Qikki
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
