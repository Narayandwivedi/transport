import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Popup shell for forms: gradient header, scrollable body, footer with Cancel + submit. Esc closes it.
 * headerActions: extra buttons beside the close button. footerExtra: something at the left of the footer.
 */
export default function FormPopup({ title, subtitle, submitLabel = 'Save', submitDisabled = false, onSubmit, onClose, maxWidth = 'max-w-md', headerActions, footerExtra, children, hideFooter = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 md:p-4" onMouseDown={onClose}>
      <form
        className={`flex max-h-[95vh] w-full ${maxWidth} flex-col overflow-hidden rounded-xl bg-white shadow-2xl md:rounded-2xl`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); onSubmit?.(event); }}
      >
        <div className="flex-shrink-0 bg-gradient-to-r from-[#1f2a3c] via-[#27374f] to-[#314866] p-3 text-white md:px-5 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold md:text-xl">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-300 md:text-sm">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              {headerActions}
              <button type="button" onClick={onClose} aria-label="Close popup" className="rounded-lg p-1.5 text-white transition hover:bg-white/20 md:p-2">
                <X size={22} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3 md:space-y-4 md:p-6">{children}</div>

        {!hideFooter && (
          <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3 md:gap-3 md:p-4">
            {footerExtra && <div className="mr-auto min-w-0 text-sm">{footerExtra}</div>}
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary px-8" disabled={submitDisabled}>{submitLabel}</button>
          </div>
        )}
      </form>
    </div>
  );
}
