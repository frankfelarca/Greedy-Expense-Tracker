import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { setHotelCost, addHotelPayment, deleteHotelPayment, addDpCollections, deleteDpCollection, restoreHotelPayment, restoreDpCollection } from '../store/tripSlice';
import { toast } from '../store/toastSlice';
import { formatNum, todayStr } from '../utils/helpers';
import { useAdmin } from '../hooks/useAdmin';
import { Card, CardTitle, Btn, FormGroup, StatCard, Modal } from './UI';

const EMPTY_ARR = [];

export default function FundsTab() {
  const dispatch = useDispatch();
  const travelers = useSelector(s => s.trip.travelers);
  const hotelCostPerHead = useSelector(s => s.trip.hotelCostPerHead);
  const hotelNights = useSelector(s => s.trip.hotelNights);
  const hotelParkingSlots = useSelector(s => s.trip.hotelParkingSlots);
  const hotelParkingCost = useSelector(s => s.trip.hotelParkingCost);
  const hotelNotes = useSelector(s => s.trip.hotelNotes);
  const hotelPaymentsRaw = useSelector(s => s.trip.hotelPayments);
  const dpCollectionsRaw = useSelector(s => s.trip.dpCollections);
  const hotelPayments = hotelPaymentsRaw || EMPTY_ARR;
  const dpCollections = dpCollectionsRaw || EMPTY_ARR;
  const hotelRoomTotal = hotelCostPerHead * travelers.length * hotelNights;
  const hotelParkingTotal = hotelParkingSlots * hotelParkingCost * hotelNights;
  const hotelCost = hotelRoomTotal + hotelParkingTotal;
  const { isAdmin, requireAdmin } = useAdmin();

  const [hotelModal, setHotelModal] = useState(false);
  const [hotelPayModal, setHotelPayModal] = useState(false);
  const [dpModal, setDpModal] = useState(false);
  const [hotelForm, setHotelForm] = useState({ costPerHead: '', nights: '', parkingSlots: '', parkingCost: '', notes: '' });
  const [hpForm, setHpForm] = useState({ date: todayStr(), amount: '', note: '' });
  const [dpForm, setDpForm] = useState({ date: todayStr(), amount: '', note: '', selected: [], collectedBy: '', customName: '' });
  const [selectedDp, setSelectedDp] = useState([]);
  const deletedRef = useRef({});

  const handleUndo = useCallback((e) => {
    const { undoId } = e.detail;
    const item = deletedRef.current[undoId];
    if (!item) return;
    if (item._type === 'hp') { dispatch(restoreHotelPayment(item.data)); dispatch(toast('Hotel payment restored.')); }
    if (item._type === 'dp') { dispatch(restoreDpCollection(item.data)); dispatch(toast('DP collection restored.')); }
    delete deletedRef.current[undoId];
  }, [dispatch]);

  useEffect(() => {
    window.addEventListener('undo-delete', handleUndo);
    return () => window.removeEventListener('undo-delete', handleUndo);
  }, [handleUndo]);

  const [hotelErrors, setHotelErrors] = useState({});
  const [hpErrors, setHpErrors] = useState({});
  const [dpErrors, setDpErrors] = useState({});

  const totalCollected = useMemo(() => dpCollections.reduce((s, d) => s + d.amount, 0), [dpCollections]);
  const totalPaidHotel = useMemo(() => hotelPayments.reduce((s, p) => s + p.amount, 0), [hotelPayments]);
  const hotelBalance = hotelCost - totalPaidHotel;
  const cashOnHand = totalCollected - totalPaidHotel;
  const perPersonTarget = travelers.length > 0 ? hotelCost / travelers.length : 0;

  const dpByPerson = useMemo(() => {
    const map = {};
    travelers.forEach(t => { map[t.name] = 0; });
    dpCollections.forEach(d => { if (map[d.from] !== undefined) map[d.from] += d.amount; });
    return map;
  }, [travelers, dpCollections]);

  const openHotelEdit = () => {
    requireAdmin(() => {
      setHotelForm({ costPerHead: hotelCostPerHead.toString(), nights: hotelNights.toString(), parkingSlots: hotelParkingSlots.toString(), parkingCost: hotelParkingCost.toString(), notes: hotelNotes });
      setHotelModal(true);
    });
  };

  const saveHotel = () => {
    const costPerHead = parseFloat(hotelForm.costPerHead);
    const nights = parseInt(hotelForm.nights, 10);
    const parkingSlots = parseInt(hotelForm.parkingSlots, 10) || 0;
    const parkingCost = parseFloat(hotelForm.parkingCost) || 0;
    const errs = {};
    if (isNaN(costPerHead) || costPerHead < 0 || !hotelForm.costPerHead) errs.costPerHead = 'Enter a valid amount';
    if (isNaN(nights) || nights < 1 || !hotelForm.nights) errs.nights = 'Must be at least 1';
    if (parkingSlots < 0) errs.parkingSlots = 'Cannot be negative';
    if (parkingSlots > 0 && parkingCost <= 0) errs.parkingCost = 'Enter parking cost';
    setHotelErrors(errs);
    if (Object.keys(errs).length > 0) { dispatch(toast('Please fix the errors.', 'error')); return; }
    dispatch(setHotelCost({ costPerHead, nights, parkingSlots, parkingCost, notes: hotelForm.notes }));
    setHotelModal(false);
    setHotelErrors({});
    dispatch(toast('Hotel cost updated!'));
  };

  const openHotelPay = () => {
    requireAdmin(() => {
      setHpForm({ date: todayStr(), amount: '', note: '' });
      setHotelPayModal(true);
    });
  };

  const saveHotelPay = () => {
    const amount = parseFloat(hpForm.amount);
    const errs = {};
    if (!hpForm.date) errs.date = true;
    if (isNaN(amount) || amount <= 0 || !hpForm.amount) errs.amount = 'Must be greater than 0';
    setHpErrors(errs);
    if (Object.keys(errs).length > 0) { dispatch(toast('Please fix the errors.', 'error')); return; }
    dispatch(addHotelPayment({ date: hpForm.date, amount, note: hpForm.note }));
    setHotelPayModal(false);
    setHpErrors({});
    dispatch(toast('Hotel payment added!'));
  };

  const handleDeleteHP = (id) => {
    requireAdmin(() => {
      if (!confirm('Delete this hotel payment?')) return;
      const hp = hotelPayments.find(p => p.id === id);
      const undoId = crypto.randomUUID();
      if (hp) deletedRef.current[undoId] = { _type: 'hp', data: hp };
      dispatch(deleteHotelPayment(id));
      dispatch(toast('Hotel payment deleted.', 'success', undoId));
    });
  };

  const openDp = () => {
    requireAdmin(() => {
      if (travelers.length === 0) { dispatch(toast('Add travelers first.', 'error')); return; }
      setDpForm({ date: todayStr(), amount: '', note: '', selected: [], collectedBy: '', customName: '' });
      setDpModal(true);
    });
  };

  const toggleDpSelect = (name) => {
    setDpForm(prev => ({
      ...prev,
      selected: prev.selected.includes(name) ? prev.selected.filter(n => n !== name) : [...prev.selected, name],
    }));
  };

  const saveDp = () => {
    const amount = parseFloat(dpForm.amount);
    const custom = dpForm.customName.trim();
    const allSelected = custom ? [...dpForm.selected, custom] : dpForm.selected;
    const errs = {};
    if (allSelected.length === 0) errs.selected = true;
    if (!dpForm.date) errs.date = true;
    if (isNaN(amount) || amount <= 0 || !dpForm.amount) errs.amount = 'Must be greater than 0';
    if (!dpForm.collectedBy && !custom) errs.collectedBy = true;
    setDpErrors(errs);
    if (Object.keys(errs).length > 0) { dispatch(toast('Please fix the errors.', 'error')); return; }
    const items = allSelected.map(name => ({ date: dpForm.date, from: name, amount, note: dpForm.note, collectedBy: dpForm.collectedBy || custom }));
    dispatch(addDpCollections(items));
    setDpModal(false);
    setDpErrors({});
    dispatch(toast(`DP collected from ${allSelected.length} person(s)!`));
  };

  const handleDeleteDP = (id) => {
    requireAdmin(() => {
      if (!confirm('Delete this DP collection?')) return;
      const dp = dpCollections.find(d => d.id === id);
      const undoId = crypto.randomUUID();
      if (dp) deletedRef.current[undoId] = { _type: 'dp', data: dp };
      dispatch(deleteDpCollection(id));
      dispatch(toast('DP collection deleted.', 'success', undoId));
      setSelectedDp(prev => prev.filter(s => s !== id));
    });
  };

  const toggleDpLogSelect = (id) => {
    setSelectedDp(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleDpLogSelectAll = () => {
    const allIds = dpCollections.map(d => d.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedDp.includes(id));
    setSelectedDp(allSelected ? [] : allIds);
  };

  const handleDeleteSelectedDp = () => {
    requireAdmin(() => {
      if (selectedDp.length === 0) { dispatch(toast('No items selected.', 'error')); return; }
      if (!confirm(`Delete ${selectedDp.length} collection(s)?`)) return;
      selectedDp.forEach(id => dispatch(deleteDpCollection(id)));
      dispatch(toast(`${selectedDp.length} collection(s) deleted.`));
      setSelectedDp([]);
    });
  };

  const allDpSelected = dpCollections.length > 0 && dpCollections.every(d => selectedDp.includes(d.id));

  return (
    <>
      <Card>
        <CardTitle icon="&#128176;" gradient="var(--gradient5)">Fund Overview</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <StatCard label="Total Collected" value={`₱${formatNum(totalCollected)}`} color="var(--green)" />
          <StatCard label="Hotel Cost" value={`₱${formatNum(hotelCost)}`} color="var(--accent1)" />
          <StatCard label="Paid to Hotel" value={`₱${formatNum(totalPaidHotel)}`} color="var(--accent4)" />
          <StatCard label="Hotel Balance" value={`₱${formatNum(hotelBalance)}`} color={hotelBalance > 0 ? 'var(--accent1)' : 'var(--green)'} />
          <StatCard label="Cash on Hand" value={`₱${formatNum(cashOnHand)}`} color={cashOnHand >= 0 ? 'var(--green)' : 'var(--accent1)'} />
          <StatCard label="Share/Person" value={`₱${formatNum(perPersonTarget)}`} color="var(--accent3)" />
        </div>
      </Card>

      <Card>
        <CardTitle icon="&#127976;" gradient="var(--gradient1)"
          extra={isAdmin && <Btn small variant="primary" onClick={openHotelEdit}>&#9998; Edit</Btn>}
        >
          Hotel Cost
        </CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Nightly Rate/Head</div><div style={{ fontSize: '1.1rem', fontWeight: 700 }}>&#8369;{formatNum(hotelCostPerHead)}</div></div>
          <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Nights</div><div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{hotelNights}</div></div>
          <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Room Total</div><div style={{ fontSize: '1.1rem', fontWeight: 700 }}>&#8369;{formatNum(hotelRoomTotal)}</div></div>
          {hotelParkingSlots > 0 && <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Parking ({hotelParkingSlots} slot{hotelParkingSlots !== 1 ? 's' : ''})</div><div style={{ fontSize: '1.1rem', fontWeight: 700 }}>&#8369;{formatNum(hotelParkingTotal)}</div></div>}
          <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Cost</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent1)' }}>&#8369;{formatNum(hotelCost)}</div></div>
          <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Balance</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: hotelBalance > 0 ? 'var(--accent1)' : 'var(--green)' }}>&#8369;{formatNum(hotelBalance)}</div></div>
          {hotelNotes && <div><div style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Notes</div><div style={{ color: 'var(--text2)' }}>{hotelNotes}</div></div>}
        </div>

        <CardTitle icon="&#128181;" gradient="var(--gradient4)"
          extra={isAdmin && <Btn small variant="success" onClick={openHotelPay}>+ Add Payment</Btn>}
        >
          Payments to Hotel
        </CardTitle>
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table>
            <thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Note</th>{isAdmin && <th className="no-print">Actions</th>}</tr></thead>
            <tbody>
              {hotelPayments.map((p, i) => (
                <tr key={p.id || i}><td>{i+1}</td><td>{p.date}</td><td style={{ fontWeight: 700 }}>₱{formatNum(p.amount)}</td><td>{p.note || '-'}</td>
                  {isAdmin && <td className="no-print"><Btn small variant="danger" onClick={() => handleDeleteHP(p.id)}>&#128465;</Btn></td>}</tr>
              ))}
            </tbody>
          </table>
          {hotelPayments.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>No payments yet.</div>}
        </div>
      </Card>

      <Card>
        <CardTitle icon="&#128178;" gradient="var(--gradient2)"
          extra={isAdmin && <Btn small variant="success" onClick={openDp}>+ Collect DP</Btn>}
        >
          DP Collection from Travelers
        </CardTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {travelers.map(t => {
            const paid = dpByPerson[t.name] || 0;
            const diff = paid - perPersonTarget;
            return (
              <motion.div key={t.name} whileHover={{ scale: 1.03 }} style={{
                background: 'var(--surface2)', borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid var(--border)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: t.color, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>₱{formatNum(paid)}</div>
                <div style={{ fontSize: '0.73rem', color: diff >= 0 ? 'var(--green)' : 'var(--accent1)', marginTop: 4 }}>
                  {diff >= 0 ? '+' : ''}₱{formatNum(diff)} vs share
                </div>
              </motion.div>
            );
          })}
        </div>

        <CardTitle icon="&#128203;" gradient="var(--gradient3)"
          extra={isAdmin && selectedDp.length > 0 && <Btn small variant="danger" onClick={handleDeleteSelectedDp}>&#128465; Delete ({selectedDp.length})</Btn>}
        >
          Collection Log
        </CardTitle>
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table>
            <thead><tr>
              {isAdmin && <th className="no-print" style={{ width: 36 }}><input type="checkbox" checked={allDpSelected} onChange={toggleDpLogSelectAll} style={{ width: 16, height: 16, cursor: 'pointer' }} /></th>}
              <th>#</th><th>Date</th><th>From</th><th>Amount</th><th>Collected By</th><th>Note</th>{isAdmin && <th className="no-print">Actions</th>}
            </tr></thead>
            <tbody>
              {dpCollections.map((d, i) => (
                <tr key={d.id || i} style={{ background: selectedDp.includes(d.id) ? 'rgba(255,107,107,0.08)' : undefined }}>
                  {isAdmin && <td className="no-print"><input type="checkbox" checked={selectedDp.includes(d.id)} onChange={() => toggleDpLogSelect(d.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>}
                  <td>{i+1}</td><td>{d.date}</td><td>{d.from}</td><td style={{ fontWeight: 700 }}>₱{formatNum(d.amount)}</td><td>{d.collectedBy || '-'}</td><td>{d.note || '-'}</td>
                  {isAdmin && <td className="no-print"><Btn small variant="danger" onClick={() => handleDeleteDP(d.id)}>&#128465;</Btn></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {dpCollections.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>No DP collections yet.</div>}
        </div>
      </Card>

      <Modal open={hotelModal} onClose={() => setHotelModal(false)}>
        <h3 style={{ color: 'var(--accent5)', marginBottom: 16 }}>&#127976; Edit Hotel Cost</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormGroup label="Nightly Rate/Head (&#8369;)" required error={hotelErrors.costPerHead}>
            <input type="number" value={hotelForm.costPerHead} onChange={e => { setHotelForm({ ...hotelForm, costPerHead: e.target.value }); setHotelErrors(p => ({ ...p, costPerHead: undefined })); }} min="0" step="0.01" />
          </FormGroup>
          <FormGroup label="Nights" required error={hotelErrors.nights}>
            <input type="number" value={hotelForm.nights} onChange={e => { setHotelForm({ ...hotelForm, nights: e.target.value }); setHotelErrors(p => ({ ...p, nights: undefined })); }} min="1" step="1" />
          </FormGroup>
          <FormGroup label="Parking Slots" error={hotelErrors.parkingSlots}>
            <input type="number" value={hotelForm.parkingSlots} onChange={e => { setHotelForm({ ...hotelForm, parkingSlots: e.target.value }); setHotelErrors(p => ({ ...p, parkingSlots: undefined })); }} min="0" step="1" />
          </FormGroup>
          <FormGroup label="Parking Cost/Night (&#8369;)" error={hotelErrors.parkingCost}>
            <input type="number" value={hotelForm.parkingCost} onChange={e => { setHotelForm({ ...hotelForm, parkingCost: e.target.value }); setHotelErrors(p => ({ ...p, parkingCost: undefined })); }} min="0" step="0.01" />
          </FormGroup>
        </div>
        {hotelForm.costPerHead && hotelForm.nights && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(67,233,123,0.08)', border: '1px solid rgba(67,233,123,0.2)', fontSize: '0.82rem', color: 'var(--text2)' }}>
            Room: &#8369;{formatNum((parseFloat(hotelForm.costPerHead) || 0) * travelers.length * (parseInt(hotelForm.nights, 10) || 0))}
            {parseInt(hotelForm.parkingSlots, 10) > 0 && <> + Parking: &#8369;{formatNum((parseInt(hotelForm.parkingSlots, 10) || 0) * (parseFloat(hotelForm.parkingCost) || 0) * (parseInt(hotelForm.nights, 10) || 0))}</>}
            {' = '}<span style={{ fontWeight: 700, color: 'var(--green)' }}>&#8369;{formatNum(
              ((parseFloat(hotelForm.costPerHead) || 0) * travelers.length * (parseInt(hotelForm.nights, 10) || 0)) +
              ((parseInt(hotelForm.parkingSlots, 10) || 0) * (parseFloat(hotelForm.parkingCost) || 0) * (parseInt(hotelForm.nights, 10) || 0))
            )}</span>
          </div>
        )}
        <FormGroup label="Notes">
          <input value={hotelForm.notes} onChange={e => setHotelForm({ ...hotelForm, notes: e.target.value })} placeholder="e.g. Check-in 2pm, checkout 12nn" style={{ marginTop: 6 }} />
        </FormGroup>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="success" onClick={saveHotel}>&#10003; Save</Btn>
          <Btn small variant="ghost" onClick={() => setHotelModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      <Modal open={hotelPayModal} onClose={() => setHotelPayModal(false)}>
        <h3 style={{ color: 'var(--accent5)', marginBottom: 16 }}>&#128181; Add Hotel Payment</h3>
        <FormGroup label="Date" required error={hpErrors.date}><input type="date" value={hpForm.date} onChange={e => { setHpForm({ ...hpForm, date: e.target.value }); setHpErrors(p => ({ ...p, date: undefined })); }} /></FormGroup>
        <FormGroup label="Amount (₱)" required error={hpErrors.amount}><input type="number" value={hpForm.amount} onChange={e => { setHpForm({ ...hpForm, amount: e.target.value }); setHpErrors(p => ({ ...p, amount: undefined })); }} min="0" step="0.01" style={{ marginTop: 6 }} /></FormGroup>
        <FormGroup label="Note"><input value={hpForm.note} onChange={e => setHpForm({ ...hpForm, note: e.target.value })} placeholder="Optional" style={{ marginTop: 6 }} /></FormGroup>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="success" onClick={saveHotelPay}>&#10003; Add</Btn>
          <Btn small variant="ghost" onClick={() => setHotelPayModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      <Modal open={dpModal} onClose={() => setDpModal(false)}>
        <h3 style={{ color: 'var(--accent5)', marginBottom: 16 }}>&#128178; Collect DP</h3>
        <FormGroup label="Select Travelers" required error={dpErrors.selected && 'Select at least one traveler'}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, marginTop: 6 }}>
            <Btn small variant="info" onClick={() => setDpForm(prev => ({ ...prev, selected: travelers.map(t => t.name) }))}>Select All</Btn>
            <Btn small variant="ghost" onClick={() => setDpForm(prev => ({ ...prev, selected: [] }))}>Deselect</Btn>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {travelers.map(t => (
              <label key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: dpForm.selected.includes(t.name) ? 'rgba(84,160,255,0.15)' : 'var(--surface2)',
                border: `1px solid ${dpForm.selected.includes(t.name) ? 'var(--accent5)' : 'var(--border)'}`,
                borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: '0.84rem', transition: 'all 0.2s',
              }}>
                <input type="checkbox" checked={dpForm.selected.includes(t.name)} onChange={() => toggleDpSelect(t.name)} style={{ width: 16, height: 16 }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                {t.name}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <input value={dpForm.customName} onChange={e => { setDpForm({ ...dpForm, customName: e.target.value }); setDpErrors(p => ({ ...p, selected: undefined })); }} placeholder="Or enter a name not in the list" style={{ fontSize: '0.84rem' }} />
          </div>
        </FormGroup>
        <FormGroup label="Date" required error={dpErrors.date}><input type="date" value={dpForm.date} onChange={e => { setDpForm({ ...dpForm, date: e.target.value }); setDpErrors(p => ({ ...p, date: undefined })); }} style={{ marginTop: 6 }} /></FormGroup>
        <FormGroup label="Amount per person (₱)" required error={dpErrors.amount}><input type="number" value={dpForm.amount} onChange={e => { setDpForm({ ...dpForm, amount: e.target.value }); setDpErrors(p => ({ ...p, amount: undefined })); }} min="0" step="0.01" style={{ marginTop: 6 }} /></FormGroup>
        <FormGroup label="Collected By" required error={dpErrors.collectedBy && 'Select who collected'}>
          <select value={dpForm.collectedBy} onChange={e => { setDpForm({ ...dpForm, collectedBy: e.target.value }); setDpErrors(p => ({ ...p, collectedBy: undefined })); }} style={{ marginTop: 6 }}>
            <option value="">Select collector...</option>
            {travelers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Note"><input value={dpForm.note} onChange={e => setDpForm({ ...dpForm, note: e.target.value })} placeholder="e.g. Downpayment" style={{ marginTop: 6 }} /></FormGroup>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn variant="success" onClick={saveDp}>&#10003; Collect</Btn>
          <Btn small variant="ghost" onClick={() => setDpModal(false)}>Cancel</Btn>
        </div>
      </Modal>
    </>
  );
}
