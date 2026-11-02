import { Paperclip, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { FILE_BASE_URL } from '../utils/api';
import { daysLeftText, formatDate, formatRupees } from '../utils/format';
import { STATUS_BADGES, getDocTypeLabel } from '../utils/constants';
import { RowAction, TD, TH } from './ui';

export default function DocumentTable({ docs, showVehicle = true, onEdit, onRenew, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left">
        <thead>
          <tr>
            {showVehicle && <th className={TH}>Vehicle</th>}
            <th className={TH}>Document</th>
            <th className={TH}>Valid</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Amount</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc._id} className={`tbl-row ${doc.status === 'renewed' ? 'opacity-60' : ''}`}>
              {showVehicle && <td className={`${TD} font-mono font-semibold`}>{doc.vehicleId?.vehicleNo}</td>}
              <td className={TD}>
                <p className="font-semibold text-slate-800">{getDocTypeLabel(doc.docType)}</p>
                <p className="text-xs text-slate-500">{[doc.docNumber, doc.provider].filter(Boolean).join(' · ') || '—'}</p>
              </td>
              <td className={`${TD} whitespace-nowrap text-xs`}>
                <p>{formatDate(doc.issueDate)} → <span className="font-semibold">{formatDate(doc.expiryDate)}</span></p>
                {doc.status !== 'renewed' && <p className={doc.daysLeft < 0 ? 'font-semibold text-rose-700' : doc.status === 'due_soon' ? 'font-semibold text-amber-700' : 'text-slate-500'}>{daysLeftText(doc.daysLeft)}</p>}
              </td>
              <td className={TD}><span className={STATUS_BADGES[doc.status]?.className}>{STATUS_BADGES[doc.status]?.label}</span></td>
              <td className={`${TD} text-right`}>{doc.amount ? formatRupees(doc.amount) : '—'}</td>
              <td className={TD}>
                <div className="flex justify-end">
                  {doc.file && (
                    <a href={`${FILE_BASE_URL}${doc.file}`} target="_blank" rel="noreferrer" className="icon-btn p-1.5 hover:bg-slate-100" title="Open scan" aria-label="Open scan">
                      <Paperclip size={16} />
                    </a>
                  )}
                  {doc.status !== 'renewed' && <RowAction title="Renew" icon={RotateCcw} tone="emerald" onClick={() => onRenew(doc)} />}
                  <RowAction title="Edit" icon={Pencil} onClick={() => onEdit(doc)} />
                  <RowAction title="Delete" icon={Trash2} tone="rose" onClick={() => onDelete(doc)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
