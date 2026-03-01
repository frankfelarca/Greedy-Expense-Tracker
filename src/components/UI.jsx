// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { dismissToast } from '../store/toastSlice';

const gradients = {
  primary: 'var(--gradient-primary)',
  success: 'var(--gradient-success)',
  danger: 'var(--gradient-danger)',
  ghost: 'var(--surface3)',
};

const textColors = {
  primary: 'white',
  success: '#fff',
  danger: 'white',
  ghost: 'var(--text2)',
};

export function Btn({ variant = 'primary', small, children, style, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
      whileTap={{ y: 0 }}
      style={{
        background: gradients[variant] || gradients.primary,
        color: textColors[variant] || 'white',
        border: 'none',
        borderRadius: small ? 8 : 10,
        padding: small ? '6px 12px' : '10px 20px',
        fontFamily: 'Inter, sans-serif',
        fontSize: small ? '0.78rem' : '0.88rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s',
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Card({ children, style, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--surface)',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        backdropFilter: 'blur(var(--glass-blur))',
        border: 'var(--glass-border)',
        borderRadius: 'var(--radius)',
        padding: 24,
        marginBottom: 20,
        boxShadow: 'var(--shadow)',
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ icon, gradient = 'var(--gradient-primary)', children, extra }) {
  return (
    <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon && (
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', background: gradient,
        }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
    </div>
  );
}

export function Badge({ className, children, style }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: '0.73rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        WebkitBackdropFilter: 'blur(8px)',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Modal({ open, onClose, children, borderColor = 'var(--accent5)', ariaLabel = 'Dialog' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            WebkitBackdropFilter: 'blur(8px)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            onKeyDown={(e) => { if (e.key === 'Escape' && onClose) onClose(); }}
            tabIndex={-1}
            style={{
              background: 'var(--surface2)',
              WebkitBackdropFilter: 'blur(24px)',
              backdropFilter: 'blur(24px)',
              border: `1px solid ${borderColor}`,
              borderRadius: 16,
              padding: 30,
              maxWidth: 520,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ size = 20, color = 'var(--accent5)', style }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: size, height: size,
        border: `2.5px solid var(--border)`,
        borderTopColor: color,
        borderRadius: '50%',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function StatCard({ label, value, color }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      style={{
        background: 'var(--surface2)',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        backdropFilter: 'blur(var(--glass-blur))',
        borderRadius: 12,
        padding: 18,
        textAlign: 'center',
        border: 'var(--glass-border)',
      }}
    >
      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
    </motion.div>
  );
}

export function FormGroup({ label, required, error, children }) {
  return (
    <div className={error ? 'form-group-error' : undefined} role="group" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: error ? 'var(--accent1)' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, transition: 'color 0.2s' }}>
        {label}{required && <span aria-hidden="true" style={{ color: 'var(--accent1)', marginLeft: 2 }}>*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {error && typeof error === 'string' && <span role="alert" style={{ fontSize: '0.72rem', color: 'var(--accent1)' }}>{error}</span>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="no-print tab-bar" role="tablist" aria-label="Main navigation" style={{
      display: 'flex',
      gap: 4,
      background: 'var(--surface)',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      backdropFilter: 'blur(var(--glass-blur))',
      border: 'var(--glass-border)',
      borderRadius: 14,
      padding: 4,
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        return (
          <motion.button
            key={tab.key}
            layout
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => {
              const keys = tabs.map(t => t.key);
              const idx = keys.indexOf(tab.key);
              let next = -1;
              if (e.key === 'ArrowRight') next = (idx + 1) % keys.length;
              else if (e.key === 'ArrowLeft') next = (idx - 1 + keys.length) % keys.length;
              else if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = keys.length - 1;
              if (next >= 0) {
                e.preventDefault();
                onChange(keys[next]);
                document.getElementById(`tab-${keys[next]}`)?.focus();
              }
            }}
            tabIndex={isActive ? 0 : -1}
            style={{
              position: 'relative',
              flex: 1,
              background: 'transparent',
              color: isActive ? 'white' : 'var(--text2)',
              border: 'none',
              padding: '12px 8px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              transition: 'color 0.2s',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--gradient-primary)',
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                  zIndex: -1,
                }}
              />
            )}
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Toasts() {
  const toasts = useSelector(s => s.toast.toasts);
  const dispatch = useDispatch();

  const bg = { success: 'var(--gradient-success)', error: 'var(--gradient-danger)', warning: 'linear-gradient(135deg, #fbbf24, #d97706)' };
  const fg = { success: '#fff', error: 'white', warning: '#1a1a2e' };

  return (
    <div aria-live="polite" aria-atomic="false" role="status" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            onClick={() => !t.undoId && dispatch(dismissToast(t.id))}
            style={{
              background: bg[t.type] || bg.success,
              WebkitBackdropFilter: 'blur(12px)',
              backdropFilter: 'blur(12px)',
              color: fg[t.type] || fg.success,
              padding: '14px 24px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: 'var(--shadow-lg)',
              cursor: t.undoId ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{t.message}</span>
            {t.undoId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const event = new CustomEvent('undo-delete', { detail: { undoId: t.undoId } });
                  window.dispatchEvent(event);
                  dispatch(dismissToast(t.id));
                }}
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
