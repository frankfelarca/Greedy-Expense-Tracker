import { useState, useCallback, useRef } from 'react';

const VALID_TABS = ['expenses', 'funds', 'summary', 'settlement', 'trip', 'expense_form', 'admin'];

function storageKey(tab) {
  return `tutorial_${tab}`;
}

export function useTutorial() {
  const [activeTab, setActiveTab] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepCount, setStepCountState] = useState(0);
  const stepCountRef = useRef(0);

  const setStepCount = useCallback((n) => {
    stepCountRef.current = n;
    setStepCountState(n);
  }, []);

  const startForTab = useCallback((tab) => {
    if (!VALID_TABS.includes(tab)) return;
    setActiveTab(tab);
    setStepIndex(0);
  }, []);

  const stop = useCallback(() => {
    if (activeTab) {
      localStorage.setItem(storageKey(activeTab), 'true');
    }
    setActiveTab(null);
  }, [activeTab]);

  const next = useCallback(() => {
    setStepIndex(prev => {
      const count = stepCountRef.current;
      if (prev + 1 >= count) {
        if (activeTab) localStorage.setItem(storageKey(activeTab), 'true');
        setActiveTab(null);
        return prev;
      }
      return prev + 1;
    });
  }, [activeTab]);

  const prev = useCallback(() => {
    setStepIndex(prev => Math.max(0, prev - 1));
  }, []);

  const isTabDone = useCallback((tab) => {
    return localStorage.getItem(storageKey(tab)) === 'true';
  }, []);

  const active = activeTab !== null;

  return { active, activeTab, startForTab, stop, stepIndex, next, prev, stepCount, setStepCount, isTabDone };
}
