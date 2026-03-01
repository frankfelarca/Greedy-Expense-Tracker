import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { deleteExpense, restoreExpense, updateExpense, markExpensePaid, unmarkExpensePaid } from '../store/tripSlice';
import { toast } from '../store/toastSlice';
import { CAT_LABELS, PAYMENT_LABELS, CAT_OPTIONS, PAYMENT_OPTIONS, CAT_ICONS, PAYMENT_ICONS } from '../utils/constants';
import { formatNum } from '../utils/helpers';
import { getReceiptUrl, uploadReceipt } from '../utils/sync';
import { useAdmin } from '../hooks/useAdmin';
import { Card, Btn, Badge, FormGroup, Spinner } from './UI';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';

const catStyles = {
  hotel: { background: 'rgba(255,107,107,0.2)', color: 'var(--accent1)' },
  meals: { background: 'rgba(254,202,87,0.2)', color: 'var(--accent2)' },
  alcohol: { background: 'rgba(95,39,205,0.2)', color: '#a78bfa' },
  fuel: { background: 'rgba(72,219,251,0.2)', color: 'var(--accent3)' },
  toll: { background: 'rgba(255,159,243,0.2)', color: 'var(--accent4)' },
  entrance: { background: 'rgba(84,160,255,0.2)', color: 'var(--accent5)' },
  others: { background: 'rgba(67,233,123,0.2)', color: 'var(--green)' },
};

const CAR_CATS = ['parking', 'toll', 'fuel'];

