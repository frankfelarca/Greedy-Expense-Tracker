import { describe, it, expect } from 'vitest';
import {
  CONTAINER, CAT_LABELS, CAT_OPTIONS, PAYMENT_LABELS, PAYMENT_OPTIONS,
  COLORS, CAT_ICONS, PAYMENT_ICONS, QR_TYPES, MAX_QR_SIZE, WALLET_TYPES,
} from '../utils/constants';

describe('constants', () => {
  describe('CONTAINER', () => {
    it('is a non-empty string', () => {
      expect(typeof CONTAINER).toBe('string');
      expect(CONTAINER.length).toBeGreaterThan(0);
    });
  });

  describe('CAT_LABELS', () => {
    it('has entries for all categories', () => {
      expect(Object.keys(CAT_LABELS)).toContain('meals');
      expect(Object.keys(CAT_LABELS)).toContain('fuel');
      expect(Object.keys(CAT_LABELS)).toContain('toll');
      expect(Object.keys(CAT_LABELS)).toContain('entrance');
      expect(Object.keys(CAT_LABELS)).toContain('others');
      expect(Object.keys(CAT_LABELS)).toContain('alcohol');
    });

    it('has string labels', () => {
      Object.values(CAT_LABELS).forEach(v => expect(typeof v).toBe('string'));
    });
  });

  describe('CAT_OPTIONS', () => {
    it('is an array matching CAT_LABELS', () => {
      expect(CAT_OPTIONS).toHaveLength(Object.keys(CAT_LABELS).length);
      CAT_OPTIONS.forEach(opt => {
        expect(opt).toHaveProperty('value');
        expect(opt).toHaveProperty('label');
        expect(CAT_LABELS[opt.value]).toBe(opt.label);
      });
    });
  });

  describe('PAYMENT_LABELS', () => {
    it('has entries for all payment methods', () => {
      expect(Object.keys(PAYMENT_LABELS)).toContain('cash');
      expect(Object.keys(PAYMENT_LABELS)).toContain('ewallet');
      expect(Object.keys(PAYMENT_LABELS)).toContain('bank_transfer');
      expect(Object.keys(PAYMENT_LABELS)).toContain('card');
    });
  });

  describe('PAYMENT_OPTIONS', () => {
    it('is an array matching PAYMENT_LABELS', () => {
      expect(PAYMENT_OPTIONS).toHaveLength(Object.keys(PAYMENT_LABELS).length);
      PAYMENT_OPTIONS.forEach(opt => {
        expect(PAYMENT_LABELS[opt.value]).toBe(opt.label);
      });
    });
  });

  describe('COLORS', () => {
    it('is an array of hex color strings', () => {
      expect(COLORS.length).toBeGreaterThanOrEqual(10);
      COLORS.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    });
  });

  describe('CAT_ICONS', () => {
    it('has an icon for each category in CAT_LABELS', () => {
      Object.keys(CAT_LABELS).forEach(k => {
        expect(CAT_ICONS[k]).toBeDefined();
        expect(typeof CAT_ICONS[k]).toBe('string');
      });
    });
  });

  describe('PAYMENT_ICONS', () => {
    it('has an icon for each payment method', () => {
      Object.keys(PAYMENT_LABELS).forEach(k => {
        expect(PAYMENT_ICONS[k]).toBeDefined();
        expect(typeof PAYMENT_ICONS[k]).toBe('string');
      });
    });
  });

  describe('QR_TYPES', () => {
    it('is an array of valid image MIME types', () => {
      expect(QR_TYPES.length).toBeGreaterThan(0);
      QR_TYPES.forEach(t => expect(t).toMatch(/^image\//));
    });
  });

  describe('MAX_QR_SIZE', () => {
    it('is 10MB', () => {
      expect(MAX_QR_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe('WALLET_TYPES', () => {
    it('has required fields for each wallet type', () => {
      expect(WALLET_TYPES.length).toBeGreaterThan(0);
      WALLET_TYPES.forEach(w => {
        expect(w).toHaveProperty('key');
        expect(w).toHaveProperty('label');
        expect(w).toHaveProperty('icon');
        expect(w).toHaveProperty('placeholder');
        expect(w).toHaveProperty('maxLen');
        expect(typeof w.maxLen).toBe('number');
      });
    });
  });
});
