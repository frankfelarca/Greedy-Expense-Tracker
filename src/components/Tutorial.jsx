import { useEffect, useMemo } from 'react';
import TutorialOverlay from './TutorialOverlay';

const TAB_STEPS = {
  expenses: [
    {
      selector: '.fab',
      title: 'Add an expense',
      description: 'Tap this button to log a new expense with amount, category, receipt, and split options.',
    },
    {
      selector: '.expense-toolbar',
      title: 'Filter & export',
      description: 'Expand filters to search by category, payer, date range, or traveler. Export to CSV or print.',
    },
    {
      selector: '.responsive-table',
      title: 'Your expenses',
      description: 'View all logged expenses. Tap a row to see details, edit, delete, or mark as paid.',
    },
    {
      selector: '.expense-actions-col',
      title: 'Row actions',
      description: 'Hover or tap a row to edit, delete, or mark an expense as paid outside the app.',
    },
  ],
  funds: [
    {
      selector: '.funds-overview',
      title: 'Fund overview',
      description: 'See total collected, hotel costs, payments, and each person\u2019s share at a glance.',
    },
    {
      selector: '.funds-hotel',
      title: 'Hotel costs',
      description: 'Admin can set the nightly rate, nights, and parking. Payments to the hotel are logged here.',
    },
    {
      selector: '.funds-hotel-edit',
      title: 'Edit hotel costs',
      description: 'Tap Edit to set the nightly rate, nights, parking slots, and notes.',
      when: 'admin',
    },
    {
      selector: '.funds-hotel-payments',
      title: 'Add hotel payments',
      description: 'Log each payment made to the hotel to track the remaining balance.',
    },
    {
      selector: '.funds-dp-collect',
      title: 'Collect DP',
      description: 'Record down payments collected from travelers toward the hotel share.',
      when: 'admin',
    },
    {
      selector: '.funds-dp',
      title: 'Down payments',
      description: 'Track who has paid their DP. Admin can collect from multiple travelers at once.',
    },
  ],
  summary: [
    {
      selector: '.summary-stats',
      title: 'Trip totals',
      description: 'Total spent, number of transactions, traveler count, and average cost per person.',
    },
    {
      selector: '.summary-export-pdf',
      title: 'Export PDF',
      description: 'Download a full PDF report of expenses, settlements, and fun stats.',
    },
    {
      selector: '.summary-persons',
      title: 'Per-person breakdown',
      description: 'See how much each traveler paid vs. their share. Green means overpaid, red means they owe.',
    },
    {
      selector: '.summary-fun',
      title: 'Fun stats',
      description: 'Who\u2019s the top spender? The alcohol king? The most treated? Check the fun stats.',
    },
    {
      selector: '.summary-category',
      title: 'By category',
      description: 'See how spending breaks down across food, transport, activities, and more.',
    },
  ],
  settlement: [
    {
      selector: '.settlement-debts',
      title: 'Who owes whom',
      description: 'The app calculates the minimum number of payments to settle all debts.',
    },
    {
      selector: '.settlement-payment-info',
      title: 'Payment info',
      description: 'Add your GCash, Maya, or bank details so others know how to pay you.',
    },
    {
      selector: '.settlement-proofs',
      title: 'Proof of payment',
      description: 'Upload proof after paying. The creditor can accept, decline, or mark as partial.',
    },
  ],
  trip: [
    {
      selector: '.trip-details',
      title: 'Trip info',
      description: 'View or edit the trip name, destination, dates, and car pooling settings.',
    },
    {
      selector: '.invite-grid',
      title: 'Invite links',
      description: 'Each traveler gets a unique link. Tap to copy and share it.',
    },
    {
      selector: '.trip-admin-unlock',
      title: 'Unlock admin',
      description: 'Tap Unlock and enter the password to access admin features like editing hotel costs and collecting DP.',
      when: 'notAdmin',
    },
    {
      selector: '.trip-admin',
      title: 'Admin controls',
      description: 'Unlock admin to manage travelers, lock expenses, or reset data.',
    },
  ],
  expense_form: [
    {
      selector: '.ef-description',
      title: 'What did you pay for?',
      description: 'Enter a short description. It auto-capitalizes the first letter.',
    },
    {
      selector: '.ef-amounts',
      title: 'Amount & category',
      description: 'Enter the amount in pesos and pick a category.',
    },
    {
      selector: '.ef-split',
      title: 'Split among',
      description: 'Choose which travelers share this expense. Use Select All or None.',
    },
    {
      selector: '.ef-receipt',
      title: 'Attach a receipt',
      description: 'Optionally upload a photo or PDF of the receipt for proof.',
    },
  ],
  admin: [
    {
      selector: '.add-traveler-row',
      title: 'Add travelers',
      description: 'Type a name and tap Add to invite someone to the trip.',
    },
    {
      selector: '.carpool-section',
      title: 'Carpooling',
      description: 'Set the number of cars to auto-pool parking, toll, and fuel expenses.',
    },
    {
      selector: '.invite-copy-btn',
      title: 'Copy invite links',
      description: 'Tap the copy button to share a traveler\u2019s unique invite link.',
    },
    {
      selector: '.expense-lock-section',
      title: 'Lock expenses',
      description: 'Set a date to freeze expense editing before settlement.',
    },
    {
      selector: '.nuke-section',
      title: 'Nuke data',
      description: 'Permanently delete all trip data. Requires a 10-second countdown to confirm.',
    },
  ],
};

function filterSteps(steps, isAdmin) {
  return steps.filter(s => !s.when || (s.when === 'admin' && isAdmin) || (s.when === 'notAdmin' && !isAdmin));
}

export default function Tutorial({ activeTab, stepIndex, next, onDone, isAdmin, setStepCount }) {
  const rawSteps = activeTab && TAB_STEPS[activeTab];
  const steps = useMemo(() => rawSteps ? filterSteps(rawSteps, isAdmin) : [], [rawSteps, isAdmin]);

  useEffect(() => {
    if (steps.length > 0) setStepCount(steps.length);
  }, [steps.length, setStepCount]);

  if (!rawSteps || steps.length === 0) return null;

  const step = steps[stepIndex] || steps[0];

  return (
    <TutorialOverlay
      selector={step.selector}
      title={step.title}
      description={step.description}
      stepIndex={stepIndex}
      stepCount={steps.length}
      onNext={next}
      onSkip={onDone}
    />
  );
}
