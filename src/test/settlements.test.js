import { describe, it, expect } from 'vitest';
import { computeBalances, computeSettlements } from '../utils/settlements';

const travelers = [
  { name: 'Alice', color: '#ff0000' },
  { name: 'Bob', color: '#00ff00' },
  { name: 'Charlie', color: '#0000ff' },
];

describe('computeBalances', () => {
  it('returns zero balances when no expenses', () => {
    const { balances } = computeBalances([], travelers);
    balances.forEach(b => {
      expect(b.paid).toBe(0);
      expect(b.share).toBe(0);
      expect(b.balance).toBe(0);
    });
  });

  it('calculates correct paid and share for a single expense split equally', () => {
    const expenses = [{ amount: 300, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] }];
    const { personPaid, personShare, balances } = computeBalances(expenses, travelers);
    expect(personPaid['Alice']).toBe(300);
    expect(personPaid['Bob']).toBe(0);
    expect(personShare['Alice']).toBe(100);
    expect(personShare['Bob']).toBe(100);
    expect(personShare['Charlie']).toBe(100);
    const alice = balances.find(b => b.name === 'Alice');
    expect(alice.balance).toBe(200);
  });

  it('handles partial splits correctly', () => {
    const expenses = [{ amount: 200, paidBy: 'Bob', splitAmong: ['Alice', 'Bob'] }];
    const { balances } = computeBalances(expenses, travelers);
    const bob = balances.find(b => b.name === 'Bob');
    const alice = balances.find(b => b.name === 'Alice');
    expect(bob.balance).toBe(100);
    expect(alice.balance).toBe(-100);
  });

  it('ignores unknown payers', () => {
    const expenses = [{ amount: 100, paidBy: 'Unknown', splitAmong: ['Alice'] }];
    const { personPaid } = computeBalances(expenses, travelers);
    expect(personPaid['Alice']).toBe(0);
  });

  it('handles multiple expenses from multiple payers', () => {
    const expenses = [
      { amount: 300, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] },
      { amount: 150, paidBy: 'Bob', splitAmong: ['Alice', 'Bob', 'Charlie'] },
    ];
    const { personPaid, balances } = computeBalances(expenses, travelers);
    expect(personPaid['Alice']).toBe(300);
    expect(personPaid['Bob']).toBe(150);
    expect(personPaid['Charlie']).toBe(0);
    const totalPaid = balances.reduce((s, b) => s + b.paid, 0);
    expect(totalPaid).toBe(450);
  });

  it('handles single-person split', () => {
    const expenses = [{ amount: 100, paidBy: 'Alice', splitAmong: ['Alice'] }];
    const { balances } = computeBalances(expenses, travelers);
    const alice = balances.find(b => b.name === 'Alice');
    expect(alice.balance).toBe(0);
  });

  it('rounds shares to 2 decimal places', () => {
    const expenses = [{ amount: 100, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] }];
    const { personShare } = computeBalances(expenses, travelers);
    Object.values(personShare).forEach(v => {
      const decimals = v.toString().split('.')[1];
      if (decimals) expect(decimals.length).toBeLessThanOrEqual(2);
    });
  });

  it('returns one balance entry per traveler', () => {
    const { balances } = computeBalances([], travelers);
    expect(balances).toHaveLength(3);
    expect(balances.map(b => b.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('excludes paid expenses from balance calculation', () => {
    const expenses = [
      { id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] },
      { id: 'e2', amount: 150, paidBy: 'Bob', splitAmong: ['Alice', 'Bob', 'Charlie'] },
    ];
    const paidExpenses = { e1: { confirmedBy: 'Alice', date: '2025-01-01' } };
    const { personPaid, balances } = computeBalances(expenses, travelers, paidExpenses);
    expect(personPaid['Alice']).toBe(0);
    expect(personPaid['Bob']).toBe(150);
    const bob = balances.find(b => b.name === 'Bob');
    expect(bob.balance).toBe(100);
  });

  it('returns zero balances when all expenses are paid', () => {
    const expenses = [
      { id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] },
    ];
    const paidExpenses = { e1: { confirmedBy: 'Bob', date: '2025-01-01' } };
    const { balances } = computeBalances(expenses, travelers, paidExpenses);
    balances.forEach(b => {
      expect(b.paid).toBe(0);
      expect(b.share).toBe(0);
      expect(b.balance).toBe(0);
    });
  });

  it('works the same as before when paidExpenses is not provided', () => {
    const expenses = [{ id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice', 'Bob', 'Charlie'] }];
    const withoutPaid = computeBalances(expenses, travelers);
    const withEmptyPaid = computeBalances(expenses, travelers, {});
    expect(withoutPaid.balances).toEqual(withEmptyPaid.balances);
  });

  it('does not change split when numberOfCars is 0', () => {
    const expenses = [{ id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice'], category: 'fuel' }];
    const { personShare } = computeBalances(expenses, travelers, null, 0);
    expect(personShare['Alice']).toBe(300);
    expect(personShare['Bob']).toBe(0);
    expect(personShare['Charlie']).toBe(0);
  });

  it('splits car expenses among all travelers when numberOfCars > 0', () => {
    const expenses = [{ id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice'], category: 'fuel' }];
    const { personShare } = computeBalances(expenses, travelers, null, 2);
    expect(personShare['Alice']).toBe(100);
    expect(personShare['Bob']).toBe(100);
    expect(personShare['Charlie']).toBe(100);
  });

  it('applies car pooling to parking and toll categories', () => {
    const expenses = [
      { id: 'e1', amount: 150, paidBy: 'Alice', splitAmong: ['Alice'], category: 'parking' },
      { id: 'e2', amount: 300, paidBy: 'Bob', splitAmong: ['Bob'], category: 'toll' },
    ];
    const { personShare } = computeBalances(expenses, travelers, null, 1);
    expect(personShare['Alice']).toBe(150);
    expect(personShare['Bob']).toBe(150);
    expect(personShare['Charlie']).toBe(150);
  });

  it('does not apply car pooling to non-car categories', () => {
    const expenses = [
      { id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice'], category: 'fuel' },
      { id: 'e2', amount: 600, paidBy: 'Bob', splitAmong: ['Alice', 'Bob'], category: 'meals' },
    ];
    const { personShare } = computeBalances(expenses, travelers, null, 2);
    // fuel: 300 / 3 = 100 each
    expect(personShare['Alice']).toBe(100 + 300); // fuel share + meals share
    expect(personShare['Bob']).toBe(100 + 300);   // fuel share + meals share
    expect(personShare['Charlie']).toBe(100);       // fuel share only
  });

  it('credits the payer correctly with car pooling', () => {
    const expenses = [{ id: 'e1', amount: 300, paidBy: 'Alice', splitAmong: ['Alice'], category: 'toll' }];
    const { personPaid, balances } = computeBalances(expenses, travelers, null, 1);
    expect(personPaid['Alice']).toBe(300);
    expect(personPaid['Bob']).toBe(0);
    // Alice paid 300, share 100 → balance +200
    const aliceBalance = balances.find(b => b.name === 'Alice');
    expect(aliceBalance.balance).toBe(200);
  });

});

describe('computeSettlements', () => {
  it('returns empty when all balanced', () => {
    const balances = travelers.map(t => ({ name: t.name, balance: 0 }));
    expect(computeSettlements(balances)).toEqual([]);
  });

  it('computes correct settlement for simple case', () => {
    const balances = [
      { name: 'Alice', balance: 200 },
      { name: 'Bob', balance: -100 },
      { name: 'Charlie', balance: -100 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements.length).toBe(2);
    const total = settlements.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeCloseTo(200);
    settlements.forEach(s => expect(s.to).toBe('Alice'));
  });

  it('minimizes number of transactions', () => {
    const balances = [
      { name: 'Alice', balance: 300 },
      { name: 'Bob', balance: -150 },
      { name: 'Charlie', balance: -150 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements.length).toBe(2);
  });

  it('handles single debtor and creditor', () => {
    const balances = [
      { name: 'Alice', balance: 500 },
      { name: 'Bob', balance: -500 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: 'Bob', to: 'Alice', amount: 500 });
  });

  it('handles near-zero balances (rounding)', () => {
    const balances = [
      { name: 'Alice', balance: 0.005 },
      { name: 'Bob', balance: -0.005 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(computeSettlements([])).toEqual([]);
  });

  it('settlement amounts sum to total debt', () => {
    const balances = [
      { name: 'Alice', balance: 400 },
      { name: 'Bob', balance: -200 },
      { name: 'Charlie', balance: -200 },
    ];
    const settlements = computeSettlements(balances);
    const totalSettled = settlements.reduce((s, x) => s + x.amount, 0);
    const totalDebt = balances.filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);
    expect(totalSettled).toBeCloseTo(totalDebt);
  });

  it('handles multiple creditors', () => {
    const balances = [
      { name: 'Alice', balance: 200 },
      { name: 'Bob', balance: 100 },
      { name: 'Charlie', balance: -300 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements.length).toBe(2);
    const charliePays = settlements.filter(s => s.from === 'Charlie');
    expect(charliePays).toHaveLength(2);
    const totalPaid = charliePays.reduce((s, x) => s + x.amount, 0);
    expect(totalPaid).toBeCloseTo(300);
  });
});
