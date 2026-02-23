export function computeBalances(expenses, travelers, paidExpenses, excludedExpenses) {
  const personPaid = {};
  const personShare = {};
  travelers.forEach(t => { personPaid[t.name] = 0; personShare[t.name] = 0; });
  expenses.forEach(exp => {
    const isPaid = paidExpenses && paidExpenses[exp.id];
    const isExcluded = excludedExpenses && excludedExpenses[exp.id];
    if (!isPaid && !isExcluded) {
      if (personPaid[exp.paidBy] !== undefined) personPaid[exp.paidBy] += exp.amount;
      const share = Math.round((exp.amount / exp.splitAmong.length) * 100) / 100;
      exp.splitAmong.forEach(name => {
        if (personShare[name] !== undefined) personShare[name] += share;
      });
    }
  });
  const balances = travelers.map(t => ({
    name: t.name,
    paid: personPaid[t.name] || 0,
    share: personShare[t.name] || 0,
    balance: (personPaid[t.name] || 0) - (personShare[t.name] || 0),
  }));
  return { personPaid, personShare, balances };
}

export function computeSettlements(balances) {
  const debtors = balances
    .filter(b => b.balance < -0.01)
    .map(b => ({ name: b.name, balance: -b.balance }))
    .sort((a, b) => b.balance - a.balance);
  const creditors = balances
    .filter(b => b.balance > 0.01)
    .map(b => ({ name: b.name, balance: b.balance }))
    .sort((a, b) => b.balance - a.balance);

  const settlements = [];
  const d = debtors.map(x => ({ ...x }));
  const c = creditors.map(x => ({ ...x }));
  let di = 0, ci = 0;
  while (di < d.length && ci < c.length) {
    const amount = Math.min(d[di].balance, c[ci].balance);
    if (amount > 0.01) settlements.push({ from: d[di].name, to: c[ci].name, amount });
    d[di].balance -= amount;
    c[ci].balance -= amount;
    if (d[di].balance < 0.01) di++;
    if (c[ci].balance < 0.01) ci++;
  }
  return settlements;
}
