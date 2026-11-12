import useFetch from '../utils/useFetch';
import { getBasisLabel, getBasisUnit } from '../utils/constants';
import { formatDate, formatNumber, formatRupees, idOf, toNumber } from '../utils/format';
import { timeOf } from '../utils/staff';
import FormPopup from './FormPopup';
import FormSection from './FormSection';
import { ErrorBox, Loading } from './ui';

// A missing value shows as "-"
const DASH = '-';
const money = (value) => (toNumber(value) ? formatRupees(value) : DASH);
const num = (value, decimals = 2) => (toNumber(value) ? formatNumber(value, decimals) : DASH);
const textOr = (value) => (String(value ?? '').trim() ? value : DASH);

const STATUS_TEXT = { planned: 'Planned', running: 'On the way', completed: 'Completed' };
const STATUS_BADGE = { planned: 'badge-blue', running: 'badge-orange', completed: 'badge-green' };
const MODE_TEXT = { cash: 'Cash', bank: 'Bank', upi: 'UPI', cheque: 'Cheque' };
const PUNCTURE = /^tyre\s*puncture$/i;

// Label above, value below; wide: takes the whole row
function Detail({ label, value, wide = false, strong = false }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 break-words text-sm ${strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{value}</p>
    </div>
  );
}
const Details = ({ children }) => <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</div>;