function EditModal({ exp, onClose }) {
  const dispatch = useDispatch();
  const travelers = useSelector(s => s.trip.travelers);
  const numberOfCars = useSelector(s => s.trip.numberOfCars) || 0;
  const syncConfig = useSelector(s => s.sync);
  const fileRef = useRef();
  const [form, setForm] = useState({ ...exp, amount: exp.amount.toString() });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const isCarPooled = numberOfCars > 0 && CAR_CATS.includes(form.category);

  const set = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'category' && numberOfCars > 0 && CAR_CATS.includes(value)) {
        next.splitAmong = travelers.map(t => t.name);
      }
      return next;
    });
  };

  const toggleSplit = (name) => {
    setForm(prev => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(name)
        ? prev.splitAmong.filter(n => n !== name)
        : [...prev.splitAmong, name],
    }));
  };

  const handleSubmit = () => {
    if (submitting) return;
    const { date, category, description, amount, paidBy, payment, refCode, splitAmong } = form;
    const parsed = parseFloat(amount);

    const errs = {};
    if (!date) errs.date = true;
    if (!category) errs.category = true;
    if (!description) errs.description = true;
    if (!parsed || parsed <= 0) errs.amount = 'Must be greater than 0';
    else if (parsed > 100000) errs.amount = 'Max \u20B1100,000';
    if (!paidBy) errs.paidBy = true;
    if (splitAmong.length < 1) errs.splitAmong = 'Select at least 1';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    const file = fileRef.current?.files?.[0];

    const finish = (receiptPath) => {
      const expense = { date, category, description, amount: parsed, paidBy, payment, refCode, receiptPath, splitAmong, loggedBy: exp.loggedBy, loggedAt: exp.loggedAt };
      dispatch(updateExpense({ id: exp.id, expense }));
      dispatch(toast('Expense updated!'));
      onClose();
    };

    if (file) {
      setUploadProgress(0);
      uploadReceipt(syncConfig, exp.id, file, (pct) => setUploadProgress(pct))
        .then(path => { setUploadProgress(null); finish(path); })
        .catch(() => {
          setUploadProgress(null);
          dispatch(toast('Receipt upload failed.', 'error'));
          finish(exp.receiptPath || null);
        });
    } else {
      finish(removeReceipt ? null : (exp.receiptPath || null));
    }
  };

  const perPerson = form.amount && form.splitAmong.length > 0
    ? parseFloat(form.amount) / form.splitAmong.length : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 12,
          width: '100%', maxWidth: 600, maxHeight: '90vh',
          overflow: 'auto', padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Edit Expense</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        <div className="expense-form-body">
          <FormGroup label="Description" required error={errors.description}>
            <input value={form.description} onChange={e => { set('description', e.target.value); setErrors(p => ({ ...p, description: undefined })); }} />
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <FormGroup label="Amount (&#8369;)" required error={errors.amount}>
              <input type="number" value={form.amount} onChange={e => { const v = e.target.value; if (v === '' || (parseFloat(v) <= 100000 && v.length <= 10)) { set('amount', v); setErrors(p => ({ ...p, amount: undefined })); } }} min="0" max="100000" step="0.01" inputMode="decimal" />
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
              <input value={form.refCode || ''} onChange={e => set('refCode', e.target.value)} />
            </FormGroup>
          </div>

          <div style={{ marginTop: 10 }}>
            <FormGroup label="Receipt">
              {exp.receiptPath && !removeReceipt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 600 }}>&#128206; Receipt attached</span>
                  <button
                    type="button"
                    onClick={() => setRemoveReceipt(true)}
                    style={{
                      background: 'none', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 6,
                      padding: '3px 10px', fontSize: '0.7rem', fontWeight: 600,
                      color: 'var(--accent1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {'\u{1F5D1}'} Remove
                  </button>
                </div>
              )}
              {removeReceipt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent1)', fontWeight: 600 }}>Receipt will be removed</span>
                  <button
                    type="button"
                    onClick={() => setRemoveReceipt(false)}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '3px 10px', fontSize: '0.7rem', fontWeight: 600,
                      color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
              <input type="file" ref={fileRef} accept="image/*,.pdf" />
              {uploadProgress !== null && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', borderRadius: 3, background: 'var(--gradient4)', transition: 'width 0.2s' }} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginTop: 3 }}>Uploading... {uploadProgress}%</div>
                </div>
              )}
            </FormGroup>
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
              {!isCarPooled && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setForm(prev => ({ ...prev, splitAmong: travelers.map(t => t.name) }))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent3)', fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>All</button>
                  <button onClick={() => setForm(prev => ({ ...prev, splitAmong: [] }))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>None</button>
                </div>
              )}
            </div>
            {isCarPooled && (
              <div style={{
                marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(72,219,251,0.06)', border: '1px solid rgba(72,219,251,0.15)',
                fontSize: '0.72rem', color: 'var(--text2)',
              }}>
                {'\u{1F697}'} Car pooling is active &mdash; this expense is automatically split among all travelers.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {travelers.map(t => {
                const sel = form.splitAmong.includes(t.name);
                return (
                  <label key={t.name} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: sel ? 'rgba(84,160,255,0.12)' : 'var(--surface3)',
                    border: `1.5px solid ${sel ? 'var(--accent5)' : 'transparent'}`,
                    borderRadius: 20, padding: '6px 12px', cursor: isCarPooled ? 'default' : 'pointer', fontSize: '0.8rem',
                    transition: 'all 0.15s',
                    boxShadow: sel ? '0 0 12px rgba(84,160,255,0.15)' : 'none',
                    ...(isCarPooled ? { opacity: 0.6 } : {}),
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: sel ? t.color : 'var(--surface4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', color: sel ? '#fff' : 'var(--text3)',
                      fontWeight: 700, transition: 'all 0.15s',
                      border: sel ? 'none' : '1.5px solid var(--border)',
                    }}>
                      {sel ? '\u2713' : ''}
                    </span>
                    <input type="checkbox" checked={sel} disabled={isCarPooled} onChange={() => { if (!isCarPooled) { toggleSplit(t.name); setErrors(p => ({ ...p, splitAmong: undefined })); } }} style={{ display: 'none' }} />
                    <span style={{ fontWeight: sel ? 600 : 400, color: sel ? 'var(--text)' : 'var(--text2)' }}>{t.name}</span>
                  </label>
                );
              })}
            </div>
            {errors.splitAmong && <div style={{ fontSize: '0.72rem', color: 'var(--accent1)', marginTop: 8 }}>{errors.splitAmong}</div>}
          </div>

          {form.amount && parseFloat(form.amount) > 0 && form.splitAmong.length > 0 && (
            <div style={{
              marginTop: 14, padding: '10px 16px', borderRadius: 10,
              background: 'rgba(67,233,123,0.08)', border: '1px solid rgba(67,233,123,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '0.82rem',
            }}>
              <span style={{ color: 'var(--text2)' }}>&#8369;{formatNum(parseFloat(form.amount))} &#247; {form.splitAmong.length} {form.splitAmong.length === 1 ? 'person' : 'people'}</span>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>&#8369;{formatNum(perPerson)} each</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <Btn variant="success" onClick={handleSubmit} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
              {submitting ? <><Spinner size={16} color="#1a1a2e" /> Saving...</> : '\u2713 Update'}
            </Btn>
            <Btn small variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpenseTable({ currentUser }) {
  const dispatch = useDispatch();
  const expenses = useSelector(s => s.trip.expenses);
  const paidExpenses = useSelector(s => s.trip.paidExpenses) || {};
  const travelers = useSelector(s => s.trip.travelers);
  const tripName = useSelector(s => s.trip.tripName);
  const [filterCat, setFilterCat] = useState('');
  const [filterPayer, setFilterPayer] = useState('');
  const [filterSplit, setFilterSplit] = useState('');
  const [filterLogger, setFilterLogger] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const syncConfig = useSelector(s => s.sync);
  const expenseLockDate = useSelector(s => s.trip.expenseLockDate);
  const { isAdmin } = useAdmin();
  const isExpenseLocked = expenseLockDate && new Date(expenseLockDate) <= new Date() && !isAdmin;
  const [receiptModal, setReceiptModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const deletedRef = useRef({});

  const handleUndo = useCallback((e) => {
    const { undoId } = e.detail;
    if (deletedRef.current[undoId]) {
      dispatch(restoreExpense(deletedRef.current[undoId]));
      delete deletedRef.current[undoId];
      dispatch(toast('Expense restored.'));
    }
  }, [dispatch]);

  useEffect(() => {
    window.addEventListener('undo-delete', handleUndo);
    return () => window.removeEventListener('undo-delete', handleUndo);
  }, [handleUndo]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (filterCat) result = result.filter(e => e.category === filterCat);
    if (filterPayer) result = result.filter(e => e.paidBy === filterPayer);
    if (filterSplit) result = result.filter(e => e.splitAmong.includes(filterSplit));
    if (filterLogger) result = result.filter(e => e.loggedBy === filterLogger);
    if (filterDateFrom) result = result.filter(e => e.date >= filterDateFrom);
    if (filterDateTo) result = result.filter(e => e.date <= filterDateTo);
    result = [...result].sort((a, b) => {
      const va = a.loggedAt || '';
      const vb = b.loggedAt || '';
      return vb < va ? -1 : vb > va ? 1 : 0;
    });
    return result;
  }, [expenses, filterCat, filterPayer, filterSplit, filterLogger, filterDateFrom, filterDateTo]);


  const canModify = (exp) => !isExpenseLocked && (isAdmin || (currentUser && exp.loggedBy === currentUser));

  const handleEdit = (exp) => {
    if (isExpenseLocked) { dispatch(toast('Expenses are locked for settlement.', 'error')); return; }
    if (!canModify(exp)) { dispatch(toast('Only the person who logged this can edit it.', 'error')); return; }
    setEditModal(exp);
  };

  const handleDelete = (exp) => {
    if (isExpenseLocked) { dispatch(toast('Expenses are locked for settlement.', 'error')); return; }
    if (!canModify(exp)) { dispatch(toast('Only the person who logged this can delete it.', 'error')); return; }
    if (!confirm('Delete this expense?')) return;
    const undoId = crypto.randomUUID();
    deletedRef.current[undoId] = exp;
    dispatch(deleteExpense(exp.id));
    dispatch(toast('Expense deleted.', 'success', undoId));
  };

  const viewReceipt = (exp) => {
    if (!exp?.receiptPath) return;
    const url = getReceiptUrl(syncConfig, exp.receiptPath);
    if (!url) return;
    setReceiptModal({ url, exp });
  };

  const csvSafe = (val) => {
    const str = String(val ?? '');
    if (/^[=+\-@|%]/.test(str)) return `'${str}`;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const exportCSV = () => {
    if (filtered.length === 0) { dispatch(toast('No expenses to export.', 'error')); return; }
    const headers = ['Date','Category','Description','Amount (PHP)','Split Amount (PHP)','Paid By','Payment Method','Reference Code','Receipt','Shared Among','Logged By','Logged At','Settled Outside App'];
    const rows = filtered.map(e => [
      e.date, CAT_LABELS[e.category], e.description, e.amount.toFixed(2), (e.amount / e.splitAmong.length).toFixed(2),
      e.paidBy, PAYMENT_LABELS[e.payment], e.refCode || '', e.receiptPath ? 'Yes' : 'No',
      e.splitAmong.join(', '), e.loggedBy || '', e.loggedAt || '',
      paidExpenses[e.id] ? 'Yes' : 'No',
    ].map(csvSafe));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (tripName || 'travel-expenses') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    dispatch(toast('CSV exported!'));
  };

  const hasFilters = !!(filterCat || filterPayer || filterSplit || filterLogger || filterDateFrom || filterDateTo);
  const activeFilterCount = [filterCat, filterPayer, filterSplit, filterLogger, filterDateFrom, filterDateTo].filter(Boolean).length;
  const clearFilters = () => { setFilterCat(''); setFilterPayer(''); setFilterSplit(''); setFilterLogger(''); setFilterDateFrom(''); setFilterDateTo(''); };
  return (
    <Card>
      <div className="no-print expense-toolbar" style={{
        marginBottom: 16, borderRadius: 12,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div
          className="expense-toolbar-header"
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 1, color: 'var(--text2)',
            }}>
              {'\u{1F50D}'} Filters
            </span>
            {hasFilters && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                background: 'rgba(84,160,255,0.15)', color: 'var(--accent5)',
              }}>{activeFilterCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="toolbar-actions-top" style={{ display: 'none', gap: 6 }}>
              <button onClick={(e) => { e.stopPropagation(); exportCSV(); }} className="toolbar-btn" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s' }}>
                {'\u{1F4E5}'} CSV
              </button>
              <button onClick={(e) => { e.stopPropagation(); window.print(); }} className="toolbar-btn" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent5)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s' }}>
                {'\u{1F5A8}'} Print
              </button>
            </div>
            <motion.span
              className="toolbar-chevron"
              animate={{ rotate: filtersOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: '0.6rem', color: 'var(--text2)' }}
            >
              &#9660;
            </motion.span>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="expense-toolbar-body" style={{ padding: '0 16px 14px' }}>
                <div className="filter-fields">
                  <div className="filter-field">
                    <label className="filter-label">Category</label>
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                      <option value="">All categories</option>
                      {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{CAT_ICONS[k]} {v}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="filter-label">Paid By</label>
                    <select value={filterPayer} onChange={e => setFilterPayer(e.target.value)}>
                      <option value="">All travelers</option>
                      {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="filter-label">Split With</label>
                    <select value={filterSplit} onChange={e => setFilterSplit(e.target.value)}>
                      <option value="">All travelers</option>
                      {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="filter-label">Logged By</label>
                    <select value={filterLogger} onChange={e => setFilterLogger(e.target.value)}>
                      <option value="">All travelers</option>
                      {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="filter-label">From</label>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} aria-label="From date" />
                  </div>
                  <div className="filter-field">
                    <label className="filter-label">To</label>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} aria-label="To date" />
                  </div>
                  <div className="filter-field filter-field-actions">
                    {hasFilters && (
                      <button onClick={clearFilters} className="toolbar-btn" style={{ background: 'none', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                        &#10005; Clear
                      </button>
                    )}
                  </div>
                </div>

                {hasFilters && (
                  <div className="active-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {filterCat && (
                      <span className="filter-pill" onClick={() => setFilterCat('')}>
                        {CAT_ICONS[filterCat]} {CAT_LABELS[filterCat]} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                    {filterPayer && (
                      <span className="filter-pill" onClick={() => setFilterPayer('')}>
                        Paid by: {filterPayer} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                    {filterSplit && (
                      <span className="filter-pill" onClick={() => setFilterSplit('')}>
                        Split with: {filterSplit} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                    {filterLogger && (
                      <span className="filter-pill" onClick={() => setFilterLogger('')}>
                        Logged by: {filterLogger} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                    {filterDateFrom && (
                      <span className="filter-pill" onClick={() => setFilterDateFrom('')}>
                        From: {filterDateFrom} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                    {filterDateTo && (
                      <span className="filter-pill" onClick={() => setFilterDateTo('')}>
                        To: {filterDateTo} <span className="pill-x">&#10005;</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="toolbar-actions-bottom" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} className="toolbar-btn" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
                      {'\u{1F4E5}'} Export CSV
                    </button>
                    <button onClick={() => window.print()} className="toolbar-btn" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent5)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
                      {'\u{1F5A8}'} Print
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Paid By</th>
              <th>Receipt</th>
              <th>Split</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, pageSize).map((exp, fi) => {
              return (
                <tr key={exp.id || fi} style={{ background: paidExpenses[exp.id] ? 'rgba(67,233,123,0.04)' : undefined, ...(paidExpenses[exp.id] ? { borderLeft: '3px solid var(--green)' } : {}) }}>
                  {/* Date — desktop: 3 rows (expense date without year, log date, logger) */}
                  <td data-label="Date">
                    <div>
                      <span className="desktop-hide">{exp.date}</span>
                      <span className="desktop-only">{(() => { if (!exp.date) return exp.date; const dt = new Date(exp.date + 'T00:00'); return dt.toLocaleString('en-PH', { month: 'short', day: 'numeric' }); })()}</span>
                    </div>
                    <div className="desktop-sub">
                      {exp.loggedBy && <span>{exp.loggedBy}</span>}
                    </div>
                    <div className="desktop-sub">
                      {exp.loggedAt && <span>{new Date(exp.loggedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </td>
                  <td data-label="Category"><Badge style={catStyles[exp.category]}>{CAT_ICONS[exp.category]} {CAT_LABELS[exp.category]}</Badge></td>
                  <td data-label="Description" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <span style={paidExpenses[exp.id] ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>{exp.description}</span>
                    {paidExpenses[exp.id] && <span style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 700, color: '#fff', background: 'var(--green)', padding: '2px 8px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Settled</span>}
                  </td>
                  {/* Amount — desktop: merged with per-person sub line */}
                  <td data-label="Amount" style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem', ...(paidExpenses[exp.id] ? { textDecoration: 'line-through', opacity: 0.55 } : {}) }}>
                    <div>&#8369;{formatNum(exp.amount)}</div>
                    {exp.splitAmong.length > 1 && (
                      <div className="desktop-sub" style={{ fontWeight: 600, color: 'var(--green)', textAlign: 'right', textDecoration: 'none' }}>&#8369;{formatNum(exp.amount / exp.splitAmong.length)}/ea</div>
                    )}
                  </td>
                  {/* Paid By — desktop: merged with method + ref sub lines */}
                  <td data-label="Paid By">
                    <div style={{ fontWeight: 500 }}>{exp.paidBy}</div>
                    <div className="desktop-sub">
                      <span>{PAYMENT_ICONS[exp.payment]} {PAYMENT_LABELS[exp.payment] || exp.payment}</span>
                      {exp.refCode && <span> &middot; {exp.refCode}</span>}
                    </div>
                  </td>
                  {/* Mobile-only cells: Method, Ref, Per Person, Logged By */}
                  <td className="desktop-hide" data-label="Method"><span>{PAYMENT_ICONS[exp.payment]} {PAYMENT_LABELS[exp.payment] || exp.payment}</span></td>
                  <td className="desktop-hide" data-label="Ref">{exp.refCode || '-'}</td>
                  <td className="desktop-hide" data-label="Per Person">
                    {exp.splitAmong.length > 1 && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)' }}>&#8369;{formatNum(exp.amount / exp.splitAmong.length)}</span>
                    )}
                    {exp.splitAmong.length <= 1 && <span style={{ color: 'var(--text2)', fontSize: '0.78rem' }}>&mdash;</span>}
                  </td>
                  <td className="desktop-hide" data-label="Logged By">
                    <div style={{ fontSize: '0.78rem' }}>{exp.loggedBy || '-'}</div>
                    {exp.loggedAt && <div style={{ fontSize: '0.65rem', color: 'var(--text2)', marginTop: 2 }}>{new Date(exp.loggedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                  </td>
                  {/* Receipt */}
                  <td data-label="Receipt">
                    {exp.receiptPath ? (
                      <button
                        onClick={() => viewReceipt(exp)}
                        title="View receipt"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(67,233,123,0.12)', color: 'var(--green)',
                          border: '1px solid rgba(67,233,123,0.3)', borderRadius: 6,
                          padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem',
                          fontWeight: 600, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(67,233,123,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(67,233,123,0.12)'; }}
                      >
                        &#128206;
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>&mdash;</span>
                    )}
                  </td>
                  <td data-label="Split">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                        {exp.splitAmong.map(n => {
                          const traveler = travelers.find(t => t.name === n);
                          return (
                            <span key={n} style={{
                              fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12,
                              background: traveler ? `${traveler.color}20` : 'var(--surface3)',
                              color: traveler ? traveler.color : 'var(--text2)',
                              fontWeight: 500,
                              border: `1px solid ${traveler ? `${traveler.color}30` : 'var(--border)'}`,
                            }}>{n}</span>
                          );
                        })}
                      </div>
                      {(canModify(exp) || (!isExpenseLocked && (isAdmin || (currentUser && exp.loggedBy === currentUser)))) && (
                        <div className="inline-actions" style={{ display: 'none', gap: 4, flexShrink: 0 }}>
                          {!isExpenseLocked && (isAdmin || (currentUser && exp.loggedBy === currentUser)) && (
                            <button
                              onClick={() => {
                                if (paidExpenses[exp.id]) {
                                  dispatch(unmarkExpensePaid(exp.id));
                                  dispatch(toast('Expense unmarked as paid.'));
                                } else {
                                  dispatch(markExpensePaid({ expenseId: exp.id, confirmedBy: currentUser, date: new Date().toISOString().slice(0, 10) }));
                                  dispatch(toast('Expense marked as paid!'));
                                }
                              }}
                              title={paidExpenses[exp.id] ? 'Unmark as paid' : 'Mark as paid'}
                              style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${paidExpenses[exp.id] ? 'rgba(67,233,123,0.3)' : 'rgba(67,233,123,0.2)'}`, background: paidExpenses[exp.id] ? 'rgba(67,233,123,0.1)' : 'rgba(67,233,123,0.05)', color: paidExpenses[exp.id] ? 'var(--green)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0 }}
                            >{paidExpenses[exp.id] ? '\u2714' : '\u20B1'}</button>
                          )}
                          {canModify(exp) && (
                            <>
                              <button onClick={() => handleEdit(exp)} title="Edit" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(84,160,255,0.25)', background: 'rgba(84,160,255,0.1)', color: 'var(--accent5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0 }}>&#9998;</button>
                              <button onClick={() => handleDelete(exp)} title="Delete" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.1)', color: 'var(--accent1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0 }}>&#128465;</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="no-print" data-label="Actions">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!isExpenseLocked && (isAdmin || (currentUser && exp.loggedBy === currentUser)) && (
                        <button
                          onClick={() => {
                            if (paidExpenses[exp.id]) {
                              dispatch(unmarkExpensePaid(exp.id));
                              dispatch(toast('Expense unmarked as paid.'));
                            } else {
                              dispatch(markExpensePaid({ expenseId: exp.id, confirmedBy: currentUser, date: new Date().toISOString().slice(0, 10) }));
                              dispatch(toast('Expense marked as paid!'));
                            }
                          }}
                          title={paidExpenses[exp.id] ? 'Unmark as paid' : 'Mark as paid'}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${paidExpenses[exp.id] ? 'rgba(67,233,123,0.3)' : 'rgba(67,233,123,0.2)'}`, background: paidExpenses[exp.id] ? 'rgba(67,233,123,0.1)' : 'rgba(67,233,123,0.05)', color: paidExpenses[exp.id] ? 'var(--green)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0, transition: 'all 0.15s' }}
                        >{paidExpenses[exp.id] ? '\u2714' : '\u20B1'}</button>
                      )}
                      {canModify(exp) && (
                        <>
                          <button onClick={() => handleEdit(exp)} title="Edit" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(84,160,255,0.25)', background: 'rgba(84,160,255,0.1)', color: 'var(--accent5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0, transition: 'all 0.15s' }}>&#9998;</button>
                          <button onClick={() => handleDelete(exp)} title="Delete" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.1)', color: 'var(--accent1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', padding: 0, transition: 'all 0.15s' }}>&#128465;</button>
                        </>
                      )}
                      {!canModify(exp) && (isExpenseLocked || (!isAdmin && !(currentUser && exp.loggedBy === currentUser))) && <span style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>&mdash;</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>No expenses yet. Add one above!</div>
        )}
      </div>
      {filtered.length > pageSize && (
        <div style={{ textAlign: 'center', padding: '12px 16px' }}>
          <button
            onClick={() => setPageSize(s => s + 25)}
            style={{
              background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 24px', fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--accent5)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            Load More ({Math.min(pageSize, filtered.length)} of {filtered.length})
          </button>
        </div>
      )}
      {filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 12, padding: '10px 16px', borderRadius: 10,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          fontSize: '0.82rem', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text2)' }}>{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
            {(() => { const paidCount = filtered.filter(e => paidExpenses[e.id]).length; const paidTotal = filtered.filter(e => paidExpenses[e.id]).reduce((s, e) => s + e.amount, 0); return paidCount > 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', background: 'rgba(67,233,123,0.1)', padding: '2px 10px', borderRadius: 10 }}>&#10003; {paidCount} paid &mdash; &#8369;{formatNum(paidTotal)}</span> : null; })()}
          </div>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Total: &#8369;{formatNum(filtered.reduce((s, e) => s + e.amount, 0))}</span>
          {filtered.some(e => paidExpenses[e.id]) && (
            <div style={{ width: '100%', fontSize: '0.68rem', color: 'var(--text2)', fontStyle: 'italic' }}>
              Total includes expenses already settled outside the app.
            </div>
          )}
        </div>
      )}
      {receiptModal && (
        <div
          onClick={() => setReceiptModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
              background: 'var(--surface)', borderRadius: 12,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{receiptModal.exp.description}</span>
              <button
                onClick={() => setReceiptModal(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text2)',
                  fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
                }}
              >
                &times;
              </button>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8,
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              fontSize: '0.78rem', color: 'var(--text2)',
            }}>
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Date:</span> {receiptModal.exp.date}</div>
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Category:</span> {CAT_LABELS[receiptModal.exp.category]}</div>
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Amount:</span> &#8369;{formatNum(receiptModal.exp.amount)}</div>
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Paid By:</span> {receiptModal.exp.paidBy}</div>
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Method:</span> {PAYMENT_LABELS[receiptModal.exp.payment] || receiptModal.exp.payment}</div>
              {receiptModal.exp.refCode && <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Ref:</span> {receiptModal.exp.refCode}</div>}
              <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Split:</span> {receiptModal.exp.splitAmong.join(', ')}</div>
              {receiptModal.exp.loggedBy && <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>Logged By:</span> {receiptModal.exp.loggedBy}</div>}
            </div>
            <div style={{ overflow: 'auto', padding: 16, display: 'flex', justifyContent: 'center' }}>
              {receiptModal.url.match(/\.pdf/i) ? (
                <iframe src={receiptModal.url} style={{ width: '80vw', height: '80vh', border: 'none' }} />
              ) : (
                <img src={receiptModal.url} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}
      {editModal && <EditModal exp={editModal} onClose={() => setEditModal(null)} currentUser={currentUser} />}
    </Card>
  );
}
