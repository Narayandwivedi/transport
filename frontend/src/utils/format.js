// Dates are whole days stored as midnight UTC, so they are shown and edited in UTC too and never move a day

const pad = (value) => String(value).padStart(2, '0');

export const toDayInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

// Today in the viewer's own calendar, as "2026-10-19"
export const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const currentMonthInput = () => todayInput().slice(0, 7);

export const monthBounds = (month) => {
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
};

export const addDays = (day, days) => toDayInput(new Date(new Date(day).getTime() + days * 86400000));

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const formatMonth = (month) => {
  if (!month) return '';
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// "12 days left", "Expires today", "Expired 3 days ago"
export const daysLeftText = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) return '';
  if (daysLeft < 0) return `Expired ${-daysLeft} day${daysLeft === -1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
};

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

export const formatRupees = (value) => `₹${toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ₹1.2L / ₹3.4Cr for tight places like chart axes
export const formatShortRupees = (value) => {
  const number = toNumber(value);
  const abs = Math.abs(number);
  if (abs >= 1e7) return `₹${(number / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(number / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(number / 1e3).toFixed(1)}K`;
  return `₹${Math.round(number)}`;
};

export const formatNumber = (value, digits = 2) => toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: digits });

export const idOf = (value) => String(value?._id || value || '');

// "1,20,000 rupees only" style words for the quotation total
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n) => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
};

export const amountInWords = (value) => {
  let n = Math.round(toNumber(value));
  if (n === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `${parts.join(' ')} Rupees Only`;
};
