import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useAdmin } from './hooks/useAdmin';
import { useCountdownTo } from './hooks/useCountdownTo';
import { resolveUser, hashName } from './utils/helpers';
import { startAutoPolling, stopAutoPolling, fetchTokens, seedTokens } from './utils/sync';
import Header from './components/Header';
import SyncBar from './components/SyncBar';
import TripInfo from './components/TripInfo';
import ExpenseForm from './components/ExpenseForm';
import ExpenseTable from './components/ExpenseTable';
import FundsTab from './components/FundsTab';
import SummaryTab from './components/SummaryTab';
import SettlementTab from './components/SettlementTab';
import { Tabs, Btn, Toasts, Card, Modal, Spinner } from './components/UI';
import PasswordModal from './components/PasswordModal';
import { setPaymentInfo, setQrCode } from './store/tripSlice';
import { toast } from './store/toastSlice';
import { uploadQrCode, getQrUrl } from './utils/sync';
import { QR_TYPES, MAX_QR_SIZE, WALLET_TYPES } from './utils/constants';

const TABS = [
  { key: 'expenses', label: 'Expenses', icon: '\u{1F4CB}' },
  { key: 'funds', label: 'Funds', icon: '\u{1F4B0}' },
  { key: 'summary', label: 'Summary', icon: '\u{1F4CA}' },
  { key: 'settlement', label: 'Settlement', icon: '\u{1F91D}' },
];

function TermsModal({ open, onAccept }) {
  return (
    <Modal open={open} onClose={() => {}}>
      <h3 style={{ color: 'var(--accent5)', marginBottom: 16 }}>&#128220; Terms & Agreement</h3>
      <div style={{ fontSize: '0.85rem', color: 'var(--text2)', lineHeight: 1.7, maxHeight: 400, overflowY: 'auto', marginBottom: 20 }}>
        <p style={{ marginBottom: 12 }}>By using this Travel Expense Worksheet, you agree to the following:</p>
        <p style={{ marginBottom: 10 }}><strong>1. Data Accuracy</strong> — You are responsible for the accuracy of all expense entries, payments, and collections you submit. All amounts should be recorded truthfully.</p>
        <p style={{ marginBottom: 10 }}><strong>2. Shared Access</strong> — This application is shared among all travelers in the group. Any data you enter may be viewed by other members. Do not enter sensitive personal information beyond what is required.</p>
        <p style={{ marginBottom: 10 }}><strong>3. Data Storage</strong> — Data is stored locally in your browser and synced in real time to Firebase. Receipt files are stored in Azure cloud storage. Data may be lost if browser storage is cleared or cloud access is revoked.</p>
        <p style={{ marginBottom: 10 }}><strong>4. Access Control</strong> — Access to this app requires a unique personal link. Do not share your link with others. Only authorized travelers can view and submit data.</p>
        <p style={{ marginBottom: 10 }}><strong>5. Settlement Agreement</strong> — The settlement calculations are provided as a convenience. All parties agree to settle their balances as computed by the app in good faith.</p>
        <p style={{ marginBottom: 10 }}><strong>6. Admin Actions</strong> — Only authorized users should perform admin actions (editing trip info, managing funds, modifying expenses). Unauthorized access attempts are subject to lockout.</p>
        <p style={{ marginBottom: 10 }}><strong>7. No Warranty</strong> — This application is provided "as is" without warranty of any kind. The developers are not liable for any data loss, miscalculations, or disputes arising from its use.</p>
        <p><strong>8. Agreement</strong> — By clicking "I Agree" below, you acknowledge that you have read and understood these terms.</p>
      </div>
      <Btn variant="success" onClick={onAccept}>&#10003; I Agree</Btn>
    </Modal>
  );
}

