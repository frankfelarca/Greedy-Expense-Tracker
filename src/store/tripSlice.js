import { createSlice } from '@reduxjs/toolkit';
import { sanitize } from '../utils/helpers';
import { COLORS } from '../utils/constants';

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const defaultState = {
  tripName: '',
  tripDestination: '',
  tripStart: '',
  tripEnd: '',
  travelers: [],
  expenses: [],
  hotelCostPerHead: 0,
  hotelNights: 0,
  hotelParkingSlots: 0,
  hotelParkingCost: 0,
  hotelNotes: '',
  hotelPayments: [],
  dpCollections: [],
  qrCodes: {},
  paymentInfo: {},
  paidSettlements: {},
  paidExpenses: {},
  proofOfPayment: {},
  partialPayments: {},
  numberOfCars: 0,
  expenseLockDate: null,
  _deleted: [],
  maxTravelers: 10,
};

function ensureIds(arr) {
  return arr.map(item => item.id ? item : { ...item, id: uid() });
}

const tripSlice = createSlice({
  name: 'trip',
  initialState: { ...defaultState },
  reducers: {
    setTripField(state, action) {
      const { field, value } = action.payload;
      state[field] = typeof value === 'string' ? sanitize(value) : value;
    },
    addTraveler(state, action) {
      if (state.travelers.length >= (state.maxTravelers || 10)) return;
      const name = sanitize(action.payload);
      if (state.travelers.some(t => t.name.toLowerCase() === name.toLowerCase())) return;
      state.travelers.push({ name, color: COLORS[state.travelers.length % COLORS.length] });
    },
    removeTraveler(state, action) {
      const name = state.travelers[action.payload].name;
      state.expenses = state.expenses.map(exp => ({
        ...exp,
        splitAmong: exp.splitAmong.filter(n => n !== name),
      }));
      state.dpCollections = state.dpCollections.filter(d => d.from !== name);
      state.travelers.splice(action.payload, 1);
    },
    addExpense(state, action) {
      const e = action.payload;
      state.expenses.push({
        ...e,
        description: sanitize(e.description),
        refCode: sanitize(e.refCode || ''),
        paidBy: sanitize(e.paidBy),
        loggedBy: sanitize(e.loggedBy || ''),
        id: uid(), updatedAt: now(),
      });
    },
    updateExpense(state, action) {
      const { id, expense } = action.payload;
      const idx = state.expenses.findIndex(e => e.id === id);
      if (idx >= 0) state.expenses[idx] = {
        ...expense,
        description: sanitize(expense.description),
        refCode: sanitize(expense.refCode || ''),
        paidBy: sanitize(expense.paidBy),
        loggedBy: sanitize(expense.loggedBy || ''),
        id, updatedAt: now(),
      };
    },
    deleteExpense(state, action) {
      if (!state._deleted.includes(action.payload)) state._deleted.push(action.payload);
      if (state._deleted.length > 500) state._deleted = state._deleted.slice(-500);
      state.expenses = state.expenses.filter(e => e.id !== action.payload);
    },
    setHotelCost(state, action) {
      state.hotelCostPerHead = action.payload.costPerHead;
      state.hotelNights = action.payload.nights;
      state.hotelParkingSlots = action.payload.parkingSlots;
      state.hotelParkingCost = action.payload.parkingCost;
      state.hotelNotes = action.payload.notes;
    },
    addHotelPayment(state, action) {
      state.hotelPayments.push({ ...action.payload, id: uid(), updatedAt: now() });
    },
    deleteHotelPayment(state, action) {
      if (!state._deleted.includes(action.payload)) state._deleted.push(action.payload);
      if (state._deleted.length > 500) state._deleted = state._deleted.slice(-500);
      state.hotelPayments = state.hotelPayments.filter(p => p.id !== action.payload);
    },
    addDpCollections(state, action) {
      const ts = now();
      action.payload.forEach(item => state.dpCollections.push({ ...item, collectedBy: sanitize(item.collectedBy || ''), id: uid(), updatedAt: ts }));
    },
    deleteDpCollection(state, action) {
      if (!state._deleted.includes(action.payload)) state._deleted.push(action.payload);
      if (state._deleted.length > 500) state._deleted = state._deleted.slice(-500);
      state.dpCollections = state.dpCollections.filter(d => d.id !== action.payload);
    },
    restoreExpense(state, action) {
      const exp = action.payload;
      if (exp && exp.id && !state.expenses.some(e => e.id === exp.id)) {
        state.expenses.push(exp);
        state._deleted = state._deleted.filter(d => d !== exp.id);
      }
    },
    restoreHotelPayment(state, action) {
      const p = action.payload;
      if (p && p.id && !state.hotelPayments.some(hp => hp.id === p.id)) {
        state.hotelPayments.push(p);
        state._deleted = state._deleted.filter(d => d !== p.id);
      }
    },
    restoreDpCollection(state, action) {
      const d = action.payload;
      if (d && d.id && !state.dpCollections.some(dc => dc.id === d.id)) {
        state.dpCollections.push(d);
        state._deleted = state._deleted.filter(dd => dd !== d.id);
      }
    },
    setQrCode(state, action) {
      const { name, type, path } = action.payload;
      if (!state.qrCodes) state.qrCodes = {};
      if (type) {
        if (typeof state.qrCodes[name] === 'string') state.qrCodes[name] = {};
        if (!state.qrCodes[name]) state.qrCodes[name] = {};
        state.qrCodes[name][type] = path || '';
      } else {
        state.qrCodes[name] = path || '';
      }
    },
    setPaymentInfo(state, action) {
      const { name, info } = action.payload;
      if (!state.paymentInfo) state.paymentInfo = {};
      state.paymentInfo[name] = info;
    },
    markSettlementPaid(state, action) {
      const { key, confirmedBy, date } = action.payload;
      if (!state.paidSettlements) state.paidSettlements = {};
      state.paidSettlements[key] = { confirmedBy: sanitize(confirmedBy), date, at: now() };
    },
    unmarkSettlementPaid(state, action) {
      if (state.paidSettlements) delete state.paidSettlements[action.payload];
    },
    markExpensePaid(state, action) {
      const { expenseId, confirmedBy, date } = action.payload;
      if (!state.paidExpenses) state.paidExpenses = {};
      state.paidExpenses[expenseId] = { confirmedBy: sanitize(confirmedBy), date, at: now() };
    },
    unmarkExpensePaid(state, action) {
      if (state.paidExpenses) delete state.paidExpenses[action.payload];
    },
    setProofOfPayment(state, action) {
      const { settlementKey, path, uploadedBy } = action.payload;
      if (!state.proofOfPayment) state.proofOfPayment = {};
      state.proofOfPayment[settlementKey] = { path, uploadedBy: sanitize(uploadedBy), at: now(), status: 'pending' };
    },
    removeProofOfPayment(state, action) {
      if (state.proofOfPayment) delete state.proofOfPayment[action.payload];
    },
    setExpenseLockDate(state, action) {
      state.expenseLockDate = action.payload || null;
    },
    declineProofOfPayment(state, action) {
      const { settlementKey, declinedBy, reason, amountReceived } = action.payload;
      if (!state.proofOfPayment) state.proofOfPayment = {};
      const existing = state.proofOfPayment[settlementKey];
      state.proofOfPayment[settlementKey] = {
        ...(existing || {}),
        path: null,
        status: 'declined',
        declinedBy: sanitize(declinedBy),
        declineReason: sanitize(reason || ''),
        declinedAt: now(),
        amountReceived: amountReceived > 0 ? amountReceived : undefined,
      };
      if (amountReceived > 0) {
        if (!state.partialPayments) state.partialPayments = {};
        state.partialPayments[settlementKey] = (state.partialPayments[settlementKey] || 0) + amountReceived;
      }
    },
    loadCloudState(state, action) {
      const cloud = action.payload;
      if (!cloud || typeof cloud !== 'object') return;

      const safeArray = (val) => Array.isArray(val) ? val : [];
      const safeNum = (val, fallback) => { const n = Number(val); return isNaN(n) ? fallback : n; };
      const safeStr = (val, fallback) => typeof val === 'string' ? val : fallback;

      const cloudExpenses = ensureIds(safeArray(cloud.expenses).map(e => {
        if (!e || typeof e !== 'object') return null;
        const { hasReceipt, receipt, ...rest } = e;
        return { ...rest, amount: safeNum(rest.amount, 0), splitAmong: safeArray(rest.splitAmong), receiptPath: rest.receiptPath || null };
      }).filter(Boolean));
      const cloudHotelPayments = ensureIds(safeArray(cloud.hotelPayments).filter(p => p && typeof p === 'object'));
      const cloudDpCollections = ensureIds(safeArray(cloud.dpCollections).filter(d => d && typeof d === 'object'));

      state.tripName = safeStr(cloud.tripName, defaultState.tripName);
      state.tripDestination = safeStr(cloud.tripDestination, defaultState.tripDestination);
      state.tripStart = safeStr(cloud.tripStart, defaultState.tripStart);
      state.tripEnd = safeStr(cloud.tripEnd, defaultState.tripEnd);
      state.travelers = safeArray(cloud.travelers).filter(t => t && typeof t === 'object' && t.name);
      if (cloud.hotelCost !== undefined && cloud.hotelCostPerHead === undefined) {
        const travelers = cloud.travelers || [];
        state.hotelCostPerHead = travelers.length > 0 ? cloud.hotelCost / travelers.length : cloud.hotelCost;
        state.hotelNights = 1;
        state.hotelParkingSlots = 0;
        state.hotelParkingCost = 0;
      } else {
        state.hotelCostPerHead = safeNum(cloud.hotelCostPerHead, defaultState.hotelCostPerHead);
        state.hotelNights = safeNum(cloud.hotelNights, defaultState.hotelNights);
        state.hotelParkingSlots = safeNum(cloud.hotelParkingSlots, defaultState.hotelParkingSlots);
        state.hotelParkingCost = safeNum(cloud.hotelParkingCost, defaultState.hotelParkingCost);
      }
      state.hotelNotes = safeStr(cloud.hotelNotes, defaultState.hotelNotes);

      state.expenses = cloudExpenses;
      state.hotelPayments = cloudHotelPayments;
      state.dpCollections = cloudDpCollections;
      const cloudQr = (cloud.qrCodes && typeof cloud.qrCodes === 'object') ? cloud.qrCodes : {};
      Object.keys(cloudQr).forEach(k => { if (!cloudQr[k]) delete cloudQr[k]; });
      state.qrCodes = cloudQr;
      state.paymentInfo = (cloud.paymentInfo && typeof cloud.paymentInfo === 'object') ? cloud.paymentInfo : {};
      state.paidSettlements = (cloud.paidSettlements && typeof cloud.paidSettlements === 'object') ? cloud.paidSettlements : {};
      state.paidExpenses = (cloud.paidExpenses && typeof cloud.paidExpenses === 'object') ? cloud.paidExpenses : {};
      state.proofOfPayment = (cloud.proofOfPayment && typeof cloud.proofOfPayment === 'object') ? cloud.proofOfPayment : {};
      state.partialPayments = (cloud.partialPayments && typeof cloud.partialPayments === 'object') ? cloud.partialPayments : {};
      state._deleted = safeArray(cloud._deleted).slice(-500);
      state.maxTravelers = safeNum(cloud.maxTravelers, defaultState.maxTravelers);
      state.numberOfCars = safeNum(cloud.numberOfCars, defaultState.numberOfCars);
      state.expenseLockDate = safeStr(cloud.expenseLockDate, defaultState.expenseLockDate);
    },
    clearAll() {
      return { ...defaultState };
    },
  },
});

export const {
  setTripField, addTraveler, removeTraveler,
  addExpense, updateExpense, deleteExpense,
  setHotelCost, addHotelPayment, deleteHotelPayment,
  addDpCollections, deleteDpCollection,
  restoreExpense, restoreHotelPayment, restoreDpCollection,
  setQrCode, setPaymentInfo,
  markSettlementPaid, unmarkSettlementPaid, markExpensePaid, unmarkExpensePaid,
  setProofOfPayment, removeProofOfPayment, declineProofOfPayment,
  setExpenseLockDate,
  loadCloudState, clearAll,
} = tripSlice.actions;

export default tripSlice.reducer;
