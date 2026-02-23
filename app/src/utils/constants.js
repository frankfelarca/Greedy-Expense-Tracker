export const CONTAINER = 'travel-expenses';

export const CAT_LABELS = { meals: 'Meals', alcohol: 'Drinks', fuel: 'Fuel', toll: 'Toll', entrance: 'Entrance', others: 'Others' };
export const CAT_OPTIONS = Object.entries(CAT_LABELS).map(([value, label]) => ({ value, label }));
export const PAYMENT_LABELS = { cash: 'Cash', ewallet: 'E-Wallet', bank_transfer: 'Bank Transfer', card: 'Card' };
export const PAYMENT_OPTIONS = Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }));

export const COLORS = ['#667eea','#f093fb','#48dbfb','#ff6b6b','#feca57','#54a0ff','#00d2d3','#ff9ff3','#5f27cd','#43e97b'];

export const CAT_ICONS = { hotel: '\u{1F3E8}', meals: '\u{1F37D}', alcohol: '\u{1F37B}', fuel: '\u{26FD}', toll: '\u{1F6E3}', entrance: '\u{1F3AB}', others: '\u{1F4E6}' };
export const PAYMENT_ICONS = { cash: '\u{1F4B5}', ewallet: '\u{1F4F1}', bank_transfer: '\u{1F3E6}', card: '\u{1F4B3}' };

export const QR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_QR_SIZE = 10 * 1024 * 1024;
export const WALLET_TYPES = [
  { key: 'gcash', label: 'GCash', icon: '\u{1F4F1}', placeholder: '09XXXXXXXXX', maxLen: 11 },
  { key: 'maya', label: 'Maya', icon: '\u{1F4F1}', placeholder: '09XXXXXXXXX', maxLen: 11 },
  { key: 'maribank', label: 'MariBank', icon: '\u{1F3E6}', placeholder: 'Account number', maxLen: 13 },
];