function PaymentSetupModal({ open, onClose, currentUser }) {
  const dispatch = useDispatch();
  const syncConfig = useSelector(s => s.sync);
  const existingInfo = useSelector(s => s.trip.paymentInfo?.[currentUser]);
  const existingQr = useSelector(s => s.trip.qrCodes?.[currentUser]) || {};
  const normalizedQr = typeof existingQr === 'string' ? { gcash: existingQr } : existingQr;

  const [form, setForm] = useState({ gcash: '', maya: '', maribank: '' });
  const [customForm, setCustomForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [qrFiles, setQrFiles] = useState({});
  const [qrPreviews, setQrPreviews] = useState({});
  const [removedQrs, setRemovedQrs] = useState({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {  
    if (open && !initialized) {
      setForm({
        gcash: existingInfo?.gcash || '',
        maya: existingInfo?.maya || '',
        maribank: existingInfo?.maribank || '',
      });
      const savedCustom = existingInfo?.custom || null;
      setCustomForm(savedCustom ? { label: savedCustom.label || '', number: savedCustom.number || '' } : null);
      setQrFiles({});
      setQrPreviews({});
      setRemovedQrs({});
      setErrors({});
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, initialized, existingInfo]);

  const handleChange = (field, value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 13);
    setForm(prev => ({ ...prev, [field]: cleaned }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleQrSelect = (walletKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!QR_TYPES.includes(file.type)) { dispatch(toast('Only JPG, PNG, or WebP images allowed.', 'error')); return; }
    if (file.size > MAX_QR_SIZE) { dispatch(toast('Image too large. Max 10MB.', 'error')); return; }
    if (qrPreviews[walletKey]) URL.revokeObjectURL(qrPreviews[walletKey]);
    setQrFiles(prev => ({ ...prev, [walletKey]: file }));
    setQrPreviews(prev => ({ ...prev, [walletKey]: URL.createObjectURL(file) }));
    setRemovedQrs(prev => ({ ...prev, [walletKey]: false }));
  };

  const handleQrRemove = (walletKey) => {
    if (qrPreviews[walletKey]) URL.revokeObjectURL(qrPreviews[walletKey]);
    setQrFiles(prev => { const n = { ...prev }; delete n[walletKey]; return n; });
    setQrPreviews(prev => { const n = { ...prev }; delete n[walletKey]; return n; });
    setRemovedQrs(prev => ({ ...prev, [walletKey]: true }));
  };

  const getPreviewUrl = (walletKey) => {
    if (qrPreviews[walletKey]) return qrPreviews[walletKey];
    if (removedQrs[walletKey]) return null;
    if (normalizedQr[walletKey]) return getQrUrl(syncConfig, normalizedQr[walletKey]);
    return null;
  };

  const handleSave = async () => {
    const errs = {};
    if (form.gcash && (form.gcash.length !== 11 || !form.gcash.startsWith('09'))) errs.gcash = 'Must be 11 digits starting with 09';
    if (form.maya && (form.maya.length !== 11 || !form.maya.startsWith('09'))) errs.maya = 'Must be 11 digits starting with 09';
    if (form.maribank && form.maribank.length < 10) errs.maribank = 'Must be at least 10 digits';
    setErrors(errs);
    if (Object.keys(errs).length > 0) { dispatch(toast('Please fix the errors.', 'error')); return; }

    setUploading(true);
    try {
      const info = { ...form };
      if (customForm && customForm.label && customForm.number) {
        info.custom = { label: customForm.label, number: customForm.number };
      } else {
        info.custom = null;
      }
      if (form.gcash || form.maya || form.maribank || info.custom) {
        dispatch(setPaymentInfo({ name: currentUser, info }));
      }
      for (const w of WALLET_TYPES) {
        if (qrFiles[w.key]) {
          const blobPath = await uploadQrCode(syncConfig, `${currentUser}_${w.key}`, qrFiles[w.key]);
          dispatch(setQrCode({ name: currentUser, type: w.key, path: blobPath }));
        } else if (removedQrs[w.key]) {
          dispatch(setQrCode({ name: currentUser, type: w.key, path: null }));
        }
      }
      if (qrFiles.custom) {
        const blobPath = await uploadQrCode(syncConfig, `${currentUser}_custom`, qrFiles.custom);
        dispatch(setQrCode({ name: currentUser, type: 'custom', path: blobPath }));
      } else if (removedQrs.custom) {
        dispatch(setQrCode({ name: currentUser, type: 'custom', path: null }));
      }
      dispatch(toast('Payment info saved!'));
    } catch (err) {
      console.error('Payment setup error:', err);
      dispatch(toast('Failed to save. You can update later in Settlement tab.', 'error'));
    }
    setUploading(false);
    localStorage.setItem('paymentSetupDone', 'true');
    Object.values(qrPreviews).forEach(u => URL.revokeObjectURL(u));
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('paymentSetupDone', 'true');
    Object.values(qrPreviews).forEach(u => URL.revokeObjectURL(u));
    onClose();
  };



  return (
    <Modal open={open} onClose={() => {}}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
          background: 'var(--gradient1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', boxShadow: '0 4px 16px rgba(102,126,234,0.3)',
        }}>
          &#128179;
        </div>
        <h3 style={{ color: 'var(--text)', marginBottom: 4, fontSize: '1.1rem' }}>Set Up Your Payment Info</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>
          Add your details so others know how to pay you.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {WALLET_TYPES.map(f => {
          const preview = getPreviewUrl(f.key);
          const hasValue = !!form[f.key];
          return (
            <div key={f.key} style={{
              padding: 14, borderRadius: 12,
              background: 'var(--surface2)', border: `1px solid ${errors[f.key] ? 'rgba(255,107,107,0.4)' : hasValue ? 'rgba(67,233,123,0.25)' : 'var(--border)'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  {f.label}
                </span>
                {hasValue && !errors[f.key] && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.5, color: 'var(--green)', background: 'rgba(0,210,211,0.15)',
                    padding: '2px 8px', borderRadius: 20,
                  }}>{'\u2713'} Added</span>
                )}
              </div>
              <input
                value={form[f.key] || ''}
                onChange={e => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                inputMode="numeric"
                maxLength={f.maxLen}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface3)', borderColor: errors[f.key] ? 'var(--accent1)' : 'var(--border)',
                  fontSize: '0.88rem', letterSpacing: '1px',
                }}
              />
              {errors[f.key] && (
                <div style={{ fontSize: '0.68rem', color: 'var(--accent1)', marginTop: 4, fontWeight: 500 }}>
                  {'\u26A0'} {errors[f.key]}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {preview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      position: 'relative', borderRadius: 10, overflow: 'hidden',
                      border: '1.5px solid var(--accent5)', background: 'var(--surface3)',
                    }}>
                      <img
                        src={preview}
                        alt={`${f.label} QR`}
                        style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{
                        flex: 1, background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '6px 0', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        color: 'var(--accent5)', transition: 'all 0.2s',
                      }}>
                        {'\u{1F504}'} Replace
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrSelect(f.key, e)} style={{ display: 'none' }} />
                      </label>
                      <button
                        onClick={() => handleQrRemove(f.key)}
                        style={{
                          flex: 1, background: 'none', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8,
                          padding: '6px 0', fontSize: '0.7rem', fontWeight: 600,
                          cursor: 'pointer', color: 'var(--accent1)', transition: 'all 0.2s',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {'\u{1F5D1}'} Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    background: 'var(--surface3)', border: '1.5px dashed var(--border)', borderRadius: 10,
                    padding: '12px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    color: 'var(--text2)', transition: 'all 0.2s',
                  }}>
                    {'\u{1F4F7}'} Upload QR
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrSelect(f.key, e)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom bank/wallet */}
        {!customForm ? (
          <div
            onClick={() => setCustomForm({ label: '', number: '' })}
            style={{
              padding: 14, borderRadius: 12, background: 'var(--surface2)',
              border: '1.5px dashed var(--border)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: '0.78rem', fontWeight: 600, color: 'var(--text2)',
              transition: 'all 0.2s',
            }}
          >
            {'\u{1F3E6}'} + Add Custom Bank/Wallet
          </div>
        ) : (
          <div style={{
            padding: 14, borderRadius: 12, background: 'var(--surface2)',
            border: `1px solid ${(customForm.label && customForm.number) ? 'rgba(67,233,123,0.25)' : 'var(--border)'}`,
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>{'\u{1F3E6}'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Custom Bank/Wallet
              </span>
              {customForm.label && customForm.number && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.5, color: 'var(--green)', background: 'rgba(0,210,211,0.15)',
                  padding: '2px 8px', borderRadius: 20,
                }}>{'\u2713'} Added</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={customForm.label}
                onChange={e => setCustomForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Bank/wallet name (e.g. BPI, PayPal)"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface3)', fontSize: '0.88rem' }}
              />
              <input
                value={customForm.number}
                onChange={e => setCustomForm(prev => ({ ...prev, number: e.target.value }))}
                placeholder="Account number"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface3)', fontSize: '0.88rem', letterSpacing: '1px' }}
              />
            </div>
            {/* QR upload for custom */}
            <div style={{ marginTop: 10 }}>
              {(() => {
                const preview = getPreviewUrl('custom');
                return preview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                      position: 'relative', borderRadius: 10, overflow: 'hidden',
                      border: '1.5px solid var(--accent5)', background: 'var(--surface3)',
                    }}>
                      <img src={preview} alt="Custom QR" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{
                        flex: 1, background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '6px 0', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        color: 'var(--accent5)', transition: 'all 0.2s',
                      }}>
                        {'\u{1F504}'} Replace
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrSelect('custom', e)} style={{ display: 'none' }} />
                      </label>
                      <button
                        onClick={() => handleQrRemove('custom')}
                        style={{
                          flex: 1, background: 'none', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8,
                          padding: '6px 0', fontSize: '0.7rem', fontWeight: 600,
                          cursor: 'pointer', color: 'var(--accent1)', transition: 'all 0.2s',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {'\u{1F5D1}'} Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    background: 'var(--surface3)', border: '1.5px dashed var(--border)', borderRadius: 10,
                    padding: '12px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    color: 'var(--text2)', transition: 'all 0.2s',
                  }}>
                    {'\u{1F4F7}'} Upload QR
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrSelect('custom', e)} style={{ display: 'none' }} />
                  </label>
                );
              })()}
            </div>
            <button
              onClick={() => { setCustomForm(null); handleQrRemove('custom'); }}
              style={{
                marginTop: 10, width: '100%', background: 'none',
                border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8,
                padding: '6px 0', fontSize: '0.7rem', fontWeight: 600,
                cursor: 'pointer', color: 'var(--accent1)', transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {'\u{1F5D1}'} Remove Custom
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="success" onClick={handleSave} disabled={uploading} style={{ flex: 1 }}>
          {uploading ? <><Spinner size={16} color="#1a1a2e" /> Saving...</> : <><span>&#10003;</span> Save</>}
        </Btn>
        <Btn variant="ghost" onClick={handleSkip} disabled={uploading} style={{ flex: 1 }}>
          Skip for Now
        </Btn>
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--text2)', textAlign: 'center', marginTop: 14, marginBottom: 0, opacity: 0.7 }}>
        You can update these anytime in the Settlement tab.
      </p>
    </Modal>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTop: '3px solid var(--accent5)', borderRadius: '50%' }}
      />
      <div style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>Loading...</div>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(() => localStorage.getItem('termsAccepted') === 'true');
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const { isAdmin, showPasswordModal, handlePasswordSubmit, handlePasswordClose } = useAdmin();
  const travelers = useSelector(s => s.trip.travelers);
  const expenseLockDate = useSelector(s => s.trip.expenseLockDate);
  const isExpenseLocked = expenseLockDate && new Date(expenseLockDate) <= new Date() && !isAdmin;
  const { countdown: lockCountdown } = useCountdownTo(expenseLockDate);
  const [currentUser, setCurrentUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);

  useEffect(() => {
    startAutoPolling(dispatch, () => setLoading(false));
    return () => stopAutoPolling();
  }, [dispatch]);

  useEffect(() => {
    if (loading) return;
    if (travelers.length === 0) {
      setUserChecked(true);
      return;
    }
    (async () => {
      let tokens = await fetchTokens();
      if (Object.keys(tokens).length === 0 && travelers.length > 0) {
        await seedTokens(travelers, hashName);
        tokens = await fetchTokens();
      }
      const name = await resolveUser(travelers, tokens);
      if (name) setCurrentUser(name);
      setUserChecked(true);
    })();
  }, [loading, travelers]);

  useEffect(() => {
    if (!currentUser || travelers.length === 0) return;
    if (!travelers.some(t => t.name === currentUser)) {
      setAccessRevoked(true);
      setCurrentUser(null);
    }
  }, [currentUser, travelers]);

  useEffect(() => {
    if (!loading && accepted && currentUser && userChecked && localStorage.getItem('paymentSetupDone') !== 'true') {
      setShowPaymentSetup(true);
    }
  }, [loading, accepted, currentUser, userChecked]);

  if (loading) {
    return <LoadingScreen />;
  }

  const handleAccept = () => {
    localStorage.setItem('termsAccepted', 'true');
    setAccepted(true);
  };

  if (!accepted) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <Header />
        <TermsModal open={true} onAccept={handleAccept} />
        <Toasts />
      </div>
    );
  }

  if (travelers.length > 0 && !userChecked) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <Header />
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
          <Spinner size={24} />
          <span style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>Verifying access...</span>
        </Card>
        <Toasts />
      </div>
    );
  }

  if (travelers.length > 0 && userChecked && !currentUser && !isAdmin) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <Header />
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2rem', marginBottom: 16 }}>{accessRevoked ? '\u{1F6AB}' : '\u{1F6AB}'}</div>
          <h3 style={{ color: 'var(--accent1)', marginBottom: 10 }}>{accessRevoked ? 'Access Revoked' : 'Access Denied'}</h3>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
            {accessRevoked
              ? 'Your access has been revoked. You are no longer part of this trip.'
              : 'Invalid or missing user token. Please use the link provided to you.'}
          </p>
        </Card>
        <Toasts />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <Header />
      {/* <SyncBar /> */}

      {currentUser && (
        <Card className="no-print" style={{ padding: '8px 20px', marginBottom: 16, background: 'rgba(84,160,255,0.08)', border: '1px solid rgba(84,160,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
            <span>&#128100;</span>
            <span style={{ color: 'var(--text2)' }}>Logged in as</span>
            <strong style={{ color: 'var(--accent5)' }}>{currentUser}</strong>
          </div>
        </Card>
      )}

      {isExpenseLocked && (
        <Card className="no-print" style={{ padding: '10px 20px', marginBottom: 16, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'var(--accent1)', fontWeight: 600 }}>
            <span>{`\u{1F512}`}</span>
            <span>Expenses are locked for settlement. Contact the admin to unlock.</span>
          </div>
        </Card>
      )}

      {!isExpenseLocked && lockCountdown && (
        <Card className="no-print" style={{ padding: '10px 20px', marginBottom: 16, background: 'rgba(254,202,87,0.08)', border: '1px solid rgba(254,202,87,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'var(--accent2)', fontWeight: 600 }}>
            <span>{`\u{1F552}`}</span>
            <span>Expenses will lock in <span style={{ fontVariantNumeric: 'tabular-nums' }}>{lockCountdown}</span></span>
          </div>
        </Card>
      )}

      <TripInfo />

      <div className="no-print">
        <ExpenseForm currentUser={currentUser} />
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'expenses' && <ExpenseTable currentUser={currentUser} />}
          {activeTab === 'funds' && <FundsTab />}
          {activeTab === 'summary' && <SummaryTab currentUser={currentUser} />}
          {activeTab === 'settlement' && <SettlementTab currentUser={currentUser} />}
        </motion.div>
      </AnimatePresence>

      <PaymentSetupModal open={showPaymentSetup} onClose={() => setShowPaymentSetup(false)} currentUser={currentUser} />
      <PasswordModal open={showPasswordModal} onSubmit={handlePasswordSubmit} onClose={handlePasswordClose} />
      <Toasts />
    </div>
  );
}
