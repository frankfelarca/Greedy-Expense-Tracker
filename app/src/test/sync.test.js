import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  onValue: vi.fn(),
}));
vi.mock('../utils/firebase', () => ({ db: {}, isConfigured: false }));
vi.mock('../store/syncSlice', () => ({
  setSyncStatus: vi.fn((p) => ({ type: 'sync/setSyncStatus', payload: p })),
  setSyncing: vi.fn((p) => ({ type: 'sync/setSyncing', payload: p })),
}));
vi.mock('../store/tripSlice', () => ({
  loadCloudState: vi.fn((p) => ({ type: 'trip/loadCloudState', payload: p })),
  clearAll: vi.fn(() => ({ type: 'trip/clearAll' })),
}));
vi.mock('../store/toastSlice', () => ({
  toast: vi.fn(() => () => {}),
}));

const { getReceiptUrl, getQrUrl, uploadReceipt } = await import('../utils/sync');

describe('sync utilities', () => {
  describe('getReceiptUrl', () => {
    it('returns null when receiptPath is missing', () => {
      expect(getReceiptUrl({ account: 'acc', sasToken: '?token' }, '')).toBeNull();
      expect(getReceiptUrl({ account: 'acc', sasToken: '?token' }, null)).toBeNull();
    });

    it('returns null when config is incomplete', () => {
      expect(getReceiptUrl({ account: '', sasToken: '?token' }, 'receipts/a.jpg')).toBeNull();
      expect(getReceiptUrl({ account: 'acc', sasToken: '' }, 'receipts/a.jpg')).toBeNull();
    });

    it('builds correct URL', () => {
      const url = getReceiptUrl({ account: 'myacc', sasToken: '?sv=2020' }, 'receipts/abc.jpg');
      expect(url).toBe('https://myacc.blob.core.windows.net/travel-expenses/receipts/abc.jpg?sv=2020');
    });
  });

  describe('getQrUrl', () => {
    it('returns null when qrPath is missing', () => {
      expect(getQrUrl({ account: 'acc', sasToken: '?t' }, '')).toBeNull();
      expect(getQrUrl({ account: 'acc', sasToken: '?t' }, null)).toBeNull();
    });

    it('returns null when config is incomplete', () => {
      expect(getQrUrl({ account: '', sasToken: '?t' }, 'qr/a.png')).toBeNull();
    });

    it('builds correct URL', () => {
      const url = getQrUrl({ account: 'myacc', sasToken: '?sv=2020' }, 'qrcodes/alice.png');
      expect(url).toBe('https://myacc.blob.core.windows.net/travel-expenses/qrcodes/alice.png?sv=2020');
    });
  });

  describe('uploadReceipt validation', () => {
    const config = { account: 'acc', sasToken: '?t' };

    it('rejects files larger than 10MB', async () => {
      const file = { size: 11 * 1024 * 1024, type: 'image/jpeg', name: 'big.jpg' };
      await expect(uploadReceipt(config, 'e1', file)).rejects.toThrow('File too large');
    });

    it('rejects invalid MIME types', async () => {
      const file = { size: 100, type: 'application/zip', name: 'bad.zip' };
      await expect(uploadReceipt(config, 'e1', file)).rejects.toThrow('Invalid file type');
    });

    it('rejects invalid file extensions', async () => {
      const file = { size: 100, type: 'image/jpeg', name: 'file.exe' };
      await expect(uploadReceipt(config, 'e1', file)).rejects.toThrow('Invalid file extension');
    });

    it('accepts valid image files', async () => {
      const file = { size: 1024, type: 'image/jpeg', name: 'receipt.jpg' };
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const result = await uploadReceipt(config, 'e1', file);
      expect(result).toBe('receipts/e1.jpg');
      delete globalThis.fetch;
    });

    it('accepts PDF files', async () => {
      const file = { size: 1024, type: 'application/pdf', name: 'doc.pdf' };
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const result = await uploadReceipt(config, 'e1', file);
      expect(result).toBe('receipts/e1.pdf');
      delete globalThis.fetch;
    });

    it('rejects when upload fails', async () => {
      const file = { size: 1024, type: 'image/png', name: 'receipt.png' };
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(uploadReceipt(config, 'e1', file)).rejects.toThrow('Upload failed: 500');
      delete globalThis.fetch;
    });
  });
});
