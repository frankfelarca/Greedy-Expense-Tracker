import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { setTripField, addTraveler, removeTraveler, clearAll, setExpenseLockDate } from '../store/tripSlice';
import { toast } from '../store/toastSlice';
import { useAdmin } from '../hooks/useAdmin';
import { Card, CardTitle, Btn, FormGroup, Modal } from './UI';
import PasswordModal from './PasswordModal';
import { ref, remove } from 'firebase/database';
import { db } from '../utils/firebase';
import { CONTAINER } from '../utils/constants';
import { writeToken, deactivateToken, reactivateToken, fetchTokens, skipNextSync } from '../utils/sync';
import { hashName } from '../utils/helpers';
import { useCountdownTo } from '../hooks/useCountdownTo';

const DATA_PATH = import.meta.env.VITE_FIREBASE_DATA_PATH || 'trips/default';

export default function TripInfo() {
  const dispatch = useDispatch();
  const tripName = useSelector(s => s.trip.tripName);
  const tripDestination = useSelector(s => s.trip.tripDestination);
  const tripStart = useSelector(s => s.trip.tripStart);
  const tripEnd = useSelector(s => s.trip.tripEnd);
  const travelers = useSelector(s => s.trip.travelers);
  const maxTravelers = useSelector(s => s.trip.maxTravelers) || 10;
  const syncConfig = useSelector(s => s.sync);
  const numberOfCars = useSelector(s => s.trip.numberOfCars) || 0;
  const expenseLockDate = useSelector(s => s.trip.expenseLockDate);
  const { isAdmin, requireAdmin, countdown, tryUnlock, doLock, isLockedOut, lockoutCountdown, showPasswordModal, handlePasswordSubmit, handlePasswordClose } = useAdmin();
  const [newName, setNewName] = useState('');
  const travelerInputRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [clearing, setClearing] = useState(false);
  const [nukeCountdown, setNukeCountdown] = useState(null);
  const nukeTimerRef = useRef(null);
  const [lockDraft, setLockDraft] = useState('');
  const [firstTravelerModal, setFirstTravelerModal] = useState(null);
  const { countdown: lockCountdown } = useCountdownTo(expenseLockDate);

  const storeFields = { tripName, tripDestination, tripStart, tripEnd, maxTravelers, numberOfCars };
  const [draft, setDraft] = useState({ ...storeFields });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft({ tripName, tripDestination, tripStart, tripEnd, maxTravelers, numberOfCars });
  }, [tripName, tripDestination, tripStart, tripEnd, maxTravelers, numberOfCars, dirty]);

  useEffect(() => () => clearInterval(nukeTimerRef.current), []);

  const validate = (field, value) => {
    switch (field) {
      case 'tripName':
        if (!value.trim()) return 'Trip name is required';
        if (value.length > 100) return 'Max 100 characters';
        return null;
      case 'tripDestination':
        if (!value.trim()) return 'Destination is required';
        if (value.length > 100) return 'Max 100 characters';
        return null;
      case 'tripStart':
        if (!value) return 'Start date is required';
        return null;
      case 'tripEnd':
        if (!value) return 'End date is required';
        if (draft.tripStart && value < draft.tripStart) return 'Must be after start date';
        return null;
      case 'maxTravelers':
        if (!value || value < 1) return 'Min 1';
        if (value > 50) return 'Max 50';
        return null;
      case 'numberOfCars':
        if (value < 0) return 'Min 0';
        if (value > 20) return 'Max 20';
        return null;
      default:
        return null;
    }
  };

  const handleDraftChange = (field, value, type) => {
    const parsed = type === 'number' ? (Number(value) || 0) : value;
    const error = validate(field, parsed);
    setErrors(prev => ({ ...prev, [field]: error }));
    setDraft(prev => ({ ...prev, [field]: parsed }));
    setDirty(true);
  };

  const handleSave = () => {
    const errs = {};
    for (const [field, value] of Object.entries(draft)) {
      const err = validate(field, value);
      if (err) errs[field] = err;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      dispatch(toast('Please fix validation errors.', 'error'));
      return;
    }
    for (const [field, value] of Object.entries(draft)) {
      if (value !== storeFields[field]) {
        dispatch(setTripField({ field, value }));
      }
    }
    setDirty(false);
    dispatch(toast('Trip info saved!'));
  };

  const handleCancel = () => {
    setDraft({ ...storeFields });
    setErrors({});
    setDirty(false);
  };

  const [travelerHashes, setTravelerHashes] = useState({});
  const [copiedHash, setCopiedHash] = useState(null);

  useEffect(() => {
    if (!isAdmin || travelers.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = {};
      for (const t of travelers) {
        map[t.name] = await hashName(t.name);
      }
      if (!cancelled) setTravelerHashes(map);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, travelers]);

  const copyInviteLink = useCallback((name) => {
    const hash = travelerHashes[name];
    if (!hash) return;
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?u=${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedHash(name);
      dispatch(toast(`Invite link for ${name} copied!`));
      setTimeout(() => setCopiedHash(null), 2000);
    }).catch(() => {});
  }, [travelerHashes, dispatch]);

  const handleAddTraveler = () => {
    requireAdmin(async () => {
      const name = newName.trim();
      if (!name) return;
      if (travelers.length >= maxTravelers) { dispatch(toast(`Max ${maxTravelers} travelers!`, 'error')); return; }
      if (travelers.some(t => t.name.toLowerCase() === name.toLowerCase())) { dispatch(toast('Name already exists!', 'error')); return; }
      const isFirst = travelers.length === 0;
      dispatch(addTraveler(name));
      setNewName('');
      requestAnimationFrame(() => travelerInputRef.current?.focus());
      try {
        const hash = await hashName(name);
        const tokens = await fetchTokens();
        skipNextSync();
        if (tokens[hash]) {
          await reactivateToken(hash);
        } else {
          await writeToken(hash, name);
        }
        if (isFirst) {
          const base = window.location.origin + window.location.pathname;
          setFirstTravelerModal({ name, link: `${base}?u=${hash}` });
        }
      } catch (e) {
        console.error('Token write error:', e);
      }
    });
  };

  const handleRemove = (index) => {
    requireAdmin(async () => {
      const name = travelers[index].name;
      dispatch(removeTraveler(index));
      try {
        const hash = await hashName(name);
        skipNextSync();
        await deactivateToken(hash);
      } catch (e) {
        console.error('Token deactivate error:', e);
      }
    });
  };

  const executeNuke = async () => {
    setClearing(true);
    try {
      await remove(ref(db, DATA_PATH));

      if (syncConfig.account && syncConfig.sasToken) {
        const listUrl = `https://${syncConfig.account}.blob.core.windows.net/${CONTAINER}?restype=container&comp=list${syncConfig.sasToken.startsWith('?') ? '&' + syncConfig.sasToken.slice(1) : syncConfig.sasToken}`;
        try {
          const listResp = await fetch(listUrl);
          if (listResp.ok) {
            const text = await listResp.text();
            const blobNames = [...text.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m => m[1]);
            for (const name of blobNames) {
              const deleteUrl = `https://${syncConfig.account}.blob.core.windows.net/${CONTAINER}/${name}${syncConfig.sasToken}`;
              await fetch(deleteUrl, { method: 'DELETE' }).catch(() => {});
            }
          }
        } catch (e) {
          console.error('Storage cleanup error:', e);
        }
      }

      dispatch(clearAll());
      dispatch(toast('All data has been nuked.'));
    } catch (e) {
      console.error('Nuke error:', e);
      dispatch(toast('Nuke failed. Some data may have survived.', 'error'));
    }
    setClearing(false);
  };

  const handleClearAll = () => {
    if (nukeCountdown !== null || clearing) return;
    requireAdmin(async () => {
      if (!confirm('You are about to nuke everything \u2014 all expenses, travelers, receipts, and trip data will be vaporized from the cloud. This cannot be undone.')) return;
      if (!confirm('FINAL WARNING: There is no coming back from this. Nuke it all?')) return;
      setNukeCountdown(10);
      nukeTimerRef.current = setInterval(() => {
        setNukeCountdown(prev => {
          if (prev <= 1) {
            clearInterval(nukeTimerRef.current);
            executeNuke();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });
  };

  const cancelNuke = () => {
    clearInterval(nukeTimerRef.current);
    setNukeCountdown(null);
    dispatch(toast('Nuke aborted. Data lives to see another day.'));
  };

  return (
    <>
    <Card>
      <CardTitle icon="&#9992;" gradient="var(--gradient-primary)">Trip Info</CardTitle>

      <AnimatePresence>
        {isAdmin && dirty && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 18px', marginBottom: 16,
              borderRadius: 10,
              background: 'rgba(52,211,153,0.04)',
              border: '1px solid rgba(52,211,153,0.15)',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>You have unsaved changes</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn small variant="ghost" onClick={handleCancel}>Cancel</Btn>
                <Btn small variant="success" onClick={handleSave}>Save</Btn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

              <div className="trip-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {[
                  { field: 'tripName', label: 'Trip Name', type: 'text', placeholder: 'e.g. EL Yu 2026' },
                  { field: 'tripDestination', label: 'Destination', type: 'text', placeholder: 'e.g. La Union' },
                  { field: 'tripStart', label: 'Start Date', type: 'date' },
                  { field: 'tripEnd', label: 'End Date', type: 'date' },
                  { field: 'maxTravelers', label: 'Max Travelers', type: 'number', placeholder: '10', min: 1, max: 50 },
                ].map(f => (
                  <FormGroup key={f.field} label={f.label}>
                    <input
                      type={f.type}
                      value={draft[f.field]}
                      readOnly={!isAdmin}
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      maxLength={f.type === 'text' ? 100 : undefined}
                      onChange={e => handleDraftChange(f.field, e.target.value, f.type)}
                      style={{
                        ...(!isAdmin ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                        ...(errors[f.field] ? { borderColor: 'var(--accent1)' } : {}),
                      }}
                    />
                    {errors[f.field] && (
                      <span style={{ color: 'var(--accent1)', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
                        {errors[f.field]}
                      </span>
                    )}
                  </FormGroup>
                ))}
              </div>

              {/* Car Pooling */}
              <div className="carpool-section" style={{
                marginTop: 22, padding: '16px 18px', borderRadius: 14,
                background: numberOfCars > 0 ? 'rgba(72,219,251,0.04)' : 'var(--surface2)',
                border: `1px solid ${numberOfCars > 0 ? 'rgba(72,219,251,0.2)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.1rem' }}>{'\u{1F697}'}</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Car Pooling</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>
                        {numberOfCars > 0
                          ? `${numberOfCars} car${numberOfCars !== 1 ? 's' : ''} \u2014 active`
                          : 'Not configured'}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={draft.numberOfCars || ''}
                        placeholder="0"
                        onChange={e => handleDraftChange('numberOfCars', e.target.value, 'number')}
                        style={{ width: 60, height: 36, textAlign: 'center', fontSize: '0.88rem', fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>cars</span>
                      {draft.numberOfCars > 0 && (
                        <button
                          onClick={() => handleDraftChange('numberOfCars', '0', 'number')}
                          style={{
                            background: 'none', border: '1px solid rgba(255,107,107,0.3)',
                            borderRadius: 6, padding: '4px 10px', fontSize: '0.68rem', fontWeight: 600,
                            color: 'var(--accent1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Disable
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(84,160,255,0.06)', border: '1px solid rgba(84,160,255,0.12)',
                  fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--text2)',
                }}>
                  When set, all <strong style={{ color: 'var(--text)' }}>parking</strong>, <strong style={{ color: 'var(--text)' }}>toll</strong>, and <strong style={{ color: 'var(--text)' }}>fuel</strong> expenses
                  will be pooled together and split equally among <strong style={{ color: 'var(--text)' }}>all travelers</strong>,
                  regardless of who was originally included in each expense&apos;s split.
                  {numberOfCars > 0 && ' This is currently active and affects settlement calculations.'}
                </div>
                {errors.numberOfCars && (
                  <span style={{ color: 'var(--accent1)', fontSize: '0.72rem', marginTop: 6, display: 'block' }}>
                    {errors.numberOfCars}
                  </span>
                )}
              </div>

              <div style={{ marginTop: 22 }}>
                <CardTitle icon="&#128101;" gradient="var(--gradient-primary)">
                  Travelers ({travelers.length}/{maxTravelers})
                </CardTitle>

                <div className="invite-grid" style={{ marginBottom: 12 }}>
                  <AnimatePresence>
                    {travelers.map((t, i) => (
                      <motion.div
                        key={t.name}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="invite-card"
                        style={{ flexDirection: 'row', justifyContent: 'space-between', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(i)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent1)', fontSize: '1.1rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
                          >
                            &times;
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {isAdmin && (
                  <div className="add-traveler-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      ref={travelerInputRef}
                      value={newName}
                      onChange={e => { const v = e.target.value; setNewName(v.charAt(0).toUpperCase() + v.slice(1)); }}
                      onKeyDown={e => e.key === 'Enter' && handleAddTraveler()}
                      placeholder="Add traveler name"
                      maxLength={30}
                      style={{ flex: 1 }}
                    />
                    <Btn small variant="primary" onClick={handleAddTraveler}>+ Add</Btn>
                  </div>
                )}

                {isAdmin && travelers.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: 'var(--text2)', marginBottom: 8, paddingLeft: 2,
                    }}>
                      {'\u{1F517}'} Invite Links
                    </div>
                    <div className="invite-grid">
                      {travelers.map(t => (
                        <div key={t.name} className="invite-card" onClick={() => copyInviteLink(t.name)}
                          style={copiedHash === t.name ? { background: 'rgba(67,233,123,0.08)', borderColor: 'rgba(67,233,123,0.3)' } : undefined}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {copiedHash === t.name ? '\u2713 Copied' : t.name}
                            </span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); copyInviteLink(t.name); }}
                            disabled={!travelerHashes[t.name]}
                            className="invite-copy-btn"
                            style={{
                              background: copiedHash === t.name ? 'rgba(67,233,123,0.15)' : 'var(--surface3)',
                              border: `1px solid ${copiedHash === t.name ? 'rgba(67,233,123,0.3)' : 'var(--border)'}`,
                              color: copiedHash === t.name ? 'var(--green)' : 'var(--accent5)',
                            }}
                          >
                            {copiedHash === t.name ? '\u2713 Copied' : '\u{1F4CB} Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="invite-hint" style={{ fontSize: '0.65rem', color: 'var(--text2)', marginTop: 6, fontStyle: 'italic' }}>
                      Tap a name to copy their invite link
                    </div>
                  </div>
                )}
              </div>

              <div className="trip-admin" style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isLockedOut ? 'var(--accent4)' : isAdmin ? 'var(--green)' : 'var(--accent1)',
                      display: 'inline-block',
                    }} />
                    <span style={{ color: 'var(--text2)' }}>
                      {isLockedOut ? `Locked out (${lockoutCountdown})` : isAdmin ? `Admin (${countdown})` : 'Admin locked'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isAdmin ? (
                      <Btn small variant="ghost" onClick={doLock}>&#128274; Lock</Btn>
                    ) : (
                      <Btn small variant="success" className="trip-admin-unlock" onClick={tryUnlock} disabled={isLockedOut}>&#128275; Unlock</Btn>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="expense-lock-section" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: 'var(--text2)', marginBottom: 10, paddingLeft: 2,
                    }}>
                      {'\u{1F512}'} Expense Lock
                    </div>
                    {expenseLockDate ? (() => {
                      const isLocked = new Date(expenseLockDate) <= new Date();
                      return (
                        <div style={{
                          padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                          background: isLocked ? 'rgba(255,107,107,0.1)' : 'rgba(254,202,87,0.1)',
                          border: `1px solid ${isLocked ? 'rgba(255,107,107,0.25)' : 'rgba(254,202,87,0.25)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                        }}>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isLocked ? 'var(--accent1)' : 'var(--accent2)' }}>
                              {isLocked ? '\u{1F512} Expenses Locked' : '\u{1F552} Lock Scheduled'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: 2 }}>
                              {isLocked ? 'Since' : 'Will lock on'}: {new Date(expenseLockDate).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {!isLocked && lockCountdown && (
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent2)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                                Locks in {lockCountdown}
                              </div>
                            )}
                          </div>
                          <Btn small variant="ghost" onClick={() => { dispatch(setExpenseLockDate(null)); dispatch(toast('Expense lock removed.')); }}>
                            {'\u{1F513}'} Unlock
                          </Btn>
                        </div>
                      );
                    })() : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="datetime-local"
                          value={lockDraft}
                          onChange={e => setLockDraft(e.target.value)}
                          style={{ flex: 1, minWidth: 180 }}
                        />
                        <Btn small variant="primary" onClick={() => {
                          if (!lockDraft) { dispatch(toast('Pick a date and time.', 'error')); return; }
                          dispatch(setExpenseLockDate(new Date(lockDraft).toISOString()));
                          dispatch(toast('Expense lock set!'));
                          setLockDraft('');
                        }}>{'\u{1F512}'} Set Lock</Btn>
                        <Btn small variant="danger" onClick={() => {
                          dispatch(setExpenseLockDate(new Date().toISOString()));
                          dispatch(toast('Expenses locked now!'));
                        }}>{'\u{1F512}'} Lock Now</Btn>
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'var(--text2)', marginTop: 6 }}>
                      When locked, users cannot add, edit, or delete expenses. Admins can still make changes.
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="nuke-section" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Btn small variant="danger" onClick={handleClearAll} disabled={clearing || nukeCountdown !== null}>
                        {clearing ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <motion.span
                              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.6, 1], rotate: [0, 15, -15, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ display: 'inline-block', fontSize: '1rem' }}
                            >
                              {'\u2622\uFE0F'}
                            </motion.span>
                            Nuking...
                          </span>
                        ) : nukeCountdown !== null ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <motion.span
                              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.6, 1], rotate: [0, 15, -15, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ display: 'inline-block', fontSize: '1rem' }}
                            >
                              {'\u2622\uFE0F'}
                            </motion.span>
                            Nuking in {nukeCountdown}...
                          </span>
                        ) : '\u2622\uFE0F Nuke Data'}
                      </Btn>
                      {nukeCountdown !== null && !clearing && (
                        <Btn small variant="danger" onClick={cancelNuke}>Cancel</Btn>
                      )}
                    </span>

                  </div>
                )}
              </div>
    </Card>
    <PasswordModal open={showPasswordModal} onSubmit={handlePasswordSubmit} onClose={handlePasswordClose} />
    <Modal open={!!firstTravelerModal} onClose={() => { if (firstTravelerModal) window.location.href = firstTravelerModal.link; }}>
      {firstTravelerModal && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>{'\u{1F517}'}</div>
          <h3 style={{ color: 'var(--accent5)', marginBottom: 8 }}>Save Your Invite Link</h3>
          <p style={{ color: 'var(--text2)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)' }}>{firstTravelerModal.name}</strong> has been added as the first traveler.
            Copy the invite link below &mdash; you will need it to access the app next time.
          </p>
          <div
            onClick={() => {
              navigator.clipboard.writeText(firstTravelerModal.link).then(() => {
                dispatch(toast(`Invite link for ${firstTravelerModal.name} copied!`));
              }).catch(() => { /* ignored */ });
            }}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.78rem', wordBreak: 'break-all', cursor: 'pointer',
              color: 'var(--accent5)', lineHeight: 1.5, marginBottom: 16,
            }}
          >
            {firstTravelerModal.link}
          </div>
          <p style={{ color: 'var(--text2)', fontSize: '0.75rem', marginBottom: 16 }}>Tap the link above to copy</p>
          <Btn variant="primary" onClick={() => {
            navigator.clipboard.writeText(firstTravelerModal.link).then(() => {
              dispatch(toast(`Invite link for ${firstTravelerModal.name} copied!`));
            }).catch(() => { /* ignored */ });
            window.location.href = firstTravelerModal.link;
          }}>Copy &amp; Go to My Link</Btn>
        </div>
      )}
    </Modal>
    </>
  );
}
