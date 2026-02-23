import { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { addExpense } from '../store/tripSlice';
import { toast } from '../store/toastSlice';
import { CAT_OPTIONS, PAYMENT_OPTIONS, CAT_ICONS, PAYMENT_ICONS } from '../utils/constants';
import { todayStr, formatNum } from '../utils/helpers';
import { uploadReceipt } from '../utils/sync';
import { Card, Btn, FormGroup, Spinner } from './UI';

export default function ExpenseForm({ currentUser }) {
  const dispatch = useDispatch();
  const travelers = useSelector(s => s.trip.travelers);
  const syncConfig = useSelector(s => s.sync);
  const fileRef = useRef();
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const lastSubmitRef = useRef(0);
  const [errors, setErrors] = useState({});
  const [collapsed, setCollapsed] = useState(true);

  const makeBlank = useCallback(() => ({
    date: todayStr(), category: '', description: '', amount: '',
    paidBy: currentUser || '', payment: 'cash', refCode: '',
    splitAmong: currentUser ? [currentUser] : travelers.map(t => t.name),
    loggedBy: currentUser || '',
  }), [currentUser, travelers]);

  const [form, setForm] = useState(() => makeBlank());

  useEffect(() => {
    setForm(prev => {
      if (prev._loaded) return prev;
      const updated = {};
      if (!prev.paidBy && currentUser) updated.paidBy = currentUser;
      if (currentUser && !prev.splitAmong.includes(currentUser)) updated.splitAmong = [...new Set([currentUser, ...prev.splitAmong])];
      if (!prev.loggedBy && currentUser) updated.loggedBy = currentUser;
      return Object.keys(updated).length > 0 ? { ...prev, ...updated } : prev;
    });
  }, [currentUser]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleSplit = (name) => {
    setForm(prev => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(name)
        ? prev.splitAmong.filter(n => n !== name)
        : [...prev.splitAmong, name],
    }));
  };

  const handleSubmit = useCallback(() => {
    const now = Date.now();
    if (now - lastSubmitRef.current < 3000) {
      dispatch(toast('Please wait before adding another expense.', 'error'));
      return;
    }
    if (submitting) return;

    const { date, category, description, amount, paidBy, payment, refCode, splitAmong } = form;
    const parsed = parseFloat(amount);
    const loggedBy = currentUser || form.loggedBy;

    const errs = {};
    if (!date) errs.date = true;
    if (!category) errs.category = true;
    if (!description) errs.description = true;
    if (!parsed || parsed <= 0) errs.amount = 'Must be greater than 0';
    else if (parsed > 100000) errs.amount = 'Max amount is \u20B1100,000.00';
    if (!paidBy) errs.paidBy = true;
    if (!loggedBy) errs.loggedBy = true;
    if (splitAmong.length < 1) errs.splitAmong = 'Select at least 1 person';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      dispatch(toast('Please fill in all required fields.', 'error'));
      return;
    }

    if (currentUser && !splitAmong.includes(currentUser)) {
      if (!confirm(`You (${currentUser}) are not included in the split. The amount will be divided without you. Continue?`)) return;
    }

    setSubmitting(true);
    lastSubmitRef.current = now;

    const file = fileRef.current?.files?.[0];

    const finish = (receiptPath) => {
      const expense = { date, category, description, amount: parsed, paidBy, payment, refCode, receiptPath, splitAmong, loggedBy, loggedAt: new Date().toISOString() };
      dispatch(addExpense(expense));
      dispatch(toast('Expense added!'));
      setForm(makeBlank());
      if (fileRef.current) fileRef.current.value = '';
      setSubmitting(false);
      setErrors({});
    };

    if (file) {
      const expId = crypto.randomUUID();
      setUploadProgress(0);
      uploadReceipt(syncConfig, expId, file, (pct) => setUploadProgress(pct))
        .then(path => { setUploadProgress(null); finish(path); })
        .catch((err) => {
          console.error('Receipt upload error:', err);
          setUploadProgress(null);
          dispatch(toast('Receipt upload failed. Saving without receipt.', 'error'));
          finish(null);
        });
    } else {
      finish(null);
    }
  }, [form, submitting, currentUser, dispatch, syncConfig, makeBlank]);

  const perPerson = form.amount && form.splitAmong.length > 0
    ? parseFloat(form.amount) / form.splitAmong.length
    : 0;

  return (
    <Card className="no-print" id="expenseForm" style={{ overflow: 'hidden' }}>
      <motion.div
        onClick={() => setCollapsed(c => { if (c) setForm(prev => ({ ...prev, date: todayStr() })); return !c; })}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: -24,
          padding: '20px 24px',
          borderRadius: 'var(--radius)',
          transition: 'background 0.15s',
          marginBottom: collapsed ? -24 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', background: 'var(--gradient2)',
          }}>
            {'\u{1F4B3}'}
          </span>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add Expense</div>
            {collapsed && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: 2 }}>
                Tap to expand
              </div>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface2)', color: 'var(--text2)',
            fontSize: '0.7rem', flexShrink: 0,
          }}
        >
          &#9660;
        </motion.span>
      </motion.div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="expense-form-body" style={{ paddingTop: 20 }}>
              <FormGroup label="Description" required error={errors.description}>
                <input value={form.description} onChange={e => { set('description', e.target.value); setErrors(p => ({ ...p, description: undefined })); }} placeholder="e.g. Lunch at Flotsam" />
              </FormGroup>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <FormGroup label="Amount (&#8369;)" required error={errors.amount}>
                  <input type="number" value={form.amount} onChange={e => { const v = e.target.value; if (v === '' || (parseFloat(v) <= 100000 && v.length <= 10)) { set('amount', v); setErrors(p => ({ ...p, amount: undefined })); } }} placeholder="0.00" min="0" max="100000" step="0.01" inputMode="decimal" />
                </FormGroup>

                <FormGroup label="Category" required error={errors.category}>
                  <select value={form.category} onChange={e => { set('category', e.target.value); setErrors(p => ({ ...p, category: undefined })); }}>
                    <option value="">Select...</option>
                    {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{CAT_ICONS[o.value] || ''} {o.label}</option>)}
                  </select>
                </FormGroup>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <FormGroup label="Date" required error={errors.date}>
                  <input type="date" value={form.date} onChange={e => { set('date', e.target.value); setErrors(p => ({ ...p, date: undefined })); }} />
                </FormGroup>

                <FormGroup label="Paid By" required error={errors.paidBy}>
                  <select value={form.paidBy} onChange={e => { set('paidBy', e.target.value); setErrors(p => ({ ...p, paidBy: undefined })); }}>
                    <option value="">Select...</option>
                    {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </FormGroup>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <FormGroup label="Payment Method">
                  <select value={form.payment} onChange={e => set('payment', e.target.value)}>
                    {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{PAYMENT_ICONS[o.value] || ''} {o.label}</option>)}
                  </select>
                </FormGroup>

                <FormGroup label="Reference Code">
                  <input value={form.refCode} onChange={e => set('refCode', e.target.value)} placeholder="For online payments" />
                </FormGroup>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: !currentUser ? '1fr 1fr' : '1fr', gap: 10, marginTop: 10 }}>
                <FormGroup label="Receipt">
                  <input type="file" ref={fileRef} accept="image/*,.pdf" />
                  {uploadProgress !== null && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{
                        height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${uploadProgress}%`, height: '100%', borderRadius: 3,
                          background: 'var(--gradient4)', transition: 'width 0.2s',
                        }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginTop: 3 }}>
                        Uploading... {uploadProgress}%
                      </div>
                    </div>
                  )}
                </FormGroup>

                {!currentUser && (
                  <FormGroup label="Logged By" required error={errors.loggedBy}>
                    <select value={form.loggedBy} onChange={e => { set('loggedBy', e.target.value); setErrors(p => ({ ...p, loggedBy: undefined })); }}>
                      <option value="">Select...</option>
                      {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </FormGroup>
                )}
              </div>

              <div style={{
                marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 12,
                border: `1px solid ${errors.splitAmong ? 'var(--accent1)' : 'var(--border)'}`,
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{
                    fontSize: '0.78rem', color: errors.splitAmong ? 'var(--accent1)' : 'var(--text2)',
                    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, transition: 'color 0.2s',
                  }}>
                    Shared Among ({form.splitAmong.length}/{travelers.length})
                    <span style={{ color: 'var(--accent1)', marginLeft: 2 }}>*</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, splitAmong: travelers.map(t => t.name) }))}
                      style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                        color: 'var(--accent3)', fontSize: '0.7rem', fontWeight: 600,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      All
                    </button>
                    {currentUser && (
                      <button
                        onClick={() => setForm(prev => ({ ...prev, splitAmong: [currentUser] }))}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                          color: 'var(--accent5)', fontSize: '0.7rem', fontWeight: 600,
                          padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        Only Me
                      </button>
                    )}
                    <button
                      onClick={() => setForm(prev => ({ ...prev, splitAmong: [] }))}
                      style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                        color: 'var(--text2)', fontSize: '0.7rem', fontWeight: 600,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      None
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {travelers.map(t => {
                    const selected = form.splitAmong.includes(t.name);
                    return (
                      <motion.label
                        key={t.name}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: selected ? 'rgba(84,160,255,0.12)' : 'var(--surface3)',
                          border: `1.5px solid ${selected ? 'var(--accent5)' : 'transparent'}`,
                          borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem',
                          transition: 'all 0.15s',
                          boxShadow: selected ? '0 0 12px rgba(84,160,255,0.15)' : 'none',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: selected ? t.color : 'var(--surface4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', color: selected ? '#fff' : 'var(--text3)',
                          fontWeight: 700, transition: 'all 0.15s',
                          border: selected ? 'none' : '1.5px solid var(--border)',
                        }}>
                          {selected ? '\u2713' : ''}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => { toggleSplit(t.name); setErrors(p => ({ ...p, splitAmong: undefined })); }}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontWeight: selected ? 600 : 400, color: selected ? 'var(--text)' : 'var(--text2)' }}>
                          {t.name}
                        </span>
                      </motion.label>
                    );
                  })}
                </div>
                {errors.splitAmong && <div style={{ fontSize: '0.72rem', color: 'var(--accent1)', marginTop: 8 }}>{errors.splitAmong}</div>}
              </div>

              <AnimatePresence>
                {form.amount && parseFloat(form.amount) > 0 && form.splitAmong.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      marginTop: 14, padding: '10px 16px', borderRadius: 10,
                      background: 'rgba(67,233,123,0.08)', border: '1px solid rgba(67,233,123,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}>
                      <span style={{ color: 'var(--text2)' }}>
                        &#8369;{formatNum(parseFloat(form.amount))} &#247; {form.splitAmong.length} {form.splitAmong.length === 1 ? 'person' : 'people'}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                        &#8369;{formatNum(perPerson)} each
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ marginTop: 18 }}>
                <Btn variant="success" onClick={handleSubmit} disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
                  {submitting ? <><Spinner size={16} color="#1a1a2e" /> Saving...</> : '+ Add Expense'}
                </Btn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
