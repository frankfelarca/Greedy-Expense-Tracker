import { describe, it, expect } from 'vitest';
import { formatNum, todayStr, sanitize } from '../utils/helpers';

describe('formatNum', () => {
  it('formats whole numbers with commas', () => {
    expect(formatNum(1000)).toBe('1,000.00');
    expect(formatNum(1234567)).toBe('1,234,567.00');
  });

  it('formats decimals to 2 places', () => {
    expect(formatNum(123.456)).toBe('123.46');
    expect(formatNum(0.1)).toBe('0.10');
  });

  it('handles zero', () => {
    expect(formatNum(0)).toBe('0.00');
  });

  it('handles negative numbers', () => {
    expect(formatNum(-500)).toBe('-500.00');
  });

  it('handles null/undefined as zero', () => {
    expect(formatNum(null)).toBe('0.00');
    expect(formatNum(undefined)).toBe('0.00');
  });

  it('handles very large numbers', () => {
    expect(formatNum(999999999)).toBe('999,999,999.00');
  });
});

describe('todayStr', () => {
  it('returns a date string in YYYY-MM-DD format', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const result = todayStr();
    const now = new Date().toISOString().slice(0, 10);
    expect(result).toBe(now);
  });
});

describe('sanitize', () => {
  it('removes angle brackets', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('removes javascript: protocol', () => {
    expect(sanitize('javascript:alert(1)')).toBe('alert(1)');
  });

  it('removes inline event handlers', () => {
    expect(sanitize('onerror=alert(1)')).not.toMatch(/onerror\s*=/i);
    expect(sanitize('onclick=foo()')).not.toMatch(/onclick\s*=/i);
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('truncates to 500 characters', () => {
    const long = 'a'.repeat(600);
    expect(sanitize(long).length).toBe(500);
  });

  it('returns non-string values unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('preserves normal text', () => {
    expect(sanitize('Hello World')).toBe('Hello World');
  });
});
