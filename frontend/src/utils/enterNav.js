/**
 * Enter moves to the next field in forms marked data-enter-nav (Diesel Purchase and others that opt in).
 * Fields: inputs, selects, textareas and the searchable dropdowns (buttons with class "input"),
 * in page order, skipping hidden, disabled and tabIndex -1 ones.
 */
const FIELDS = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, button.input';

const fieldsIn = (root) => [...root.querySelectorAll(FIELDS)].filter((el) => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);

// Focus the field after `from`; false when it was the last one
export const focusNextField = (from) => {
  const root = from?.closest('[data-enter-nav]');
  if (!root) return false;
  const fields = fieldsIn(root);
  const next = fields[fields.indexOf(from) + 1];
  if (!next) return false;
  next.focus();
  if (typeof next.select === 'function' && next.tagName === 'INPUT' && next.type !== 'date') next.select();
  // A searchable dropdown opens straight away, ready to type
  if (next.tagName === 'BUTTON' && next.getAttribute('aria-haspopup') === 'listbox' && next.getAttribute('aria-expanded') !== 'true') next.click();
  // A plain dropdown marked data-open-on-enter opens its list too (browsers without showPicker just focus it)
  if (next.tagName === 'SELECT' && next.dataset.openOnEnter !== undefined) {
    try {
      next.showPicker?.();
    } catch {
      // Not allowed here: it stays focused, arrow keys still change it
    }
    // Picking from the list moves on to the next field; leaving it without a pick drops that
    const onPick = () => focusNextField(next);
    next.addEventListener('change', onPick, { once: true });
    next.addEventListener('blur', () => next.removeEventListener('change', onPick), { once: true });
  }
  return true;
};

/**
 * keydown handler for the form: Enter on a field goes to the next one; on a field marked
 * data-enter-submit (or the last field) it saves. Textareas keep Enter for new lines;
 * dropdowns handle their own Enter first (they call preventDefault).
 */
export const onEnterNext = (event, submit) => {
  if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
  const el = event.target;
  if (!el.closest?.('[data-enter-nav]')) return;
  if (el.tagName === 'TEXTAREA') return;
  if (!(el.tagName === 'INPUT' || el.tagName === 'SELECT')) return;
  event.preventDefault();
  if (el.dataset.enterSubmit !== undefined || !focusNextField(el)) submit();
};
