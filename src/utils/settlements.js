const CAR_CATEGORIES = ['parking', 'toll', 'fuel'];

export function computeBalances(expenses, travelers, paidExpenses, numberOfCars) {
  const personPaid = {};
  const personShare = {};
  travelers.forEach(t => { personPaid[t.name] = 0; personShare[t.name] = 0; });
  const allNames = travelers.map(t => t.name);
  expenses.forEach(exp => {
    const isPaid = paidExpenses && paidExpenses[exp.id];
    if (!isPaid) {
      if (personPaid[exp.paidBy] !== undefined) personPaid[exp.paidBy] += exp.amount;
      const isCarExpense = numberOfCars > 0 && CAR_CATEGORIES.includes(exp.category);
      const splitList = isCarExpense ? allNames : exp.splitAmong;
      const share = Math.round((exp.amount / splitList.length) * 100) / 100;
      splitList.forEach(name => {
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
