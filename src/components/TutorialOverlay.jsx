import { useState, useEffect, useCallback, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const SPOTLIGHT_PAD = 8;
const SPOTLIGHT_PAD_MOBILE = 4;
const POPOVER_GAP = 12;
const MOBILE_BREAKPOINT = 640;

function getTargetRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function calcPosition(targetRect, popoverRect) {
  if (!targetRect || !popoverRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceAbove = targetRect.top;
  const spaceBelow = vh - targetRect.bottom;
  const spaceLeft = targetRect.left;
  const spaceRight = vw - targetRect.right;

  let side;
  if (isMobile) {
    side = spaceBelow >= spaceAbove ? 'below' : 'above';
  } else {
    const spaces = [
      { side: 'below', space: spaceBelow },
      { side: 'above', space: spaceAbove },
      { side: 'right', space: spaceRight },
      { side: 'left', space: spaceLeft },
    ];
    spaces.sort((a, b) => b.space - a.space);
    side = spaces[0].side;
  }

  const style = { position: 'fixed' };
  const centerX = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
  const clampedX = Math.max(8, Math.min(centerX, vw - popoverRect.width - 8));

  if (side === 'below') {
    style.top = targetRect.bottom + POPOVER_GAP;
    style.left = clampedX;
  } else if (side === 'above') {
    style.top = targetRect.top - popoverRect.height - POPOVER_GAP;
    style.left = clampedX;
  } else if (side === 'right') {
    style.top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
    style.left = targetRect.right + POPOVER_GAP;
  } else {
    style.top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
    style.left = targetRect.left - popoverRect.width - POPOVER_GAP;
  }

  // Clamp vertically
  style.top = Math.max(8, Math.min(style.top, vh - popoverRect.height - 8));

  return style;
}

export default function TutorialOverlay({ selector, title, description, stepIndex, stepCount, onNext, onSkip }) {
  const [targetRect, setTargetRect] = useState(null);
  const [popoverStyle, setPopoverStyle] = useState({});
  const popoverRef = useRef(null);
  const isLast = stepIndex === stepCount - 1;

  const measure = useCallback(() => {
    const rect = getTargetRect(selector);
    setTargetRect(rect);

    if (rect && popoverRef.current) {
      const pr = popoverRef.current.getBoundingClientRect();
      setPopoverStyle(calcPosition(rect, pr));
    }
  }, [selector]);

  // Scroll target into view and measure
  useEffect(() => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Measure after scroll settles
      const t = setTimeout(measure, 350);
      return () => clearTimeout(t);
    }
  }, [selector, measure]);

  // ResizeObserver + scroll listener
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
  const pad = isMobile ? SPOTLIGHT_PAD_MOBILE : SPOTLIGHT_PAD;

  return (
    <AnimatePresence>
      <motion.div
        key="tutorial-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 110000,
          pointerEvents: 'auto',
        }}
        onClick={onSkip}
      >
        {/* Spotlight cutout */}
        {targetRect && (
          <div
            style={{
              position: 'fixed',
              top: targetRect.top - pad,
              left: targetRect.left - pad,
              width: targetRect.width + pad * 2,
              height: targetRect.height + pad * 2,
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
            }}
          />
        )}

        {/* If no target found, dim background */}
        {!targetRect && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
        )}

        {/* Popover */}
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          style={{
            ...popoverStyle,
            position: 'fixed',
            maxWidth: isMobile ? 'min(90vw, 320px)' : 340,
            background: 'var(--surface2)',
            WebkitBackdropFilter: 'blur(24px)',
            backdropFilter: 'blur(24px)',
            border: 'var(--glass-border)',
            borderRadius: 16,
            padding: '20px',
            zIndex: 110001,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
            {description}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600 }}>
              {stepIndex + 1} of {stepCount}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onSkip}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 36,
                }}
              >
                Skip
              </button>
              <button
                onClick={onNext}
                style={{
                  background: 'var(--gradient-primary)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 18px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 36,
                }}
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
