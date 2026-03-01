import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTutorial } from '../hooks/useTutorial';

describe('useTutorial (per-tab)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts inactive by default', () => {
    const { result } = renderHook(() => useTutorial());
    expect(result.current.active).toBe(false);
    expect(result.current.activeTab).toBe(null);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.stepCount).toBe(0);
  });

  it('startForTab("expenses") activates the tab', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('expenses'));
    expect(result.current.active).toBe(true);
    expect(result.current.activeTab).toBe('expenses');
    expect(result.current.stepIndex).toBe(0);
  });

  it('setStepCount updates stepCount', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('expenses'));
    act(() => result.current.setStepCount(4));
    expect(result.current.stepCount).toBe(4);
  });

  it('next() advances within the tab steps', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('expenses'));
    act(() => result.current.setStepCount(4));
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.active).toBe(true);
  });

  it('next() on last step stops and writes localStorage for that tab', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('expenses'));
    act(() => result.current.setStepCount(4));
    for (let i = 0; i < 3; i++) {
      act(() => result.current.next());
    }
    expect(result.current.stepIndex).toBe(3);
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem('tutorial_expenses')).toBe('true');
  });

  it('stop() persists done flag for the active tab', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('funds'));
    act(() => result.current.stop());
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem('tutorial_funds')).toBe('true');
  });

  it('isTabDone() returns correct state per tab', () => {
    const { result } = renderHook(() => useTutorial());
    expect(result.current.isTabDone('expenses')).toBe(false);
    localStorage.setItem('tutorial_expenses', 'true');
    expect(result.current.isTabDone('expenses')).toBe(true);
    expect(result.current.isTabDone('funds')).toBe(false);
  });

  it('startForTab() works independently per tab', () => {
    const { result } = renderHook(() => useTutorial());
    // Complete expenses tutorial
    act(() => result.current.startForTab('expenses'));
    act(() => result.current.stop());
    expect(localStorage.getItem('tutorial_expenses')).toBe('true');
    // Funds should not be done
    expect(result.current.isTabDone('funds')).toBe(false);
    // Start funds independently
    act(() => result.current.startForTab('funds'));
    expect(result.current.active).toBe(true);
    expect(result.current.activeTab).toBe('funds');
  });

  it('prev() does not go below 0', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('summary'));
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(0);
  });

  it('prev() decrements stepIndex', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('settlement'));
    act(() => result.current.setStepCount(3));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(2);
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(1);
  });

  it('startForTab() resets stepIndex to 0 even after partial progress', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('trip'));
    act(() => result.current.setStepCount(4));
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
    act(() => result.current.startForTab('trip'));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.active).toBe(true);
  });

  it('ignores unknown tab names', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('unknown'));
    expect(result.current.active).toBe(false);
    expect(result.current.activeTab).toBe(null);
  });

  it('startForTab("expense_form") activates', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('expense_form'));
    expect(result.current.active).toBe(true);
    expect(result.current.activeTab).toBe('expense_form');
  });

  it('startForTab("admin") activates', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('admin'));
    expect(result.current.active).toBe(true);
    expect(result.current.activeTab).toBe('admin');
  });

  it('completing admin tutorial does not affect trip tab done state', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('admin'));
    act(() => result.current.stop());
    expect(localStorage.getItem('tutorial_admin')).toBe('true');
    expect(result.current.isTabDone('trip')).toBe(false);
  });

  it('setStepCount controls when next() ends the tutorial', () => {
    const { result } = renderHook(() => useTutorial());
    act(() => result.current.startForTab('funds'));
    act(() => result.current.setStepCount(2));
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.active).toBe(true);
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem('tutorial_funds')).toBe('true');
  });
});
