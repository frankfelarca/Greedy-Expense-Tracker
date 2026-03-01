// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { useTheme } from "../hooks/useTheme";

export default function Header({ onStartTutorial }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', position: 'relative',
    }}>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <h1 style={{
          fontSize: 'clamp(1.4rem, 3.5vw, 1.8rem)',
          fontWeight: 900,
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -0.5,
          lineHeight: 1.1,
          margin: 0,
        }}>
          GreedySplit
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '0.72rem', fontWeight: 400, marginTop: 2 }}>
          you're cooked if you're still using notes app
        </p>
      </motion.div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {onStartTutorial && (
          <button
            onClick={onStartTutorial}
            aria-label="Start tutorial"
            title="Start tutorial"
            style={{
              background: 'var(--surface2)',
              WebkitBackdropFilter: 'blur(12px)',
              backdropFilter: 'blur(12px)',
              border: 'var(--glass-border)',
              borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', transition: 'all 0.2s', flexShrink: 0,
              color: 'var(--text2)', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            ?
          </button>
        )}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            background: 'var(--surface2)',
            WebkitBackdropFilter: 'blur(12px)',
            backdropFilter: 'blur(12px)',
            border: 'var(--glass-border)',
            borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}
        </button>
      </div>
    </header>
  );
}
