import { describe, it, expect, beforeEach } from 'vitest';
import tripReducer, {
  setTripField, addTraveler, removeTraveler,
  addExpense, updateExpense, deleteExpense,
  setHotelCost, addHotelPayment, deleteHotelPayment,
  addDpCollections, deleteDpCollection,
  restoreExpense, restoreHotelPayment, restoreDpCollection,
  setQrCode, setPaymentInfo, loadCloudState, clearAll,
  excludeExpense, includeExpense,
  setProofOfPayment, removeProofOfPayment, declineProofOfPayment,
  markSettlementPaid, unmarkSettlementPaid,
  setExpenseLockDate,
} from '../store/tripSlice';

const initialState = () => tripReducer(undefined, { type: '@@INIT' });

describe('tripSlice', () => {
  let state;
  beforeEach(() => { state = initialState(); });

  describe('setTripField', () => {
    it('sets a string field with sanitization', () => {
      state = tripReducer(state, setTripField({ field: 'tripName', value: '  My Trip  ' }));
      expect(state.tripName).toBe('My Trip');
    });

    it('sets a non-string field as-is', () => {
      state = tripReducer(state, setTripField({ field: 'maxTravelers', value: 15 }));
      expect(state.maxTravelers).toBe(15);
    });
  });

  describe('addTraveler', () => {
    it('adds a traveler with name and color', () => {
      state = tripReducer(state, addTraveler('Alice'));
      expect(state.travelers).toHaveLength(1);
      expect(state.travelers[0].name).toBe('Alice');
      expect(state.travelers[0].color).toBeDefined();
    });

    it('prevents duplicate names (case-insensitive)', () => {
      state = tripReducer(state, addTraveler('Alice'));
      state = tripReducer(state, addTraveler('alice'));
      expect(state.travelers).toHaveLength(1);
    });

    it('respects maxTravelers limit', () => {
      state = tripReducer(state, loadCloudState({ maxTravelers: 2 }));
      state = tripReducer(state, addTraveler('Alice'));
      state = tripReducer(state, addTraveler('Bob'));
      state = tripReducer(state, addTraveler('Charlie'));
      expect(state.travelers).toHaveLength(2);
    });

    it('assigns cycling colors', () => {
      state = tripReducer(state, addTraveler('A'));
      state = tripReducer(state, addTraveler('B'));
      expect(state.travelers[0].color).not.toBe(state.travelers[1].color);
    });

    it('sanitizes traveler name', () => {
      state = tripReducer(state, addTraveler('  <b>Alice</b>  '));
      expect(state.travelers[0].name).toBe('bAlice/b');
    });
  });

  describe('removeTraveler', () => {
    beforeEach(() => {
      state = tripReducer(state, addTraveler('Alice'));
      state = tripReducer(state, addTraveler('Bob'));
    });

    it('removes traveler by index', () => {
      state = tripReducer(state, removeTraveler(0));
      expect(state.travelers).toHaveLength(1);
      expect(state.travelers[0].name).toBe('Bob');
    });

    it('removes traveler from expense splits', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Lunch',
        amount: 100, paidBy: 'Bob', payment: 'cash', splitAmong: ['Alice', 'Bob'],
      }));
      state = tripReducer(state, removeTraveler(0));
      expect(state.expenses[0].splitAmong).toEqual(['Bob']);
    });

    it('removes traveler dp collections', () => {
      state = tripReducer(state, addDpCollections([
        { date: '2026-01-01', from: 'Alice', amount: 500, collectedBy: 'Bob' },
      ]));
      state = tripReducer(state, removeTraveler(0));
      expect(state.dpCollections).toHaveLength(0);
    });
  });

  describe('addExpense', () => {
    it('adds expense with generated id and updatedAt', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Dinner',
        amount: 250, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      expect(state.expenses).toHaveLength(1);
      expect(state.expenses[0].id).toBeDefined();
      expect(state.expenses[0].updatedAt).toBeDefined();
      expect(state.expenses[0].amount).toBe(250);
    });

    it('sanitizes description and paidBy', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: '<script>x</script>',
        amount: 100, paidBy: '<b>Alice</b>', payment: 'cash', splitAmong: ['Alice'],
      }));
      expect(state.expenses[0].description).not.toContain('<');
      expect(state.expenses[0].paidBy).not.toContain('<');
    });
  });

  describe('updateExpense', () => {
    it('updates an existing expense by id', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Lunch',
        amount: 100, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      const id = state.expenses[0].id;
      state = tripReducer(state, updateExpense({
        id,
        expense: { date: '2026-01-02', category: 'fuel', description: 'Gas', amount: 200, paidBy: 'Bob', payment: 'card', splitAmong: ['Bob'] },
      }));
      expect(state.expenses[0].description).toBe('Gas');
      expect(state.expenses[0].amount).toBe(200);
      expect(state.expenses[0].id).toBe(id);
    });

    it('does nothing for non-existent id', () => {
      state = tripReducer(state, updateExpense({
        id: 'fake-id',
        expense: { description: 'Ghost', amount: 0, paidBy: 'x', splitAmong: [] },
      }));
      expect(state.expenses).toHaveLength(0);
    });
  });

  describe('deleteExpense', () => {
    it('removes expense and tracks in _deleted', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Lunch',
        amount: 100, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      const id = state.expenses[0].id;
      state = tripReducer(state, deleteExpense(id));
      expect(state.expenses).toHaveLength(0);
      expect(state._deleted).toContain(id);
    });

    it('caps _deleted at 500', () => {
      const deleted = Array.from({ length: 510 }, (_, i) => `id-${i}`);
      state = tripReducer(state, loadCloudState({ _deleted: deleted }));
      state = tripReducer(state, deleteExpense('new-id'));
      expect(state._deleted.length).toBeLessThanOrEqual(501);
    });

    it('does not add duplicate to _deleted', () => {
      state = tripReducer(state, loadCloudState({ _deleted: ['abc'] }));
      state = tripReducer(state, deleteExpense('abc'));
      expect(state._deleted.filter(d => d === 'abc')).toHaveLength(1);
    });
  });

  describe('setHotelCost', () => {
    it('sets all hotel cost fields', () => {
      state = tripReducer(state, setHotelCost({
        costPerHead: 1500, nights: 3, parkingSlots: 2, parkingCost: 200, notes: 'Check-in 2pm',
      }));
      expect(state.hotelCostPerHead).toBe(1500);
      expect(state.hotelNights).toBe(3);
      expect(state.hotelParkingSlots).toBe(2);
      expect(state.hotelParkingCost).toBe(200);
      expect(state.hotelNotes).toBe('Check-in 2pm');
    });
  });

  describe('addHotelPayment', () => {
    it('adds payment with generated id', () => {
      state = tripReducer(state, addHotelPayment({ date: '2026-01-01', amount: 5000, note: 'Partial' }));
      expect(state.hotelPayments).toHaveLength(1);
      expect(state.hotelPayments[0].id).toBeDefined();
      expect(state.hotelPayments[0].amount).toBe(5000);
    });
  });

  describe('deleteHotelPayment', () => {
    it('removes payment and tracks in _deleted', () => {
      state = tripReducer(state, addHotelPayment({ date: '2026-01-01', amount: 5000, note: '' }));
      const id = state.hotelPayments[0].id;
      state = tripReducer(state, deleteHotelPayment(id));
      expect(state.hotelPayments).toHaveLength(0);
      expect(state._deleted).toContain(id);
    });
  });

  describe('addDpCollections', () => {
    it('adds multiple DP collections with ids', () => {
      state = tripReducer(state, addDpCollections([
        { date: '2026-01-01', from: 'Alice', amount: 500, collectedBy: 'Bob' },
        { date: '2026-01-01', from: 'Charlie', amount: 500, collectedBy: 'Bob' },
      ]));
      expect(state.dpCollections).toHaveLength(2);
      expect(state.dpCollections[0].id).toBeDefined();
      expect(state.dpCollections[1].id).toBeDefined();
      expect(state.dpCollections[0].id).not.toBe(state.dpCollections[1].id);
    });

    it('sanitizes collectedBy', () => {
      state = tripReducer(state, addDpCollections([
        { date: '2026-01-01', from: 'Alice', amount: 500, collectedBy: '<script>' },
      ]));
      expect(state.dpCollections[0].collectedBy).not.toContain('<');
    });
  });

  describe('deleteDpCollection', () => {
    it('removes dp collection and tracks in _deleted', () => {
      state = tripReducer(state, addDpCollections([
        { date: '2026-01-01', from: 'Alice', amount: 500, collectedBy: 'Bob' },
      ]));
      const id = state.dpCollections[0].id;
      state = tripReducer(state, deleteDpCollection(id));
      expect(state.dpCollections).toHaveLength(0);
      expect(state._deleted).toContain(id);
    });
  });

  describe('restoreExpense', () => {
    it('restores a deleted expense', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Lunch',
        amount: 100, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      const exp = { ...state.expenses[0] };
      state = tripReducer(state, deleteExpense(exp.id));
      expect(state.expenses).toHaveLength(0);
      state = tripReducer(state, restoreExpense(exp));
      expect(state.expenses).toHaveLength(1);
      expect(state._deleted).not.toContain(exp.id);
    });

    it('does not restore duplicate', () => {
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'Lunch',
        amount: 100, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      const exp = { ...state.expenses[0] };
      state = tripReducer(state, restoreExpense(exp));
      expect(state.expenses).toHaveLength(1);
    });

    it('ignores null/invalid payload', () => {
      state = tripReducer(state, restoreExpense(null));
      expect(state.expenses).toHaveLength(0);
      state = tripReducer(state, restoreExpense({}));
      expect(state.expenses).toHaveLength(0);
    });
  });

  describe('restoreHotelPayment', () => {
    it('restores a deleted hotel payment', () => {
      state = tripReducer(state, addHotelPayment({ date: '2026-01-01', amount: 5000, note: '' }));
      const hp = { ...state.hotelPayments[0] };
      state = tripReducer(state, deleteHotelPayment(hp.id));
      state = tripReducer(state, restoreHotelPayment(hp));
      expect(state.hotelPayments).toHaveLength(1);
      expect(state._deleted).not.toContain(hp.id);
    });
  });

  describe('restoreDpCollection', () => {
    it('restores a deleted dp collection', () => {
      state = tripReducer(state, addDpCollections([
        { date: '2026-01-01', from: 'Alice', amount: 500, collectedBy: 'Bob' },
      ]));
      const dp = { ...state.dpCollections[0] };
      state = tripReducer(state, deleteDpCollection(dp.id));
      state = tripReducer(state, restoreDpCollection(dp));
      expect(state.dpCollections).toHaveLength(1);
      expect(state._deleted).not.toContain(dp.id);
    });
  });

  describe('setQrCode', () => {
    it('sets a simple qr path', () => {
      state = tripReducer(state, setQrCode({ name: 'Alice', path: 'qrcodes/alice.png' }));
      expect(state.qrCodes.Alice).toBe('qrcodes/alice.png');
    });

    it('sets a typed qr path (gcash, maya)', () => {
      state = tripReducer(state, setQrCode({ name: 'Alice', type: 'gcash', path: 'qrcodes/alice_gcash.png' }));
      expect(state.qrCodes.Alice.gcash).toBe('qrcodes/alice_gcash.png');
    });

    it('converts string qrCode to object when adding typed', () => {
      state = tripReducer(state, loadCloudState({ qrCodes: { Alice: 'old.png' } }));
      state = tripReducer(state, setQrCode({ name: 'Alice', type: 'gcash', path: 'new.png' }));
      expect(state.qrCodes.Alice).toEqual({ gcash: 'new.png' });
    });
  });

  describe('setPaymentInfo', () => {
    it('sets payment info for a traveler', () => {
      state = tripReducer(state, setPaymentInfo({ name: 'Alice', info: { gcash: '09123456789' } }));
      expect(state.paymentInfo.Alice).toEqual({ gcash: '09123456789' });
    });
  });

  describe('loadCloudState', () => {
    it('loads valid cloud data', () => {
      state = tripReducer(state, loadCloudState({
        tripName: 'EL Nido',
        tripDestination: 'Palawan',
        tripStart: '2026-03-01',
        tripEnd: '2026-03-05',
        travelers: [{ name: 'Alice', color: '#ff0000' }],
        expenses: [{ id: 'e1', date: '2026-03-01', category: 'meals', description: 'Food', amount: 100, paidBy: 'Alice', splitAmong: ['Alice'] }],
        hotelCostPerHead: 1500,
        hotelNights: 3,
        hotelParkingSlots: 1,
        hotelParkingCost: 200,
        hotelPayments: [{ id: 'hp1', date: '2026-03-01', amount: 5000, note: '' }],
        dpCollections: [{ id: 'dp1', date: '2026-03-01', from: 'Alice', amount: 500, collectedBy: 'Bob' }],
      }));
      expect(state.tripName).toBe('EL Nido');
      expect(state.travelers).toHaveLength(1);
      expect(state.expenses).toHaveLength(1);
      expect(state.hotelCostPerHead).toBe(1500);
      expect(state.hotelNights).toBe(3);
      expect(state.hotelPayments).toHaveLength(1);
      expect(state.dpCollections).toHaveLength(1);
    });

    it('handles missing/invalid fields with defaults', () => {
      state = tripReducer(state, loadCloudState({ tripName: 123, expenses: 'not-array' }));
      expect(state.tripName).toBe('');
      expect(state.expenses).toEqual([]);
    });

    it('filters invalid travelers', () => {
      state = tripReducer(state, loadCloudState({
        travelers: [{ name: 'Alice', color: '#f00' }, null, {}, { name: '' }],
      }));
      expect(state.travelers).toHaveLength(1);
    });

    it('ensures ids on expenses without ids', () => {
      state = tripReducer(state, loadCloudState({
        expenses: [{ date: '2026-01-01', description: 'X', amount: 50, paidBy: 'A', splitAmong: ['A'] }],
      }));
      expect(state.expenses[0].id).toBeDefined();
    });

    it('handles legacy hotelCost field', () => {
      state = tripReducer(state, loadCloudState({
        hotelCost: 6000,
        travelers: [{ name: 'A', color: '#f00' }, { name: 'B', color: '#0f0' }],
      }));
      expect(state.hotelCostPerHead).toBe(3000);
      expect(state.hotelNights).toBe(1);
    });

    it('caps _deleted at 500', () => {
      const deleted = Array.from({ length: 600 }, (_, i) => `d${i}`);
      state = tripReducer(state, loadCloudState({ _deleted: deleted }));
      expect(state._deleted.length).toBe(500);
    });

    it('ignores null/non-object payload', () => {
      const before = { ...state };
      state = tripReducer(state, loadCloudState(null));
      expect(state.tripName).toBe(before.tripName);
      state = tripReducer(state, loadCloudState('string'));
      expect(state.tripName).toBe(before.tripName);
    });

    it('strips hasReceipt and receipt from cloud expenses', () => {
      state = tripReducer(state, loadCloudState({
        expenses: [{ id: 'e1', description: 'X', amount: 50, paidBy: 'A', splitAmong: ['A'], hasReceipt: true, receipt: 'data:...' }],
      }));
      expect(state.expenses[0].hasReceipt).toBeUndefined();
      expect(state.expenses[0].receipt).toBeUndefined();
    });

    it('loads qrCodes and filters falsy entries', () => {
      state = tripReducer(state, loadCloudState({
        qrCodes: { Alice: 'path.png', Bob: null, Charlie: '' },
      }));
      expect(state.qrCodes.Alice).toBe('path.png');
      expect(state.qrCodes.Bob).toBeUndefined();
      expect(state.qrCodes.Charlie).toBeUndefined();
    });

    it('loads paymentInfo', () => {
      state = tripReducer(state, loadCloudState({
        paymentInfo: { Alice: { gcash: '091234' } },
      }));
      expect(state.paymentInfo.Alice.gcash).toBe('091234');
    });
  });

  describe('excludeExpense / includeExpense', () => {
    it('excludes an expense', () => {
      state = tripReducer(state, excludeExpense({ expenseId: 'e1', excludedBy: 'Admin' }));
      expect(state.excludedExpenses.e1).toBeDefined();
      expect(state.excludedExpenses.e1.excludedBy).toBe('Admin');
    });

    it('includes a previously excluded expense', () => {
      state = tripReducer(state, excludeExpense({ expenseId: 'e1', excludedBy: 'Admin' }));
      state = tripReducer(state, includeExpense('e1'));
      expect(state.excludedExpenses.e1).toBeUndefined();
    });

    it('loads excludedExpenses from cloud', () => {
      state = tripReducer(state, loadCloudState({
        excludedExpenses: { e1: { excludedBy: 'Admin', at: '2026-01-01' } },
      }));
      expect(state.excludedExpenses.e1.excludedBy).toBe('Admin');
    });

    it('defaults excludedExpenses to empty object on invalid cloud data', () => {
      state = tripReducer(state, loadCloudState({ excludedExpenses: 'invalid' }));
      expect(state.excludedExpenses).toEqual({});
    });
  });

  describe('setProofOfPayment / removeProofOfPayment', () => {
    it('sets proof of payment for a settlement', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/Alice__Bob.png', uploadedBy: 'Alice' }));
      expect(state.proofOfPayment['Alice__Bob']).toBeDefined();
      expect(state.proofOfPayment['Alice__Bob'].path).toBe('proofs/Alice__Bob.png');
      expect(state.proofOfPayment['Alice__Bob'].uploadedBy).toBe('Alice');
      expect(state.proofOfPayment['Alice__Bob'].at).toBeDefined();
    });

    it('replaces existing proof', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/old.png', uploadedBy: 'Alice' }));
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/new.png', uploadedBy: 'Alice' }));
      expect(state.proofOfPayment['Alice__Bob'].path).toBe('proofs/new.png');
    });

    it('removes proof of payment', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/Alice__Bob.png', uploadedBy: 'Alice' }));
      state = tripReducer(state, removeProofOfPayment('Alice__Bob'));
      expect(state.proofOfPayment['Alice__Bob']).toBeUndefined();
    });

    it('sets status to pending on upload', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/x.png', uploadedBy: 'Alice' }));
      expect(state.proofOfPayment['Alice__Bob'].status).toBe('pending');
    });

    it('sanitizes uploadedBy', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'k', path: 'p', uploadedBy: '<script>x</script>' }));
      expect(state.proofOfPayment.k.uploadedBy).not.toContain('<');
    });

    it('declines proof of payment with reason', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/x.png', uploadedBy: 'Alice' }));
      state = tripReducer(state, declineProofOfPayment({ settlementKey: 'Alice__Bob', declinedBy: 'Bob', reason: 'Wrong amount' }));
      expect(state.proofOfPayment['Alice__Bob'].status).toBe('declined');
      expect(state.proofOfPayment['Alice__Bob'].path).toBeNull();
      expect(state.proofOfPayment['Alice__Bob'].declinedBy).toBe('Bob');
      expect(state.proofOfPayment['Alice__Bob'].declineReason).toBe('Wrong amount');
      expect(state.proofOfPayment['Alice__Bob'].declinedAt).toBeDefined();
    });

    it('sanitizes decline fields', () => {
      state = tripReducer(state, declineProofOfPayment({ settlementKey: 'k', declinedBy: '<b>Bob</b>', reason: '<script>x</script>' }));
      expect(state.proofOfPayment.k.declinedBy).not.toContain('<');
      expect(state.proofOfPayment.k.declineReason).not.toContain('<');
    });

    it('re-upload after decline resets to pending', () => {
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/old.png', uploadedBy: 'Alice' }));
      state = tripReducer(state, declineProofOfPayment({ settlementKey: 'Alice__Bob', declinedBy: 'Bob', reason: 'Blurry' }));
      state = tripReducer(state, setProofOfPayment({ settlementKey: 'Alice__Bob', path: 'proofs/new.png', uploadedBy: 'Alice' }));
      expect(state.proofOfPayment['Alice__Bob'].status).toBe('pending');
      expect(state.proofOfPayment['Alice__Bob'].path).toBe('proofs/new.png');
    });

    it('loads proofOfPayment from cloud', () => {
      state = tripReducer(state, loadCloudState({
        proofOfPayment: { 'Alice__Bob': { path: 'proofs/x.png', uploadedBy: 'Alice', at: '2026-01-01' } },
      }));
      expect(state.proofOfPayment['Alice__Bob'].path).toBe('proofs/x.png');
    });

    it('defaults proofOfPayment to empty object on invalid cloud data', () => {
      state = tripReducer(state, loadCloudState({ proofOfPayment: 'invalid' }));
      expect(state.proofOfPayment).toEqual({});
    });
  });

  describe('markSettlementPaid / unmarkSettlementPaid', () => {
    it('marks a settlement as paid', () => {
      state = tripReducer(state, markSettlementPaid({ key: 'Alice__Bob', confirmedBy: 'Bob', date: '2026-01-15' }));
      expect(state.paidSettlements['Alice__Bob']).toBeDefined();
      expect(state.paidSettlements['Alice__Bob'].confirmedBy).toBe('Bob');
      expect(state.paidSettlements['Alice__Bob'].date).toBe('2026-01-15');
    });

    it('unmarks a settlement', () => {
      state = tripReducer(state, markSettlementPaid({ key: 'Alice__Bob', confirmedBy: 'Bob', date: '2026-01-15' }));
      state = tripReducer(state, unmarkSettlementPaid('Alice__Bob'));
      expect(state.paidSettlements['Alice__Bob']).toBeUndefined();
    });
  });

  describe('setExpenseLockDate', () => {
    it('sets an expense lock date', () => {
      state = tripReducer(state, setExpenseLockDate('2026-03-01T00:00:00.000Z'));
      expect(state.expenseLockDate).toBe('2026-03-01T00:00:00.000Z');
    });

    it('clears expense lock date with null', () => {
      state = tripReducer(state, setExpenseLockDate('2026-03-01T00:00:00.000Z'));
      state = tripReducer(state, setExpenseLockDate(null));
      expect(state.expenseLockDate).toBeNull();
    });

    it('clears expense lock date with empty string', () => {
      state = tripReducer(state, setExpenseLockDate('2026-03-01T00:00:00.000Z'));
      state = tripReducer(state, setExpenseLockDate(''));
      expect(state.expenseLockDate).toBeNull();
    });

    it('loads expenseLockDate from cloud', () => {
      state = tripReducer(state, loadCloudState({ expenseLockDate: '2026-03-01T12:00:00.000Z' }));
      expect(state.expenseLockDate).toBe('2026-03-01T12:00:00.000Z');
    });

    it('defaults expenseLockDate to null on invalid cloud data', () => {
      state = tripReducer(state, loadCloudState({ expenseLockDate: 123 }));
      expect(state.expenseLockDate).toBeNull();
    });

    it('resets expenseLockDate on clearAll', () => {
      state = tripReducer(state, setExpenseLockDate('2026-03-01T00:00:00.000Z'));
      state = tripReducer(state, clearAll());
      expect(state.expenseLockDate).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('resets to default state', () => {
      state = tripReducer(state, addTraveler('Alice'));
      state = tripReducer(state, addExpense({
        date: '2026-01-01', category: 'meals', description: 'X',
        amount: 100, paidBy: 'Alice', payment: 'cash', splitAmong: ['Alice'],
      }));
      state = tripReducer(state, clearAll());
      expect(state.travelers).toHaveLength(0);
      expect(state.expenses).toHaveLength(0);
      expect(state.tripName).toBe('');
      expect(state.hotelCostPerHead).toBe(0);
    });
  });
});
