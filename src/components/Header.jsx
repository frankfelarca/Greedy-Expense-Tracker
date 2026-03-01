// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { useTheme } from "../hooks/useTheme";

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header style={{ textAlign: "center", padding: "44px 20px 32px", position: "relative" }}>
      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          position: 'absolute', top: 20, right: 0,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', transition: 'all 0.2s',
        }}
      >
        {theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}
      </button>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: "clamp(2rem, 5vw, 3.2rem)",
          fontWeight: 900,
          background:
            "linear-gradient(135deg, #667eea, #764ba2, #f093fb, #48dbfb, #667eea)",
          backgroundSize: "300% 300%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "gradientShift 5s ease infinite",
          letterSpacing: -1.5,
          lineHeight: 1.1,
          marginBottom: 10,
        }}
      >
        GreedySplit
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ color: "var(--text2)", fontSize: "1.05rem", fontWeight: 300 }}
      >
        you're cooked if you're still using notes app
      </motion.p>
    </header>
  );
}
