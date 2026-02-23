import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { isConfigured } from '../utils/firebase';
import { startAutoPolling, stopAutoPolling } from '../utils/sync';
import { useOnline } from '../hooks/useOnline';
import { Card } from './UI';

const dotColors = {
  connected: '#43e97b',
  disconnected: '#ff6b6b',
  syncing: '#feca57',
  conflict: '#ff9ff3',
};

export default function SyncBar() {
  const dispatch = useDispatch();
  const sync = useSelector(s => s.sync);
  const online = useOnline();

  useEffect(() => {
    if (isConfigured) startAutoPolling(dispatch);
    return () => stopAutoPolling();
  }, [dispatch]);

  const effectiveStatus = !online ? 'disconnected' : sync.status;
  const effectiveText = !online ? 'Offline — changes saved locally' : sync.statusText;

  return (
    <Card className="no-print" style={{ padding: '10px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
        <motion.span
          animate={{ opacity: effectiveStatus === 'syncing' ? [1, 0.3, 1] : 1 }}
          transition={{ repeat: effectiveStatus === 'syncing' ? Infinity : 0, duration: 1 }}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: dotColors[effectiveStatus] || dotColors.disconnected,
            display: 'inline-block', flexShrink: 0,
          }}
        />
        <span style={{ color: !online ? 'var(--accent2)' : 'var(--text2)' }}>{effectiveText}</span>
        {isConfigured && online && (
          <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: '0.72rem', opacity: 0.6 }}>realtime sync</span>
        )}
        {!online && (
          <span style={{ marginLeft: 'auto', color: 'var(--accent2)', fontSize: '0.72rem', fontWeight: 600 }}>offline</span>
        )}
      </div>
    </Card>
  );
}
