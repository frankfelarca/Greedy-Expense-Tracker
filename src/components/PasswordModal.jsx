import { useState, useRef, useEffect } from 'react';
import { Modal, Btn } from './UI';

export default function PasswordModal({ open, onSubmit, onClose }) {
  const [pw, setPw] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    if (open) {
      setPw('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSubmit(pw);
    setPw('');
  };

  return (
    <Modal open={open} onClose={onClose} borderColor="var(--accent5)">
      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', background: 'var(--gradient1)',
          }}>
            &#128274;
          </span>
          Admin Password
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Enter admin password"
          autoComplete="off"
          style={{ marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="success" type="submit">Unlock</Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}
