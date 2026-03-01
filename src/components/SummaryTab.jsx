import { useMemo } from 'react';
import { useSelector } from 'react-redux';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { CAT_LABELS, CAT_ICONS } from '../utils/constants';
import { formatNum } from '../utils/helpers';
import { computeBalances, computeSettlements } from '../utils/settlements';
import { Card, CardTitle } from './UI';
import { exportPdf } from '../utils/exportPdf';

const catColors = { hotel: '#f87171', meals: '#fbbf24', alcohol: '#f472b6', fuel: '#38bdf8', toll: '#a78bfa', parking: '#a78bfa', entrance: '#818cf8', others: '#94a3b8' };
const CAR_CATEGORIES = ['parking', 'toll', 'fuel'];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function SummaryTab({ currentUser }) {
  const expenses = useSelector(s => s.trip.expenses);
  const travelers = useSelector(s => s.trip.travelers);
  const trip = useSelector(s => ({
    tripName: s.trip.tripName,
    tripDestination: s.trip.tripDestination,
    tripStart: s.trip.tripStart,
    tripEnd: s.trip.tripEnd,
  }));
  const paidExpenses = useSelector(s => s.trip.paidExpenses);
  const paidSettlements = useSelector(s => s.trip.paidSettlements);
  const numberOfCars = useSelector(s => s.trip.numberOfCars) || 0;

  const { personPaid, personShare, balances: balanceRanking } = useMemo(
    () => computeBalances(expenses, travelers, null, numberOfCars), [expenses, travelers, numberOfCars]
  );

  const settlements = useMemo(
    () => computeSettlements(balanceRanking), [balanceRanking]
  );

  const { total, count, travelerCount, catTotals, maxCat, perPerson,
    topCategory: _topCategory, topSpenders, leastSpenders,
    mostOwesAll, mostOwesVal, mostOwedAll, mostOwedVal,
    mostTransactionsAll: _mostTransactionsAll, mostTxVal: _mostTxVal, leastTransactionsAll, leastTxVal,
    mostCreditorsAll, mostCreditorsVal, owesToMostAll, owesToMostVal,
    topPersonalAll, topPersonalVal,
    highestShareAll, highestShareVal, lowestShareAll, lowestShareVal,
    mostTreatedAll, mostTreatedVal, mostGenerousAll, mostGenerousVal,
    mostExpensiveDay, alcoholKingAll, alcoholKingVal, foodieAll, foodieVal,
    biggestTreat, freqPairAll: _freqPairAll, freqPairVal: _freqPairVal,
    biggestExpense, smallestExpense, avgExpense: _avgExpense, joinNames } = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const count = expenses.length;
    const travelerCount = travelers.length;

    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const maxCat = Math.max(...Object.values(catTotals), 1);

    const shareValues = Object.values(personShare);
    const perPerson = shareValues.length > 0 ? shareValues.reduce((a, b) => a + b, 0) / shareValues.length : 0;

    const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const paidRanking = travelers.map(t => ({ name: t.name, paid: personPaid[t.name] || 0 })).sort((a, b) => b.paid - a.paid);
    const topSpenderVal = paidRanking[0]?.paid;
    const topSpenders = paidRanking.filter(p => p.paid === topSpenderVal && p.paid > 0);
    const leastSpenderVal = paidRanking.length > 1 ? paidRanking[paidRanking.length - 1]?.paid : null;
    const leastSpenders = leastSpenderVal !== null ? paidRanking.filter(p => p.paid === leastSpenderVal) : [];

    const owesSorted = balanceRanking.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
    const mostOwesVal = owesSorted[0]?.balance;
    const mostOwesAll = owesSorted.filter(b => Math.abs(b.balance - mostOwesVal) < 0.01);
    const owedSorted = balanceRanking.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const mostOwedVal = owedSorted[0]?.balance;
    const mostOwedAll = owedSorted.filter(b => Math.abs(b.balance - mostOwedVal) < 0.01);

    const expPerPerson = {};
    travelers.forEach(t => { expPerPerson[t.name] = 0; });
    expenses.forEach(e => { if (expPerPerson[e.paidBy] !== undefined) expPerPerson[e.paidBy] += 1; });
    const txRanking = Object.entries(expPerPerson).sort((a, b) => b[1] - a[1]);
    const mostTxVal = txRanking[0]?.[1];
    const mostTransactionsAll = txRanking.filter(t => t[1] === mostTxVal && t[1] > 0);
    const leastTxVal = txRanking.length > 1 ? txRanking[txRanking.length - 1]?.[1] : null;
    const leastTransactionsAll = leastTxVal !== null ? txRanking.filter(t => t[1] === leastTxVal) : [];

    const owedByCount = {};
    const owesToCount = {};
    travelers.forEach(t => { owedByCount[t.name] = 0; owesToCount[t.name] = 0; });
    settlements.forEach(s => {
      owedByCount[s.to] = (owedByCount[s.to] || 0) + 1;
      owesToCount[s.from] = (owesToCount[s.from] || 0) + 1;
    });
    const owedByRanking = Object.entries(owedByCount).sort((a, b) => b[1] - a[1]);
    const mostCreditorsVal = owedByRanking[0]?.[1];
    const mostCreditorsAll = owedByRanking.filter(e => e[1] === mostCreditorsVal && e[1] > 0);
    const owesToRanking = Object.entries(owesToCount).sort((a, b) => b[1] - a[1]);
    const owesToMostVal = owesToRanking[0]?.[1];
    const owesToMostAll = owesToRanking.filter(e => e[1] === owesToMostVal && e[1] > 0);

    const personalSpending = {};
    travelers.forEach(t => { personalSpending[t.name] = 0; });
    expenses.forEach(e => {
      if (e.splitAmong.length === 1 && e.splitAmong[0] === e.paidBy && personalSpending[e.paidBy] !== undefined) {
        personalSpending[e.paidBy] += e.amount;
      }
    });
    const personalRanking = Object.entries(personalSpending).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const topPersonalVal = personalRanking[0]?.[1];
    const topPersonalAll = personalRanking.filter(([, v]) => Math.abs(v - topPersonalVal) < 0.01);

    const shareRanking = travelers.map(t => ({ name: t.name, share: personShare[t.name] || 0 })).sort((a, b) => b.share - a.share);
    const highestShareVal = shareRanking[0]?.share;
    const highestShareAll = shareRanking.filter(s => Math.abs(s.share - highestShareVal) < 0.01 && s.share > 0);
    const lowestShareVal = shareRanking.length > 1 ? shareRanking[shareRanking.length - 1]?.share : null;
    const lowestShareAll = lowestShareVal !== null ? shareRanking.filter(s => Math.abs(s.share - lowestShareVal) < 0.01) : [];

    const treatedAmounts = {};
    travelers.forEach(t => { treatedAmounts[t.name] = 0; });
    expenses.forEach(e => {
      const share = Math.round((e.amount / e.splitAmong.length) * 100) / 100;
      e.splitAmong.forEach(name => {
        if (name !== e.paidBy && treatedAmounts[name] !== undefined) treatedAmounts[name] += share;
      });
    });
    const treatedRanking = Object.entries(treatedAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const mostTreatedVal = treatedRanking[0]?.[1];
    const mostTreatedAll = treatedRanking.filter(([, v]) => Math.abs(v - mostTreatedVal) < 0.01);

    const generousAmounts = {};
    travelers.forEach(t => { generousAmounts[t.name] = 0; });
    expenses.forEach(e => {
      const share = Math.round((e.amount / e.splitAmong.length) * 100) / 100;
      const othersCount = e.splitAmong.filter(n => n !== e.paidBy).length;
      if (othersCount > 0 && generousAmounts[e.paidBy] !== undefined) generousAmounts[e.paidBy] += share * othersCount;
    });
    const generousRanking = Object.entries(generousAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const mostGenerousVal = generousRanking[0]?.[1];
    const mostGenerousAll = generousRanking.filter(([, v]) => Math.abs(v - mostGenerousVal) < 0.01);

    const dayTotals = {};
    expenses.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount; });
    const dayRanking = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
    const mostExpensiveDay = dayRanking[0] || null;

    const alcoholByPerson = {};
    const mealsByPerson = {};
    travelers.forEach(t => { alcoholByPerson[t.name] = 0; mealsByPerson[t.name] = 0; });
    expenses.forEach(e => {
      if (e.category === 'alcohol' && alcoholByPerson[e.paidBy] !== undefined) alcoholByPerson[e.paidBy] += e.amount;
      if (e.category === 'meals' && mealsByPerson[e.paidBy] !== undefined) mealsByPerson[e.paidBy] += e.amount;
    });
    const alcoholRanking = Object.entries(alcoholByPerson).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const alcoholKingVal = alcoholRanking[0]?.[1];
    const alcoholKingAll = alcoholRanking.filter(([, v]) => Math.abs(v - alcoholKingVal) < 0.01);
    const mealsRanking = Object.entries(mealsByPerson).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const foodieVal = mealsRanking[0]?.[1];
    const foodieAll = mealsRanking.filter(([, v]) => Math.abs(v - foodieVal) < 0.01);

    const biggestTreat = expenses.filter(e => !e.splitAmong.includes(e.paidBy) && e.splitAmong.length > 0)
      .sort((a, b) => b.amount - a.amount)[0] || null;

    const pairCounts = {};
    expenses.forEach(e => {
      const names = [...e.splitAmong].sort();
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const pk = names[i] + ' & ' + names[j];
          pairCounts[pk] = (pairCounts[pk] || 0) + 1;
        }
      }
    });
    const pairRanking = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]);
    const freqPairVal = pairRanking[0]?.[1];
    const freqPairAll = pairRanking.filter(([, v]) => v === freqPairVal);

    const biggestExpense = expenses.length > 0 ? expenses.reduce((a, b) => a.amount > b.amount ? a : b) : null;
    const smallestExpense = expenses.length > 0 ? expenses.reduce((a, b) => a.amount < b.amount ? a : b) : null;
    const avgExpense = count > 0 ? total / count : 0;
    const joinNames = (arr) => arr.map(x => x.name || x[0] || x).join(', ');

    return { total, count, travelerCount, catTotals, maxCat, perPerson,
      topCategory, topSpenders, leastSpenders,
      mostOwesAll, mostOwesVal, mostOwedAll, mostOwedVal,
      mostTransactionsAll, mostTxVal, leastTransactionsAll, leastTxVal,
      mostCreditorsAll, mostCreditorsVal, owesToMostAll, owesToMostVal,
      topPersonalAll, topPersonalVal,
      highestShareAll, highestShareVal, lowestShareAll, lowestShareVal,
      mostTreatedAll, mostTreatedVal, mostGenerousAll, mostGenerousVal,
      mostExpensiveDay, alcoholKingAll, alcoholKingVal, foodieAll, foodieVal,
      biggestTreat, freqPairAll, freqPairVal,
      biggestExpense, smallestExpense, avgExpense, joinNames };
  }, [expenses, travelers, personPaid, personShare, balanceRanking, settlements]);

  const stats = [
    { label: 'Total Spent', value: `\u20B1${formatNum(total)}`, icon: '\u{1F4B0}', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { label: 'Transactions', value: count, icon: '\u{1F4CB}', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { label: 'Travelers', value: travelerCount, icon: '\u{1F465}', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { label: 'Avg Per Person', value: `\u20B1${formatNum(perPerson)}`, icon: '\u{1F4CA}', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  ];

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible">
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          {stats.map(s => (
            <motion.div
              key={s.label}
              whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
              style={{
                background: 'var(--surface)', borderRadius: 14, padding: '18px 16px',
                border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: s.gradient,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: s.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0,
                }}>
                  {s.icon}
                </span>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: 1 }}>{s.value}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {count > 0 && (
          <motion.button
            variants={fadeUp}
            whileHover={{ scale: 1.01, boxShadow: '0 4px 16px rgba(102,126,234,0.25)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => exportPdf({ trip, expenses, travelers, paidExpenses, paidSettlements, numberOfCars })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 12, marginBottom: 16, marginTop: -8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Inter, sans-serif',
              color: '#fff', letterSpacing: 0.3,
            }}
          >
            {'\u{1F4C4}'} Export PDF
          </motion.button>
        )}

        {/* Car Expenses */}
        {(() => {
          const carExpenses = expenses.filter(e => CAR_CATEGORIES.includes(e.category));
          const carTotal = carExpenses.reduce((s, e) => s + e.amount, 0);
          const carByCategory = {};
          carExpenses.forEach(e => { carByCategory[e.category] = (carByCategory[e.category] || 0) + e.amount; });
          const showCard = numberOfCars > 0 && carTotal > 0;
          return (
            <motion.div variants={fadeUp}>
              {numberOfCars > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                  padding: '8px 14px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: '0.78rem', color: 'var(--text2)',
                }}>
                  {'\u{1F697}'} {numberOfCars} car{numberOfCars !== 1 ? 's' : ''} &mdash; parking, toll &amp; fuel split among all travelers
                </div>
              )}
              {showCard && (
                <Card>
                  <CardTitle icon={'\u{1F697}'} gradient="var(--gradient-primary)">Car Expenses</CardTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Total</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 2 }}>{'\u20B1'}{formatNum(carTotal)}</div>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Per Car</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 2, color: 'var(--accent3)' }}>{'\u20B1'}{formatNum(carTotal / numberOfCars)}</div>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Per Person</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 2, color: 'var(--accent5)' }}>{'\u20B1'}{formatNum(travelerCount > 0 ? carTotal / travelerCount : 0)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {CAR_CATEGORIES.map(cat => {
                      const amt = carByCategory[cat] || 0;
                      if (amt <= 0) return null;
                      const color = catColors[cat] || 'var(--accent5)';
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.9rem' }}>{CAT_ICONS[cat]}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{CAT_LABELS[cat]}</span>
                          </div>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{'\u20B1'}{formatNum(amt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </motion.div>
          );
        })()}

        <Card>
          <CardTitle icon="&#128100;" gradient="var(--gradient-primary)">Per Person</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {[...travelers].sort((a, b) => a.name === currentUser ? -1 : b.name === currentUser ? 1 : 0).map(t => {
              const paid = personPaid[t.name] || 0;
              const share = personShare[t.name] || 0;
              const balance = paid - share;
              const isMe = currentUser && t.name === currentUser;
              const paidPct = total > 0 ? (paid / total) * 100 : 0;
              return (
                <motion.div
                  key={t.name}
                  variants={fadeUp}
                  whileHover={{ y: -2 }}
                  style={{
                    background: isMe ? 'rgba(129,140,248,0.06)' : 'var(--surface2)',
                    borderRadius: 14, padding: 18,
                    border: `1.5px solid ${isMe ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`,
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {isMe && (
                    <div style={{
                      position: 'absolute', top: 8, right: 12,
                      fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                      color: 'var(--accent5)', opacity: 0.8,
                    }}>
                      You
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                    }}>
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>
                        {paidPct.toFixed(1)}% of group total
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      background: 'var(--surface3)', borderRadius: 8, padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Paid</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 2 }}>&#8369;{formatNum(paid)}</div>
                    </div>
                    <div style={{
                      background: 'var(--surface3)', borderRadius: 8, padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Share</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 2, color: 'var(--accent3)' }}>&#8369;{formatNum(share)}</div>
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: balance >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)' }}>
                      {balance >= 0 ? 'Overpaid' : 'Owes'}
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: balance >= 0 ? 'var(--green)' : 'var(--accent1)' }}>
                      {balance >= 0 ? '+' : ''}&#8369;{formatNum(balance)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {count > 0 && (
          <motion.div variants={fadeUp}>
            <Card>
              <CardTitle icon="&#127942;" gradient="var(--gradient-success)">Fun Stats</CardTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {[
                  topSpenders.length > 0 && {
                    icon: '\u{1F451}', label: 'Top Spender', value: joinNames(topSpenders),
                    sub: `\u20B1${formatNum(topSpenders[0].paid)} paid`,
                    bg: 'rgba(67,233,123,0.08)', border: 'rgba(67,233,123,0.2)', color: 'var(--green)',
                  },
                  highestShareAll.length > 0 && {
                    icon: '\u{1F4C8}', label: 'Highest Share', value: joinNames(highestShareAll),
                    sub: `\u20B1${formatNum(highestShareVal)} total share`,
                    bg: 'rgba(72,219,251,0.08)', border: 'rgba(72,219,251,0.2)', color: 'var(--accent3)',
                  },
                  lowestShareAll.length > 0 && {
                    icon: '\u{1F4C9}', label: 'Lowest Share', value: joinNames(lowestShareAll),
                    sub: `\u20B1${formatNum(lowestShareVal)} total share`,
                    bg: 'rgba(136,136,170,0.08)', border: 'rgba(136,136,170,0.2)', color: 'var(--text2)',
                  },
                  leastSpenders.length > 0 && {
                    icon: '\u{1F4B8}', label: 'Least Spender', value: joinNames(leastSpenders),
                    sub: `\u20B1${formatNum(leastSpenders[0].paid)} paid`,
                    bg: 'rgba(255,159,243,0.08)', border: 'rgba(255,159,243,0.2)', color: 'var(--accent4)',
                  },
                  mostOwesAll.length > 0 && {
                    icon: '\u{1F4A9}', label: 'Most Broke', value: joinNames(mostOwesAll),
                    sub: `owes \u20B1${formatNum(-mostOwesVal)}`,
                    bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)', color: 'var(--accent1)',
                  },
                  mostOwedAll.length > 0 && {
                    icon: '\u{1F911}', label: 'Most Owed', value: joinNames(mostOwedAll),
                    sub: `owed \u20B1${formatNum(mostOwedVal)}`,
                    bg: 'rgba(72,219,251,0.08)', border: 'rgba(72,219,251,0.2)', color: 'var(--accent3)',
                  },
                  mostCreditorsAll.length > 0 && {
                    icon: '\u{1F934}', label: 'Most Creditors', value: joinNames(mostCreditorsAll),
                    sub: `${mostCreditorsVal} ${mostCreditorsVal === 1 ? 'person owes' : 'people owe'} them`,
                    bg: 'rgba(95,39,205,0.08)', border: 'rgba(95,39,205,0.2)', color: 'var(--accent6)',
                  },
                  owesToMostAll.length > 0 && {
                    icon: '\u{1F647}', label: 'Owes The Most People', value: joinNames(owesToMostAll),
                    sub: `owes ${owesToMostVal} ${owesToMostVal === 1 ? 'person' : 'people'}`,
                    bg: 'rgba(240,147,251,0.08)', border: 'rgba(240,147,251,0.2)', color: '#f093fb',
                  },
                  leastTransactionsAll.length > 0 && {
                    icon: '\u{1F6CB}', label: 'Least Active', value: joinNames(leastTransactionsAll),
                    sub: `${leastTxVal} transaction${leastTxVal !== 1 ? 's' : ''} logged`,
                    bg: 'rgba(136,136,170,0.08)', border: 'rgba(136,136,170,0.2)', color: 'var(--text2)',
                  },
                  biggestExpense && {
                    icon: '\u{1F4B0}', label: 'Biggest Expense', value: biggestExpense.description,
                    sub: `\u20B1${formatNum(biggestExpense.amount)} by ${biggestExpense.paidBy}`,
                    bg: 'rgba(102,126,234,0.08)', border: 'rgba(102,126,234,0.2)', color: '#667eea',
                  },
                  smallestExpense && {
                    icon: '\u{1F4B2}', label: 'Smallest Expense', value: smallestExpense.description,
                    sub: `\u20B1${formatNum(smallestExpense.amount)} by ${smallestExpense.paidBy}`,
                    bg: 'rgba(161,140,209,0.08)', border: 'rgba(161,140,209,0.2)', color: 'var(--accent6)',
                  },
                  topPersonalAll.length > 0 && {
                    icon: '\u{1F6CD}', label: 'Top Personal Spender', value: joinNames(topPersonalAll),
                    sub: `\u20B1${formatNum(topPersonalVal)} on solo expenses`,
                    bg: 'rgba(255,159,67,0.08)', border: 'rgba(255,159,67,0.2)', color: '#ff9f43',
                  },
                  mostTreatedAll.length > 0 && {
                    icon: '\u{1F60B}', label: 'Most Treated', value: joinNames(mostTreatedAll),
                    sub: `\u20B1${formatNum(mostTreatedVal)} worth of free rides`,
                    bg: 'rgba(254,202,87,0.08)', border: 'rgba(254,202,87,0.2)', color: 'var(--accent2)',
                  },
                  mostGenerousAll.length > 0 && {
                    icon: '\u{1F49D}', label: 'Most Generous', value: joinNames(mostGenerousAll),
                    sub: `\u20B1${formatNum(mostGenerousVal)} spent on others`,
                    bg: 'rgba(67,233,123,0.08)', border: 'rgba(67,233,123,0.2)', color: 'var(--green)',
                  },
                  mostExpensiveDay && {
                    icon: '\u{1F4C5}', label: 'Most Expensive Day', value: mostExpensiveDay[0],
                    sub: `\u20B1${formatNum(mostExpensiveDay[1])} total`,
                    bg: 'rgba(102,126,234,0.08)', border: 'rgba(102,126,234,0.2)', color: '#667eea',
                  },
                  alcoholKingAll.length > 0 && {
                    icon: '\u{1F37B}', label: 'Alcohol King', value: joinNames(alcoholKingAll),
                    sub: `\u20B1${formatNum(alcoholKingVal)} on drinks`,
                    bg: 'rgba(95,39,205,0.08)', border: 'rgba(95,39,205,0.2)', color: '#a78bfa',
                  },
                  foodieAll.length > 0 && {
                    icon: '\u{1F354}', label: 'Foodie', value: joinNames(foodieAll),
                    sub: `\u20B1${formatNum(foodieVal)} on meals`,
                    bg: 'rgba(254,202,87,0.08)', border: 'rgba(254,202,87,0.2)', color: 'var(--accent2)',
                  },
                  biggestTreat && {
                    icon: '\u{1F381}', label: 'Biggest Treat', value: biggestTreat.description,
                    sub: `\u20B1${formatNum(biggestTreat.amount)} by ${biggestTreat.paidBy} (not in split)`,
                    bg: 'rgba(240,147,251,0.08)', border: 'rgba(240,147,251,0.2)', color: '#f093fb',
                  },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: item.bg, border: `1px solid ${item.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', background: `${item.border}`,
                    }}>
                      {item.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: item.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        <Card>
          <CardTitle icon="&#128202;" gradient="var(--gradient-primary)">By Category</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(CAT_LABELS).map(([key, label]) => {
              const amt = catTotals[key] || 0;
              const pct = total > 0 ? (amt / total) * 100 : 0;
              const barPct = (amt / maxCat) * 100;
              const color = catColors[key] || 'var(--accent5)';
              return (
                <motion.div key={key} variants={fadeUp} style={{
                  background: 'var(--surface2)', borderRadius: 12, padding: '14px 16px',
                  border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.95rem', background: `${color}22`,
                      }}>
                        {CAT_ICONS[key] || '\u{1F4C1}'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>{pct.toFixed(1)}% of total</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color }}>&#8369;{formatNum(amt)}</div>
                  </div>
                  <div style={{
                    marginTop: 10, height: 4, borderRadius: 2, background: 'var(--surface3)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                      style={{ height: '100%', borderRadius: 2, background: color }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>

      </motion.div>
    </>
  );
}
