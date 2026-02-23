import { useState, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { setQrCode, setPaymentInfo, markSettlementPaid, unmarkSettlementPaid, markExpensePaid, unmarkExpensePaid } from '../store/tripSlice';
import { toast } from '../store/toastSlice';
import { formatNum } from '../utils/helpers';
import { computeBalances, computeSettlements } from '../utils/settlements';
import { QR_TYPES, MAX_QR_SIZE, WALLET_TYPES } from '../utils/constants';
import { uploadQrCode, deleteQrCode, getQrUrl } from '../utils/sync';
import { Card, CardTitle, Btn, Modal, Spinner } from './UI';


export default function SettlementTab({ currentUser }) {
  const dispatch = useDispatch();
  const { expenses, travelers, qrCodes = {}, paymentInfo = {}, paidSettlements = {}, paidExpenses = {}, dpCollections = [], hotelCostPerHead, hotelNights, hotelParkingSlots, hotelParkingCost } = useSelector(s => s.trip);
  const syncConfig = useSelector(s => s.sync);
  const [qrModal, setQrModal] = useState(null);
  const [qrWallet, setQrWallet] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadKey, setUploadKey] = useState(0);
  const savedInfo = paymentInfo[currentUser] || { gcash: '', maya: '', maribank: '' };
  const [infoForm, setInfoForm] = useState({ gcash: savedInfo.gcash || '', maya: savedInfo.maya || '', maribank: savedInfo.maribank || '' });
  const [infoErrors, setInfoErrors] = useState({});
  const infoDirty = infoForm.gcash !== (savedInfo.gcash || '') || infoForm.maya !== (savedInfo.maya || '') || infoForm.maribank !== (savedInfo.maribank || '');

  useEffect(() => {
    if (!infoDirty) setInfoForm({ gcash: savedInfo.gcash || '', maya: savedInfo.maya || '', maribank: savedInfo.maribank || '' });
  }, [savedInfo.gcash, savedInfo.maya, savedInfo.maribank]);

  const { balances } = useMemo(
    () => computeBalances(expenses, travelers), [expenses, travelers]
  );

  const settlements = useMemo(
    () => computeSettlements(balances), [balances]
  );

  const travelerNames = useMemo(() => new Set(travelers.map(t => t.name)), [travelers]);
  const activeDpCollections = useMemo(() => dpCollections.filter(d => travelerNames.has(d.from)), [dpCollections, travelerNames]);

  const hotelCost = useMemo(() => (hotelCostPerHead * travelers.length * hotelNights) + (hotelParkingSlots * hotelParkingCost * hotelNights), [hotelCostPerHead, travelers.length, hotelNights, hotelParkingSlots, hotelParkingCost]);
  const totalCollected = useMemo(() => activeDpCollections.reduce((s, d) => s + d.amount, 0), [activeDpCollections]);
  const totalExcess = totalCollected - hotelCost;

  const excessByCollector = useMemo(() => {
    const sharePerPerson = travelers.length > 0 ? hotelCost / travelers.length : 0;
    const byCollector = {};
    activeDpCollections.forEach(d => {
      if (!d.collectedBy) return;
      if (!byCollector[d.collectedBy]) byCollector[d.collectedBy] = {};
      byCollector[d.collectedBy][d.from] = (byCollector[d.collectedBy][d.from] || 0) + d.amount;
    });
    const result = [];
    Object.entries(byCollector).forEach(([collector, perPerson]) => {
      const persons = [];
      let collectorTotal = 0;
      let collectorHotelShare = 0;
      Object.entries(perPerson).forEach(([person, collected]) => {
        const excess = collected - sharePerPerson;
        collectorTotal += collected;
        collectorHotelShare += sharePerPerson;
        persons.push({ person, collected, hotelShare: sharePerPerson, excess });
      });
      const totalExcessForCollector = collectorTotal - collectorHotelShare;
      if (Math.abs(totalExcessForCollector) > 0.01) {
        result.push({ collector, persons, totalCollected: collectorTotal, totalHotelShare: collectorHotelShare, totalExcess: totalExcessForCollector });
      }
    });
    return result;
  }, [activeDpCollections, travelers, hotelCost]);

  const combinedSettlements = useMemo(() => {
    const netMap = {};
    const addFlow = (from, to, amount) => {
      if (Math.abs(amount) < 0.01 || from === to) return;
      const [a, b] = [from, to].sort();
      const k = a + '__' + b;
      if (!netMap[k]) netMap[k] = { a, b, net: 0 };
      netMap[k].net += from === a ? amount : -amount;
    };
    settlements.forEach(s => addFlow(s.from, s.to, s.amount));
    excessByCollector.forEach(e => {
      e.persons.forEach(p => {
        if (Math.abs(p.excess) > 0.01) addFlow(e.collector, p.person, p.excess);
      });
    });
    return Object.values(netMap)
      .filter(v => Math.abs(v.net) > 0.01)
      .map(v => ({
        from: v.net > 0 ? v.a : v.b,
        to: v.net > 0 ? v.b : v.a,
        amount: Math.abs(v.net),
      }));
  }, [settlements, excessByCollector]);

  const sKey = (s) => `${s.from}__${s.to}`;

  const expensesByPair = useMemo(() => {
    const map = {};
    expenses.forEach(exp => {
      const share = Math.round((exp.amount / exp.splitAmong.length) * 100) / 100;
      exp.splitAmong.forEach(name => {
        if (name !== exp.paidBy) {
          const k = `${name}__${exp.paidBy}`;
          if (!map[k]) map[k] = { from: name, to: exp.paidBy, expenses: [] };
          map[k].expenses.push({ ...exp, owedAmount: share });
        }
      });
    });
    return Object.values(map);
  }, [expenses]);

  const remainingByPair = useMemo(() => {
    const map = {};
    expensesByPair.forEach(pair => {
      const k = `${pair.from}__${pair.to}`;
      map[k] = pair.expenses.reduce((s, e) => s + (paidExpenses[e.id] ? 0 : e.owedAmount), 0);
    });
    return map;
  }, [expensesByPair, paidExpenses]);

  const isUserSettlement = (s) => currentUser && (s.from === currentUser || s.to === currentUser);
  const userSettlements = combinedSettlements.filter(isUserSettlement);
  const otherSettlements = combinedSettlements.filter(s => !isUserSettlement(s));

  const userCombinedBalance = useMemo(() => {
    if (!currentUser) return null;
    let net = 0;
    combinedSettlements.forEach(s => {
      if (s.to === currentUser) net += s.amount;
      if (s.from === currentUser) net -= s.amount;
    });
    return net;
  }, [currentUser, combinedSettlements]);
  const userOwes = userCombinedBalance !== null && userCombinedBalance < -0.01;

  const userRemainingBalance = useMemo(() => {
    if (!currentUser) return null;
    let net = 0;
    combinedSettlements.forEach(s => {
      const key = sKey(s);
      if (paidSettlements[key]) return;
      if (s.to === currentUser) net += s.amount;
      if (s.from === currentUser) net -= s.amount;
    });
    return net;
  }, [currentUser, combinedSettlements, paidSettlements]);
  const remainingDiffers = userRemainingBalance !== null && Math.abs(userRemainingBalance - userCombinedBalance) > 0.01;

  const getUserQr = (name) => {
    const q = qrCodes[name];
    if (!q) return {};
    if (typeof q === 'string') return { gcash: q };
    return q;
  };

  const handleQrUpload = async (walletKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!QR_TYPES.includes(file.type)) { dispatch(toast('Only JPG, PNG, or WebP images allowed.', 'error')); return; }
    if (file.size > MAX_QR_SIZE) { dispatch(toast('Image too large. Max 10MB.', 'error')); return; }
    setUploading(walletKey);
    try {
      const userQr = getUserQr(currentUser);
      const oldPath = userQr[walletKey];
      const blobPath = await uploadQrCode(syncConfig, `${currentUser}_${walletKey}`, file);
      if (oldPath && oldPath !== blobPath) {
        try { await deleteQrCode(syncConfig, oldPath); } catch {}
      }
      dispatch(setQrCode({ name: currentUser, type: walletKey, path: blobPath }));
      dispatch(toast(`${WALLET_TYPES.find(w => w.key === walletKey)?.label} QR uploaded!`));
    } catch (err) {
      console.error('QR upload error:', err);
      dispatch(toast('QR upload failed.', 'error'));
    }
    setUploading(null);
    setUploadKey(k => k + 1);
  };

  const handleRemoveQr = async (walletKey) => {
    const userQr = getUserQr(currentUser);
    const oldPath = userQr[walletKey];
    dispatch(setQrCode({ name: currentUser, type: walletKey, path: null }));
    setUploadKey(k => k + 1);
    if (oldPath) {
      try { await deleteQrCode(syncConfig, oldPath); } catch {}
    }
    dispatch(toast('QR code removed.'));
  };

  const handleInfoChange = (field, value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 13);
    setInfoForm(prev => ({ ...prev, [field]: cleaned }));
    setInfoErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleInfoSave = () => {
    const errs = {};
    if (infoForm.gcash && (infoForm.gcash.length !== 11 || !infoForm.gcash.startsWith('09'))) errs.gcash = 'Must be 11 digits starting with 09';
    if (infoForm.maya && (infoForm.maya.length !== 11 || !infoForm.maya.startsWith('09'))) errs.maya = 'Must be 11 digits starting with 09';
    if (infoForm.maribank && infoForm.maribank.length < 10) errs.maribank = 'Must be at least 10 digits';
    setInfoErrors(errs);
    if (Object.keys(errs).length > 0) { dispatch(toast('Please fix the errors.', 'error')); return; }
    dispatch(setPaymentInfo({ name: currentUser, info: infoForm }));
    dispatch(toast('Payment info saved!'));
  };

  const hasPaymentDetails = (name) => {
    const info = paymentInfo[name] || {};
    const qr = getUserQr(name);
    return !!(qr.gcash || qr.maya || qr.maribank || info.gcash || info.maya || info.maribank);
  };

  const nameClick = (name) => {
    if (hasPaymentDetails(name)) {
      const qr = getUserQr(name);
      const firstWithQr = WALLET_TYPES.find(w => qr[w.key]);
      setQrWallet(firstWithQr ? firstWithQr.key : null);
      setQrModal(name);
    }
  };

  const resolveQrUrl = (path) => path ? getQrUrl(syncConfig, path) : null;

  const renderName = (name, isUser, showQr) => {
    const showBtn = showQr && hasPaymentDetails(name);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...(isUser ? { color: 'var(--accent5)', fontWeight: 800 } : { fontWeight: 600 }),
        }}>
          {isUser && <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent5)',
            display: 'inline-block', flexShrink: 0,
          }} />}
          {name}{isUser ? ' (You)' : ''}
        </span>
        {showBtn && (
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 2px 12px rgba(84,160,255,0.4)' }}
            whileTap={{ scale: 0.93 }}
            onClick={() => nameClick(name)}
            style={{
              background: 'var(--gradient1)', border: 'none', borderRadius: 20,
              padding: '4px 10px', fontSize: '0.65rem', fontWeight: 700,
              color: 'white', cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif',
              letterSpacing: 0.5, textTransform: 'uppercase',
              boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
            }}
          >
            &#128247; View QR
          </motion.button>
        )}
      </span>
    );
  };

  const getSettlementExpenses = (s) => {
    const exps = [];
    expensesByPair.forEach(pair => {
      if (pair.from === s.from && pair.to === s.to) exps.push(...pair.expenses);
      else if (pair.from === s.to && pair.to === s.from) exps.push(...pair.expenses);
    });
    return exps;
  };

  const getPairExpenses = (key) => {
    const pair = expensesByPair.find(p => `${p.from}__${p.to}` === key);
    return pair ? pair.expenses : [];
  };

  const handleToggleSettlement = (s) => {
    const key = sKey(s);
    const date = new Date().toISOString().slice(0, 10);
    const allExps = getSettlementExpenses(s);
    if (paidSettlements[key]) {
      dispatch(unmarkSettlementPaid(key));
      allExps.forEach(exp => dispatch(unmarkExpensePaid(exp.id)));
      dispatch(toast('Settlement unmarked.'));
    } else {
      dispatch(markSettlementPaid({ key, confirmedBy: currentUser, date }));
      allExps.forEach(exp => {
        if (!paidExpenses[exp.id]) dispatch(markExpensePaid({ expenseId: exp.id, confirmedBy: currentUser, date }));
      });
      dispatch(toast('Settlement marked as paid!'));
    }
  };

  const findSettlementForPair = (pairKey) => {
    const [from, to] = pairKey.split('__');
    return combinedSettlements.find(s =>
      (s.from === from && s.to === to) || (s.from === to && s.to === from)
    );
  };

  const handleToggleExpense = (expenseId, pairKey) => {
    const date = new Date().toISOString().slice(0, 10);
    const settlement = findSettlementForPair(pairKey);
    const settlementKey = settlement ? sKey(settlement) : pairKey;
    if (paidExpenses[expenseId]) {
      dispatch(unmarkExpensePaid(expenseId));
      if (paidSettlements[settlementKey]) dispatch(unmarkSettlementPaid(settlementKey));
      dispatch(toast('Expense unmarked.'));
    } else {
      dispatch(markExpensePaid({ expenseId, confirmedBy: currentUser, date }));
      if (settlement) {
        const allExps = getSettlementExpenses(settlement);
        const allPaid = allExps.every(e => e.id === expenseId || paidExpenses[e.id]);
        if (allPaid) dispatch(markSettlementPaid({ key: settlementKey, confirmedBy: currentUser, date }));
      }
      dispatch(toast('Expense marked as paid!'));
    }
  };

  const handleMarkPairPaid = (pair) => {
    const date = new Date().toISOString().slice(0, 10);
    const pairKey = `${pair.from}__${pair.to}`;
    pair.expenses.forEach(exp => {
      if (!paidExpenses[exp.id]) dispatch(markExpensePaid({ expenseId: exp.id, confirmedBy: currentUser, date }));
    });
    const settlement = findSettlementForPair(pairKey);
    if (settlement) {
      const settlementKey = sKey(settlement);
      const allExps = getSettlementExpenses(settlement);
      const allPaid = allExps.every(e => pair.expenses.some(pe => pe.id === e.id) || paidExpenses[e.id]);
      if (allPaid && !paidSettlements[settlementKey]) dispatch(markSettlementPaid({ key: settlementKey, confirmedBy: currentUser, date }));
    }
    dispatch(toast(`All expenses from ${pair.from} marked as paid!`));
  };

  const renderRow = (s, i, highlight) => {
    const fromIsUser = currentUser && s.from === currentUser;
    const toIsUser = currentUser && s.to === currentUser;
    const key = sKey(s);
    const paid = paidSettlements[key];
    const fullyPaid = paid;
    return (
      <tr key={`${highlight ? 'u' : 'o'}-${i}`} style={{
        ...(highlight ? { background: 'rgba(84,160,255,0.08)' } : {}),
        ...(fullyPaid ? { opacity: 0.55 } : {}),
      }}>
        <td>{renderName(s.from, fromIsUser, false)}</td>
        <td style={{ color: 'var(--accent3)', fontWeight: 700 }}>&rarr;</td>
        <td>{renderName(s.to, toIsUser, highlight && !toIsUser)}</td>
        <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          &#8369;{formatNum(s.amount)}
        </td>
        <td style={{ textAlign: 'center' }}>
          {paid ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, color: 'var(--green)',
                background: 'rgba(67,233,123,0.12)', padding: '3px 10px', borderRadius: 20,
              }}>&#10003; Paid</span>
              {toIsUser && (
                <button onClick={() => handleToggleSettlement(s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.65rem', color: 'var(--text2)', textDecoration: 'underline',
                  fontFamily: 'Inter, sans-serif', padding: 0,
                }}>Undo</button>
              )}
            </span>
          ) : toIsUser ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleToggleSettlement(s)}
              style={{
                background: 'var(--gradient4)', border: 'none', borderRadius: 20,
                padding: '4px 12px', fontSize: '0.68rem', fontWeight: 700,
                color: '#1a1a2e', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >Confirm Paid</motion.button>
          ) : (
            <span style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>&mdash;</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
    <Card>
      <CardTitle icon="&#129309;" gradient="var(--gradient4)">Who Owes Whom</CardTitle>

      {currentUser && userCombinedBalance !== null && (Math.abs(userCombinedBalance) > 0.01) && (
        <div style={{
          padding: '12px 18px', borderRadius: 12, marginBottom: 16,
          background: userOwes ? 'rgba(255,107,107,0.1)' : 'rgba(67,233,123,0.1)',
          border: `1px solid ${userOwes ? 'rgba(255,107,107,0.25)' : 'rgba(67,233,123,0.25)'}`,
          fontSize: '0.88rem', fontWeight: 600,
          color: userOwes ? 'var(--accent1)' : 'var(--green)',
        }}>
          <div>{userOwes
            ? `You owe a total of \u20B1${formatNum(-userCombinedBalance)}`
            : `You are owed a total of \u20B1${formatNum(userCombinedBalance)}`}</div>
          {remainingDiffers && (
            <div style={{ marginTop: 4, fontSize: '0.82rem', fontWeight: 700 }}>
              {Math.abs(userRemainingBalance) < 0.01 ? '\u2714 All settled!' : `Remaining: \u20B1${formatNum(Math.abs(userRemainingBalance))}`}
            </div>
          )}
        </div>
      )}

      {currentUser && userSettlements.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            color: 'var(--accent5)', marginBottom: 8, paddingLeft: 2,
          }}>
            Your Settlements
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--accent5)', borderColor: 'rgba(84,160,255,0.3)' }}>
            <table>
              <thead><tr><th>From</th><th></th><th>To</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {userSettlements.map((s, i) => renderRow(s, i, true))}
              </tbody>
            </table>
          </div>
          {remainingDiffers && (
            <div style={{
              marginTop: 8, padding: '8px 14px', borderRadius: 10,
              background: Math.abs(userRemainingBalance) < 0.01 ? 'rgba(67,233,123,0.08)' : 'rgba(84,160,255,0.06)',
              border: `1px solid ${Math.abs(userRemainingBalance) < 0.01 ? 'rgba(67,233,123,0.2)' : 'rgba(84,160,255,0.15)'}`,
              fontSize: '0.82rem', fontWeight: 600,
              color: Math.abs(userRemainingBalance) < 0.01 ? 'var(--green)' : 'var(--accent5)',
            }}>
              {Math.abs(userRemainingBalance) < 0.01 ? '\u2714 All settled!' : `Remaining: \u20B1${formatNum(Math.abs(userRemainingBalance))}`}
            </div>
          )}
        </div>
      )}

      {otherSettlements.length > 0 && (
        <div>
          {currentUser && userSettlements.length > 0 && (
            <div style={{
              fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              color: 'var(--text2)', marginBottom: 8, paddingLeft: 2,
            }}>
              Other Settlements
            </div>
          )}
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table>
              <thead><tr><th>From</th><th></th><th>To</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {otherSettlements.map((s, i) => renderRow(s, i, false))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {combinedSettlements.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
          Add expenses and travelers to see settlements.
        </div>
      )}

      {expensesByPair.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            color: 'var(--accent3)', marginBottom: 10, paddingLeft: 2,
          }}>
            Expense Breakdown
          </div>
          {expensesByPair.map((pair, pi) => {
            const fromIsUser = currentUser && pair.from === currentUser;
            const toIsUser = currentUser && pair.to === currentUser;
            const unpaidCount = pair.expenses.filter(e => !paidExpenses[e.id]).length;
            const pairKey = `${pair.from}__${pair.to}`;
            return (
              <div key={pi} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2,
                  color: (fromIsUser || toIsUser) ? 'var(--accent5)' : 'var(--text)',
                  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <span>
                    {pair.from}{fromIsUser ? ' (You)' : ''} &rarr; {pair.to}{toIsUser ? ' (You)' : ''}
                    <span style={{ fontWeight: 500, color: 'var(--text2)', marginLeft: 8 }}>
                      &mdash; &#8369;{formatNum(remainingByPair[pairKey] ?? 0)}
                      {(remainingByPair[pairKey] ?? 0) < pair.expenses.reduce((s, e) => s + e.owedAmount, 0) - 0.01 && (
                        <span style={{ marginLeft: 4 }}>/ &#8369;{formatNum(pair.expenses.reduce((s, e) => s + e.owedAmount, 0))}</span>
                      )}
                    </span>
                  </span>
                  {toIsUser && unpaidCount > 1 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleMarkPairPaid(pair)}
                      style={{
                        background: 'var(--gradient4)', border: 'none', borderRadius: 20,
                        padding: '3px 10px', fontSize: '0.62rem', fontWeight: 700,
                        color: '#1a1a2e', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        letterSpacing: 0.5, textTransform: 'uppercase',
                      }}
                    >Mark All Paid</motion.button>
                  )}
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${(fromIsUser || toIsUser) ? 'rgba(84,160,255,0.3)' : 'var(--border)'}` }}>
                  <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Owed</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
                    <tbody>
                      {pair.expenses.map(exp => {
                        const expPaid = paidExpenses[exp.id];
                        return (
                          <tr key={exp.id} style={{
                            ...((fromIsUser || toIsUser) ? { background: 'rgba(84,160,255,0.05)' } : {}),
                            ...(expPaid ? { opacity: 0.55 } : {}),
                          }}>
                            <td style={{ fontSize: '0.82rem' }}>{exp.date}</td>
                            <td style={{ fontSize: '0.82rem' }}>{exp.description}</td>
                            <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>&#8369;{formatNum(exp.owedAmount)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {expPaid ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    fontSize: '0.68rem', fontWeight: 700, color: 'var(--green)',
                                    background: 'rgba(67,233,123,0.12)', padding: '3px 10px', borderRadius: 20,
                                  }}>&#10003; Paid</span>
                                  {toIsUser && (
                                    <button onClick={() => handleToggleExpense(exp.id, pairKey)} style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      fontSize: '0.65rem', color: 'var(--text2)', textDecoration: 'underline',
                                      fontFamily: 'Inter, sans-serif', padding: 0,
                                    }}>Undo</button>
                                  )}
                                </span>
                              ) : toIsUser ? (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.93 }}
                                  onClick={() => handleToggleExpense(exp.id, pairKey)}
                                  style={{
                                    background: 'var(--gradient4)', border: 'none', borderRadius: 20,
                                    padding: '4px 12px', fontSize: '0.68rem', fontWeight: 700,
                                    color: '#1a1a2e', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                  }}
                                >Confirm Paid</motion.button>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>&mdash;</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {excessByCollector.length > 0 && totalExcess > 0.01 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            color: 'var(--green)', marginBottom: 8, paddingLeft: 2,
          }}>
            DP Excess Returns
          </div>
          <div style={{
            padding: '12px 18px', borderRadius: 12, marginBottom: 14,
            background: 'rgba(67,233,123,0.08)', border: '1px solid rgba(67,233,123,0.2)',
            fontSize: '0.82rem', color: 'var(--text2)', lineHeight: 1.7,
          }}>
            Total collected: &#8369;{formatNum(totalCollected)} &mdash; Hotel cost: &#8369;{formatNum(hotelCost)} &mdash; Excess: <span style={{ fontWeight: 700, color: 'var(--green)' }}>&#8369;{formatNum(totalExcess)}</span>
          </div>
          {excessByCollector.map((e, ci) => (
            <div key={ci} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5,
                color: currentUser && e.collector === currentUser ? 'var(--accent5)' : 'var(--text)',
                marginBottom: 6, paddingLeft: 2,
              }}>
                {e.collector}{currentUser && e.collector === currentUser ? ' (You)' : ''}
                <span style={{ fontWeight: 500, color: 'var(--text2)', marginLeft: 8 }}>
                  &mdash; returns &#8369;{formatNum(e.totalExcess)}
                </span>
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(67,233,123,0.3)' }}>
                <table>
                  <thead><tr><th>Return To</th><th>Collected</th><th>Hotel Share</th><th>Excess</th></tr></thead>
                  <tbody>
                    {e.persons.map((p, pi) => (
                      <tr key={pi} style={{
                        background: currentUser && p.person === currentUser ? 'rgba(84,160,255,0.08)' : undefined,
                      }}>
                        <td style={{ fontWeight: 600, color: currentUser && p.person === currentUser ? 'var(--accent5)' : undefined }}>
                          {p.person}{currentUser && p.person === currentUser ? ' (You)' : ''}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>&#8369;{formatNum(p.collected)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>&#8369;{formatNum(p.hotelShare)}</td>
                        <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.excess > 0 ? 'var(--green)' : 'var(--accent1)' }}>
                          &#8369;{formatNum(p.excess)}
                        </td>
                      </tr>
                    ))}
                    {e.persons.length > 1 && (
                      <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                        <td>Total</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>&#8369;{formatNum(e.totalCollected)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>&#8369;{formatNum(e.totalHotelShare)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: e.totalExcess > 0 ? 'var(--green)' : 'var(--accent1)' }}>
                          &#8369;{formatNum(e.totalExcess)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUser && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1, color: 'var(--accent5)', marginBottom: 16, paddingLeft: 2,
          }}>
            {'\u{1F4B3}'} Your Payment Details
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginBottom: 20
          }}>
            {WALLET_TYPES.map(f => {
              const userQr = getUserQr(currentUser);
              const qrPath = userQr[f.key];
              const qrUrl = resolveQrUrl(qrPath);
              return (
                <div key={f.key} style={{
                  padding: 14, borderRadius: 12,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent5)'; e.currentTarget.style.background = 'rgba(84,160,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, margin: 0 }}>
                      {f.label}
                    </label>
                    {savedInfo[f.key] && infoForm[f.key] === savedInfo[f.key] && (
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: 0.5, color: 'var(--green)', background: 'rgba(0,210,211,0.15)',
                        padding: '2px 8px', borderRadius: 20,
                      }}>{'\u2713'} Added</span>
                    )}
                  </div>
                  <input
                    value={infoForm[f.key] || ''}
                    onChange={e => handleInfoChange(f.key, e.target.value)}
                    placeholder={f.key === 'maribank' ? 'Account number' : '09XXXXXXXXX'}
                    inputMode="numeric"
                    maxLength={f.key === 'maribank' ? 13 : 11}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--surface3)', borderColor: infoErrors[f.key] ? 'var(--accent1)' : 'var(--border)',
                      fontSize: '0.88rem', letterSpacing: '1px',
                    }}
                  />
                  {infoErrors[f.key] && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent1)', marginTop: 6, fontWeight: 500 }}>
                      {'\u26A0'} {infoErrors[f.key]}
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    {qrUrl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{
                          position: 'relative', borderRadius: 10, overflow: 'hidden',
                          border: '1.5px solid var(--accent5)', cursor: 'pointer',
                          background: 'var(--surface3)',
                        }} onClick={() => { setQrWallet(f.key); setQrModal(currentUser); }}>
                          <img
                            src={qrUrl}
                            alt={`${f.label} QR`}
                            style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }}
                          />
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                            padding: '12px 8px 6px', textAlign: 'center',
                            fontSize: '0.65rem', fontWeight: 600, color: 'white',
                            letterSpacing: 0.5, textTransform: 'uppercase',
                          }}>
                            Tap to view
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <label style={{
                            flex: 1, background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 8,
                            padding: '6px 0', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            color: 'var(--accent5)', transition: 'all 0.2s',
                          }}>
                            {uploading === f.key ? <><Spinner size={12} color="var(--accent5)" /> Replacing...</> : <>{'\u{1F504}'} Replace</>}
                            <input key={`r-${f.key}-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrUpload(f.key, e)} style={{ display: 'none' }} disabled={!!uploading} />
                          </label>
                          <button
                            onClick={() => handleRemoveQr(f.key)}
                            style={{
                              flex: 1, background: 'none', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8,
                              padding: '6px 0', fontSize: '0.7rem', fontWeight: 600,
                              cursor: 'pointer', color: 'var(--accent1)', transition: 'all 0.2s',
                            }}
                          >
                            {'\u{1F5D1}'} Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label style={{
                        background: 'var(--surface3)', border: '1.5px dashed var(--border)', borderRadius: 10,
                        padding: '14px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        color: 'var(--text2)', transition: 'all 0.2s',
                      }}>
                        {uploading === f.key ? <><Spinner size={12} color="var(--text2)" /> Uploading...</> : <>{'\u{1F4F7}'} Upload QR</>}
                        <input key={`u-${f.key}-${uploadKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleQrUpload(f.key, e)} style={{ display: 'none' }} disabled={!!uploading} />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <motion.button
            whileHover={infoDirty ? { y: -2, boxShadow: '0 6px 20px rgba(67,233,123,0.3)' } : undefined}
            whileTap={infoDirty ? { y: 0 } : undefined}
            onClick={handleInfoSave}
            disabled={!infoDirty}
            style={{
              background: infoDirty ? 'var(--gradient4)' : 'var(--surface3)',
              color: infoDirty ? '#1a1a2e' : 'var(--text2)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: infoDirty ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
              width: '100%',
              marginBottom: 18,
            }}
          >
            {'\u2713'} Save Payment Details
          </motion.button>
        </div>
      )}
    </Card>

    <Modal open={!!qrModal} onClose={() => setQrModal(null)}>
      {qrModal && (() => {
        const isOwnModal = qrModal === currentUser;
        const info = isOwnModal ? { gcash: infoForm.gcash || '', maya: infoForm.maya || '', maribank: infoForm.maribank || '' } : (paymentInfo[qrModal] || {});
        const qr = getUserQr(qrModal);
        const availableWallets = WALLET_TYPES.filter(w => qr[w.key] || info[w.key]);
        const activeKey = qrWallet && (qr[qrWallet] || info[qrWallet]) ? qrWallet : (availableWallets[0]?.key || null);
        const activeUrl = activeKey && qr[activeKey] ? resolveQrUrl(qr[activeKey]) : null;
        const activeLabel = WALLET_TYPES.find(w => w.key === activeKey)?.label || '';
        const activeNumber = activeKey ? info[activeKey] : null;
        return (
          <>
            <h3 style={{ color: 'var(--accent5)', marginBottom: 16 }}>&#128178; {qrModal}'s Payment Details</h3>
            {availableWallets.length > 0 ? (
              <>
                {availableWallets.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
                    {availableWallets.map(w => (
                      <button
                        key={w.key}
                        onClick={() => setQrWallet(w.key)}
                        style={{
                          padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                          background: activeKey === w.key ? 'var(--gradient1)' : 'var(--surface3)',
                          color: activeKey === w.key ? 'white' : 'var(--text2)',
                          boxShadow: activeKey === w.key ? '0 2px 8px rgba(102,126,234,0.3)' : 'none',
                        }}
                      >
                        {w.icon} {w.label}
                      </button>
                    ))}
                  </div>
                )}
                {availableWallets.length === 1 && (
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                    {availableWallets[0].icon} {availableWallets[0].label}
                  </div>
                )}
                {activeNumber && (
                  <div
                    onClick={() => { navigator.clipboard.writeText(activeNumber).then(() => dispatch(toast(`${activeLabel} number copied!`))).catch(() => {}); }}
                    style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '0.84rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <span><span style={{ color: 'var(--text2)', fontWeight: 600 }}>{activeLabel}:</span> {activeNumber}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent5)', fontWeight: 600 }}>{'\u{1F4CB}'} Copy</span>
                  </div>
                )}
                {activeUrl && (
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={activeUrl}
                      alt={`${qrModal}'s ${activeLabel} QR`}
                      style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 10, border: '1px solid var(--border)' }}
                    />
                  </div>
                )}
                {!activeUrl && !activeNumber && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>No details for {activeLabel}.</div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>No payment details available.</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              {activeUrl && (
                <Btn small variant="primary" onClick={async () => {
                  try {
                    const res = await fetch(activeUrl);
                    const blob = await res.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${qrModal}_${activeLabel}_QR.${blob.type.split('/')[1] || 'jpg'}`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch { dispatch(toast('Download failed.', 'error')); }
                }}>{`\u{2B07}`} Download {activeLabel} QR</Btn>
              )}
              <Btn small variant="ghost" onClick={() => setQrModal(null)}>Close</Btn>
            </div>
          </>
        );
      })()}
    </Modal>
    </>
  );
}