// A small read-only table inside a section
function MiniTable({ head, rows, foot }) {
  const th = 'px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500';
  const td = 'px-3 py-2 text-sm text-slate-800';
  return (
    <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
      <table className="w-full min-w-[34rem]">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>{head.map(([label, right]) => <th key={label} className={`${th} ${right ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((cells, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={index}>{cells.map((cell, i) => <td key={head[i][0]} className={`${td} ${head[i][1] ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
        {foot && (
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
            <tr>{foot.map((cell, i) => <td key={head[i][0]} className={`${td} ${head[i][1] ? 'text-right tabular-nums' : ''}`}>{cell}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Every saved detail of one trip, read-only. Loads the trip by its id, with its diesel fills. */
export default function TripDetailPopup({ tripId, onClose }) {
  const { data: trip, loading, error } = useFetch(`/trips/${tripId}`, {}, null);
  const { data: dieselList } = useFetch('/diesel-entries', { tripId }, []);
  // The material supplier is saved as an id; its name comes from the parties list
  const supplierId = idOf(trip?.materialSupplierId);
  const { data: partyList } = useFetch(supplierId ? '/parties' : '', {}, []);

  let body;
  if (loading && !trip) body = <Loading />;
  else if (!trip) body = <ErrorBox message={error || 'Trip not found'} />;
  else {
    const vehicle = trip.vehicleId || {};
    const hired = vehicle.ownership === 'hired';
    const startKm = toNumber(trip.startKm);
    const endKm = toNumber(trip.endKm);
    const totalKm = startKm && endKm && endKm >= startKm ? endKm - startKm : 0;
    const unit = getBasisUnit(trip.billingBasis);
    const suppliesMaterial = trip.materialBy === 'me';
    const supplier = supplierId ? (Array.isArray(partyList) ? partyList : []).find((party) => party._id === supplierId) : null;

    const bill = toNumber(trip.amount);
    const received = toNumber(trip.receivedAmount);
    const balance = Math.max(0, bill - received);
    let paymentText = 'Credit';
    if (received > 0) paymentText = received >= bill ? 'Fully paid' : 'Partial payment';

    const fills = (Array.isArray(dieselList) ? dieselList : []).filter((fill) => idOf(fill.tripId) === trip._id);
    const litres = fills.reduce((sum, fill) => sum + toNumber(fill.litres), 0);
    const dieselCost = fills.reduce((sum, fill) => sum + toNumber(fill.amount), 0);

    const expenses = (trip.expenses || []).filter((row) => toNumber(row.amount) > 0);
    const punctures = expenses.filter((row) => PUNCTURE.test(row.category || ''));
    const others = expenses.filter((row) => !PUNCTURE.test(row.category || ''));
    const expenseTotal = expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);

    body = (
      <>
        <FormSection number={1} title="Basic Details" tone="blue">
          <Details>
            <Detail label="Trip ID" value={<span className="font-mono">{textOr(trip.tripNo)}</span>} strong />
            <Detail label="Date" value={trip.date ? formatDate(trip.date) : DASH} />
            <Detail label="Status" value={trip.status ? <span className={STATUS_BADGE[trip.status]}>{STATUS_TEXT[trip.status] || trip.status}</span> : DASH} />
            <Detail label="Vehicle" value={vehicle.vehicleNo ? <span className="font-mono">{vehicle.vehicleNo}{hired ? <span className="ml-1 font-sans text-xs text-slate-500">(hired)</span> : ''}</span> : DASH} />
            <Detail label="Driver" value={textOr(trip.driverId?.name)} />
            <Detail label="Party (Bill To)" value={textOr(trip.partyId?.name)} />
          </Details>
        </FormSection>

        <FormSection number={2} title="Route Details" tone="sky">
          <Details>
            <Detail label="From" value={textOr(trip.from)} />
            <Detail label="To" value={textOr(trip.to)} />
            <Detail label="Charged Distance" value={toNumber(trip.distanceKm) ? `${formatNumber(trip.distanceKm, 0)} km` : trip.billingBasis === 'per_km' && toNumber(trip.quantity) ? `${formatNumber(trip.quantity, 0)} km` : DASH} />
            <Detail label="Starting KM" value={num(trip.startKm, 0)} />
            <Detail label="Ending KM" value={num(trip.endKm, 0)} />
            <Detail label="Total KM" value={totalKm ? `${formatNumber(totalKm, 0)} km` : DASH} />
          </Details>
        </FormSection>

        <FormSection number={3} title="Material & Charge" tone="emerald">
          <Details>
            <Detail label="Material" value={textOr(trip.material)} />
            <Detail label="Material By" value={suppliesMaterial ? 'We supplied' : 'Party loaded own'} />
            <Detail label="Billing Type" value={trip.billingBasis ? getBasisLabel(trip.billingBasis) : DASH} />
            <Detail label="Quantity" value={toNumber(trip.quantity) ? `${formatNumber(trip.quantity, 3)}${unit ? ` ${unit}` : ''}` : DASH} />
            <Detail label="Rate" value={toNumber(trip.rate) ? `${formatRupees(trip.rate)}${unit ? `/${unit}` : ''}` : DASH} />
            <Detail label="Transport Charge" value={money(trip.freightAmount)} strong />
            {suppliesMaterial && (
              <>
                <Detail label="Bought From" value={supplierId ? textOr(supplier?.name) : 'Cash'} />
                <Detail label="Buy Cost" value={money(trip.materialCost)} />
                <Detail label="Paid to Supplier" value={toNumber(trip.materialCostPaid) ? `${formatRupees(trip.materialCostPaid)} · ${MODE_TEXT[trip.materialCostMode] || ''}` : DASH} />
                <Detail label="Material Selling Price" value={money(trip.materialAmount)} />
              </>
            )}
          </Details>
        </FormSection>

        <FormSection number={4} title="Payment Details" tone="indigo">
          <Details>
            <Detail label="Bill Amount" value={money(trip.amount)} strong />
            <Detail label="Advance (Driver)" value={money(trip.driverAdvance)} />
            <Detail label="Received" value={received ? `${formatRupees(received)} · ${MODE_TEXT[trip.receivedMode] || ''}` : DASH} />
            <Detail label="Credit / Payment" value={bill ? paymentText : DASH} />
            <Detail label="Balance" value={bill ? <span className={balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>{formatRupees(balance)}</span> : DASH} strong />
            {hired && toNumber(trip.hireAmount) > 0 && (
              <Detail label={`Owner Payment${trip.hirePartyId?.name ? ` · ${trip.hirePartyId.name}` : ''}`} value={`${formatRupees(trip.hireAmount)}${trip.hireBasis ? ` (${getBasisLabel(trip.hireBasis)})` : ''}`} />
            )}
          </Details>
        </FormSection>

        <FormSection number={5} title="Diesel Details" tone="amber">
          {fills.length === 0 ? <p className="text-sm text-slate-500">{DASH} No diesel filled on this trip</p> : (
            <MiniTable
              head={[['Date'], ['Pump'], ['Litres', true], ['Rate', true], ['Total Cost', true], ['Paid', true]]}
              rows={fills.map((fill) => [
                formatDate(fill.date),
                fill.partyId?.name || 'Cash',
                `${formatNumber(fill.litres)} ltr`,
                money(fill.rate),
                money(fill.amount),
                money(fill.paidAmount ?? fill.amount),
              ])}
              foot={['Total', '', `${formatNumber(litres)} ltr`, litres ? formatRupees(dieselCost / litres) : DASH, formatRupees(dieselCost), '']}
            />
          )}
        </FormSection>

        <FormSection number={6} title="Expenses" tone="rose">
          {expenses.length === 0 ? <p className="text-sm text-slate-500">{DASH} No expenses on this trip</p> : (
            <>
              {punctures.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-rose-800">Tyre Puncture Details</p>
                  <MiniTable
                    head={[['Puncture Date'], ['Vehicle'], ['Notes'], ['Amount', true]]}
                    rows={punctures.map((row) => [formatDate(row.date || trip.date), vehicle.vehicleNo || DASH, textOr(row.notes), formatRupees(row.amount)])}
                  />
                </div>
              )}
              {others.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-rose-800">Other Expenses</p>
                  <MiniTable
                    head={[['Expense Type'], ['Notes'], ['Amount', true]]}
                    rows={others.map((row) => [textOr(row.category), textOr(row.notes), formatRupees(row.amount)])}
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-2.5 ring-1 ring-rose-200">
                <span className="text-sm text-rose-800">{expenses.length} expense{expenses.length === 1 ? '' : 's'}</span>
                <span className="text-lg font-bold text-rose-700">{formatRupees(expenseTotal)}</span>
              </div>
            </>
          )}
        </FormSection>

        <FormSection number={7} title="Additional Details" tone="slate">
          <Details>
            <Detail label="LR No. / Notes" value={textOr(trip.notes)} wide />
            <Detail label="Created Date" value={trip.createdAt ? `${formatDate(trip.createdAt)} ${timeOf(trip.createdAt)}` : DASH} />
            <Detail label="Last Updated" value={trip.updatedAt ? `${formatDate(trip.updatedAt)} ${timeOf(trip.updatedAt)}` : DASH} />
          </Details>
        </FormSection>
      </>
    );
  }

  return (
    <FormPopup
      title={trip?.tripNo ? `Trip Details · ${trip.tripNo}` : 'Trip Details'}
      subtitle="Everything saved on this trip (read-only)"
      maxWidth="max-w-4xl"
      onClose={onClose}
      hideFooter
    >
      {body}
    </FormPopup>
  );
}
