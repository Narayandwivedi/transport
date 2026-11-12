import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, HandCoins, Printer, Scale } from 'lucide-react';
import useFetch from '../utils/useFetch';
import { formatDate, formatRupees } from '../utils/format';
import { getPartyTypeLabel } from '../utils/constants';
import StatCard from '../components/StatCard';
import PaymentPopup from '../components/PaymentPopup';
import { EmptyState, ErrorBox, Loading, Page, PageHeader, PanelHeader, TD, TH } from '../components/ui';

const balanceText = (balance) => {
  if (!balance) return 'Settled';
  return balance > 0 ? `${formatRupees(balance)} Dr` : `${formatRupees(-balance)} Cr`;
};

export default function PartyLedger() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/reports/party-ledger/${id}`);
  const [payment, setPayment] = useState(null);

  if (loading && !data) return <Page><Loading /></Page>;
  if (!data) return <Page><ErrorBox message={error || 'Party not found'} /></Page>;

  const { party, rows, totalDebit, totalCredit, balance, openingBalance } = data;

  return (
    <Page>
      <PageHeader title={party.name} subtitle={`${getPartyTypeLabel(party.type)}${party.mobile ? ` · ${party.mobile}` : ''}${party.address ? ` · ${party.address}` : ''}`}>
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print</button>
        <button type="button" className="btn-secondary no-print" onClick={() => setPayment({ type: 'paid' })}><ArrowUpRight size={16} /> Pay</button>
        <button type="button" className="btn-primary no-print" onClick={() => setPayment({ type: 'received' })}><HandCoins size={16} /> Receive</button>
      </PageHeader>

      <section className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
        <StatCard compact icon={ArrowDownLeft} tone="blue" label="Debit (billed / paid out)" value={formatRupees(totalDebit)} />
        <StatCard compact icon={ArrowUpRight} tone="amber" label="Credit (hire / received)" value={formatRupees(totalCredit)} />
        <StatCard
          compact
          icon={Scale}
          tone={balance > 0 ? 'emerald' : balance < 0 ? 'rose' : 'slate'}
          label={balance > 0 ? 'They owe me' : balance < 0 ? 'I owe them' : 'Balance'}
          value={balance ? formatRupees(Math.abs(balance)) : 'Settled'}
        />
      </section>

      <section className="panel">
        <PanelHeader title="Ledger" count={rows.length} onRefresh={reload} loading={loading} />
        {rows.length === 0 && !openingBalance ? <EmptyState title="No entries yet" hint="Trips, monthly rent, purchases and payments with this party show here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Details</th>
                  <th className={`${TH} text-right`}>Debit</th>
                  <th className={`${TH} text-right`}>Credit</th>
                  <th className={`${TH} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {openingBalance !== 0 && (
                  <tr className="tbl-row bg-slate-50/60">
                    <td className={TD}>—</td>
                    <td className={TD} colSpan={2}><span className="font-semibold">Opening Balance</span></td>
                    <td className={`${TD} text-right`}>{openingBalance > 0 ? formatRupees(openingBalance) : ''}</td>
                    <td className={`${TD} text-right`}>{openingBalance < 0 ? formatRupees(-openingBalance) : ''}</td>
                    <td className={`${TD} text-right font-semibold`}>{balanceText(openingBalance)}</td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <tr key={index} className="tbl-row">
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(row.date)}</td>
                    <td className={TD}>
                      <p className="font-semibold text-slate-800">{row.kind}</p>
                      {row.ref && <p className="font-mono text-[11px] text-slate-500">{row.ref}</p>}
                    </td>
                    <td className={`${TD} text-slate-600`}>
                      {row.vehicleNo && <p className="font-mono font-semibold text-slate-800">{row.vehicleNo}</p>}
                      <p>{row.details || '—'}</p>
                    </td>
                    <td className={`${TD} text-right text-blue-700`}>{row.debit ? formatRupees(row.debit) : ''}</td>
                    <td className={`${TD} text-right text-amber-700`}>{row.credit ? formatRupees(row.credit) : ''}</td>
                    <td className={`${TD} whitespace-nowrap text-right font-semibold ${row.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{balanceText(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">Dr: the party owes you. Cr: you owe the party. Monthly rent is added month by month up to today.</p>
      </section>

      {payment && <PaymentPopup preset={{ partyId: party._id, type: payment.type }} onClose={() => setPayment(null)} onSaved={reload} />}
    </Page>
  );
}
