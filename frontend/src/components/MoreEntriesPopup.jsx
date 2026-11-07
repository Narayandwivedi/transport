import { useEffect, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';

/**
 * Popup listing the less frequent entries as large cards.
 * entries: [{ key, label, hint, icon, tone }] (tone: gradient classes for the icon). onPick(entry) opens one.
 */
export default function MoreEntriesPopup({ entries, onPick, onClose }) {
  // Latest onClose, so the effect below runs once and the scroll lock is undone exactly once
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Esc closes the popup; the page behind does not scroll while it is open
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-entries-title"
        className="page-fade-in w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#1f2a3c] via-[#27374f] to-[#314866] px-4 py-3.5 text-white md:px-5 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="more-entries-title" className="truncate text-lg font-bold md:text-xl">More Entries</h2>
              <p className="mt-0.5 text-xs text-slate-300 md:text-sm">Pick the entry you want to make</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close popup" className="rounded-lg p-1.5 text-white transition hover:bg-white/20 md:p-2">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="grid max-h-[75vh] grid-cols-1 gap-2.5 overflow-y-auto bg-slate-50 p-3 sm:grid-cols-2 md:gap-3 md:p-5">
          {entries.map(({ icon: Icon, ...entry }, index) => (
            <button
              key={entry.key}
              type="button"
              autoFocus={index === 0}
              onClick={() => onPick(entry)}
              className="group flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:p-3.5"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-200 group-hover:scale-105 ${entry.tone}`}>
                <Icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-slate-800 group-hover:text-slate-900">{entry.label}</span>
                <span className="block truncate text-xs text-slate-500">{entry.hint}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
