import { calcAmount } from './constants';
import { round2, toNumber } from './format';

export const QUOTE_STATUS = {
  draft: { label: 'Draft', className: 'badge-gray' },
  sent: { label: 'Sent', className: 'badge-blue' },
  accepted: { label: 'Accepted', className: 'badge-green' },
  rejected: { label: 'Rejected', className: 'badge-red' },
};

// Subtotal of the lines, less discount, plus GST on what is left
export const quoteTotals = (quote) => {
  const subtotal = round2((quote.items || []).reduce((total, item) => total + calcAmount(item.basis, item.quantity, item.rate), 0));
  const discount = Math.min(subtotal, toNumber(quote.discount));
  const taxable = round2(subtotal - discount);
  const gst = round2((taxable * toNumber(quote.gstPercent)) / 100);
  return { subtotal, discount, taxable, gst, total: round2(taxable + gst) };
};
