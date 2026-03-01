import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CAT_LABELS, PAYMENT_LABELS } from './constants';
import { formatNum } from './helpers';
import { computeBalances, computeSettlements } from './settlements';

const BRAND = '#667eea';
const BRAND2 = '#764ba2';
const GREEN = '#2ecc71';
const RED = '#e74c3c';
const GRAY = '#7f8c8d';
const DARK = '#1a1a2e';
const LIGHT_BG = '#f8f9fa';

const _catColors = { hotel: '#ff6b6b', meals: '#feca57', alcohol: '#ff9ff3', fuel: '#48dbfb', toll: '#a18cd1', entrance: '#54a0ff', others: '#8888aa' };

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawRoundedRect(doc, x, y, w, h, r, fillColor) {
  doc.setFillColor(...hexToRgb(fillColor));
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function addSectionTitle(doc, title, y, pageWidth) {
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(BRAND));
  doc.text(title, 14, y);
  doc.setDrawColor(...hexToRgb(BRAND));
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, pageWidth - 14, y + 2);
  return y + 8;
}

function checkPageBreak(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function exportPdf({ trip, expenses, travelers, paidExpenses, paidSettlements: paidSettlementsMap, numberOfCars }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Compute data
  const { personPaid, personShare: _personShare, balances } = computeBalances(expenses, travelers, null, numberOfCars || 0);
  const settlements = computeSettlements(balances);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const count = expenses.length;
  const travelerCount = travelers.length;
  const perPerson = travelerCount > 0 ? total / travelerCount : 0;

  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Fun stats
  const paidRanking = travelers.map(t => ({ name: t.name, paid: personPaid[t.name] || 0 })).sort((a, b) => b.paid - a.paid);
  const topSpender = paidRanking[0];
  const leastSpender = paidRanking[paidRanking.length - 1];

  const owesSorted = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const mostBroke = owesSorted[0];
  const owedSorted = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const mostOwed = owedSorted[0];

  const generousAmounts = {};
  const treatedAmounts = {};
  const alcoholAmounts = {};
  const mealsAmounts = {};
  travelers.forEach(t => { generousAmounts[t.name] = 0; treatedAmounts[t.name] = 0; alcoholAmounts[t.name] = 0; mealsAmounts[t.name] = 0; });
  expenses.forEach(e => {
    const share = Math.round((e.amount / e.splitAmong.length) * 100) / 100;
    const othersCount = e.splitAmong.filter(n => n !== e.paidBy).length;
    if (othersCount > 0 && generousAmounts[e.paidBy] !== undefined) generousAmounts[e.paidBy] += share * othersCount;
    e.splitAmong.forEach(name => {
      if (name !== e.paidBy && treatedAmounts[name] !== undefined) treatedAmounts[name] += share;
    });
    if (e.category === 'alcohol' && alcoholAmounts[e.paidBy] !== undefined) alcoholAmounts[e.paidBy] += e.amount;
    if (e.category === 'meals' && mealsAmounts[e.paidBy] !== undefined) mealsAmounts[e.paidBy] += e.amount;
  });

  const topGenerous = Object.entries(generousAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  const topTreated = Object.entries(treatedAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  const alcoholKing = Object.entries(alcoholAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  const foodie = Object.entries(mealsAmounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];

  const dayTotals = {};
  expenses.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount; });
  const mostExpensiveDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];

  const biggestExpense = expenses.length > 0 ? expenses.reduce((a, b) => a.amount > b.amount ? a : b) : null;

  // ============================================
  // SECTION 1: COVER HEADER
  // ============================================
  // Gradient-like header band
  drawRoundedRect(doc, 0, 0, pageWidth, 58, 0, BRAND);
  // Overlay darker band at bottom
  drawRoundedRect(doc, 0, 40, pageWidth, 18, 0, BRAND2);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(trip.tripName || 'Trip Report', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (trip.tripDestination) {
    doc.text(trip.tripDestination, pageWidth / 2, 30, { align: 'center' });
  }

  doc.setFontSize(10);
  const dateStr = [trip.tripStart, trip.tripEnd].filter(Boolean).join(' to ');
  const headerLine = [dateStr, `${travelerCount} travelers`, `${count} expenses`].filter(Boolean).join('  |  ');
  doc.text(headerLine, pageWidth / 2, 50, { align: 'center' });

  // Branding
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('GreedySplit Trip Report', pageWidth / 2, 56, { align: 'center' });

  let y = 68;

  // ============================================
  // SECTION 2: TRIP STATS
  // ============================================
  drawRoundedRect(doc, 14, y, pageWidth - 28, 26, 3, LIGHT_BG);

  const statsData = [
    { label: 'Total Spent', value: `P${formatNum(total)}` },
    { label: 'Per Person', value: `P${formatNum(perPerson)}` },
    { label: 'Expenses', value: String(count) },
    { label: 'Top Category', value: topCategory ? CAT_LABELS[topCategory[0]] : '-' },
  ];

  const colW = (pageWidth - 28) / 4;
  statsData.forEach((s, i) => {
    const cx = 14 + colW * i + colW / 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(GRAY));
    doc.text(s.label.toUpperCase(), cx, y + 9, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(DARK));
    doc.text(s.value, cx, y + 18, { align: 'center' });
  });

  y += 34;

  // ============================================
  // SECTION 2.5: TRAVELERS
  // ============================================
  y = addSectionTitle(doc, 'Travelers', y, pageWidth);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(DARK));
  const travelerNames = travelers.map(t => t.name).join(',  ');
  const travelerLines = doc.splitTextToSize(travelerNames, pageWidth - 28);
  doc.text(travelerLines, 14, y);
  y += travelerLines.length * 5 + 8;

  // ============================================
  // SECTION 3: CATEGORY BREAKDOWN
  // ============================================
  y = addSectionTitle(doc, 'Category Breakdown', y, pageWidth);

  const catRows = Object.entries(CAT_LABELS).map(([key, label]) => {
    const amt = catTotals[key] || 0;
    const pct = total > 0 ? ((amt / total) * 100).toFixed(1) + '%' : '0%';
    return [label, `P${formatNum(amt)}`, pct];
  });

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount', '% of Total']],
    body: catRows,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(BRAND), fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ============================================
  // SECTION 4: FULL EXPENSE LIST
  // ============================================
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, 'All Expenses', y, pageWidth);

  const sortedExpenses = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const expRows = sortedExpenses.map(e => {
    const isPaid = paidExpenses && paidExpenses[e.id];
    return [
      e.date || '',
      e.description + (isPaid ? ' [PAID]' : ''),
      CAT_LABELS[e.category] || e.category,
      `P${formatNum(e.amount)}`,
      e.paidBy,
      (e.splitAmong || []).join(', '),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Among']],
    body: expRows,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(BRAND), fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 40 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      4: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const text = data.cell.raw;
        if (text.endsWith(' [PAID]')) {
          data.cell.styles.textColor = hexToRgb(GREEN);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ============================================
  // SECTION 5: PER-PERSON BREAKDOWN
  // ============================================
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, 'Per Person Summary', y, pageWidth);

  const personRows = [...balances].sort((a, b) => b.balance - a.balance).map(b => [
    b.name,
    `P${formatNum(b.paid)}`,
    `P${formatNum(b.share)}`,
    `${b.balance >= 0 ? '+' : ''}P${formatNum(b.balance)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Total Paid', 'Fair Share', 'Balance']],
    body: personRows,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(BRAND), fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = balances.sort((a, b) => b.balance - a.balance)[data.row.index];
        if (val) {
          data.cell.styles.textColor = val.balance >= 0 ? hexToRgb(GREEN) : hexToRgb(RED);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ============================================
  // SECTION 6: SETTLEMENT INSTRUCTIONS
  // ============================================
  y = checkPageBreak(doc, y, 20);
  y = addSectionTitle(doc, 'Who Owes Whom', y, pageWidth);

  if (settlements.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...hexToRgb(GRAY));
    doc.text('All balanced! No settlements needed.', 14, y);
    y += 8;
  } else {
    const settlementRows = settlements.map(s => {
      const key = `${s.from}__${s.to}`;
      const isPaid = paidSettlementsMap && paidSettlementsMap[key];
      return [
        s.from,
        '-->',
        s.to,
        `P${formatNum(s.amount)}`,
        isPaid ? 'PAID' : 'Pending',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['From', '', 'To', 'Amount', 'Status']],
      body: settlementRows,
      theme: 'striped',
      headStyles: { fillColor: hexToRgb(BRAND), fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'center', cellWidth: 10, fontStyle: 'bold', textColor: hexToRgb(BRAND) },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.textColor = data.cell.raw === 'PAID' ? hexToRgb(GREEN) : hexToRgb(RED);
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // ============================================
  // SECTION 7: FUN AWARDS
  // ============================================
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, 'Trip Awards', y, pageWidth);

  const awards = [
    topSpender && topSpender.paid > 0 && { title: 'Top Spender', name: topSpender.name, sub: `P${formatNum(topSpender.paid)} paid` },
    leastSpender && leastSpender.paid >= 0 && travelerCount > 1 && { title: 'Least Spender', name: leastSpender.name, sub: `P${formatNum(leastSpender.paid)} paid` },
    mostOwed && { title: 'Most Owed', name: mostOwed.name, sub: `owed P${formatNum(mostOwed.balance)}` },
    mostBroke && { title: 'Most Broke', name: mostBroke.name, sub: `owes P${formatNum(Math.abs(mostBroke.balance))}` },
    topGenerous && { title: 'Most Generous', name: topGenerous[0], sub: `P${formatNum(topGenerous[1])} on others` },
    topTreated && { title: 'Most Treated', name: topTreated[0], sub: `P${formatNum(topTreated[1])} in free rides` },
    alcoholKing && { title: 'Drinks Champion', name: alcoholKing[0], sub: `P${formatNum(alcoholKing[1])} on drinks` },
    foodie && { title: 'Foodie Award', name: foodie[0], sub: `P${formatNum(foodie[1])} on meals` },
    biggestExpense && { title: 'Biggest Expense', name: biggestExpense.description, sub: `P${formatNum(biggestExpense.amount)} by ${biggestExpense.paidBy}` },
    mostExpensiveDay && { title: 'Priciest Day', name: mostExpensiveDay[0], sub: `P${formatNum(mostExpensiveDay[1])} total` },
  ].filter(Boolean);

  const awardRows = awards.map(a => [a.title, a.name, a.sub]);

  autoTable(doc, {
    startY: y,
    head: [['Award', 'Winner', 'Details']],
    body: awardRows,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(BRAND2), fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: hexToRgb(BRAND) },
      1: { fontStyle: 'bold' },
      2: { textColor: hexToRgb(GRAY), fontStyle: 'italic' },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ============================================
  // FOOTER
  // ============================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...hexToRgb(GRAY));
    doc.text(
      `GreedySplit  |  Page ${p} of ${totalPages}  |  Generated ${new Date().toLocaleDateString('en-PH')}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  // Save
  const filename = (trip.tripName || 'trip').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  doc.save(`${filename}-report.pdf`);
}
