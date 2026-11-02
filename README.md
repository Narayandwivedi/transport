# TransportBook

Transport management software built on the same stack and look as CrusherBook
(React + Vite + Tailwind on the frontend, Express + MongoDB on the backend).

## Run it

1. **Database**: open `backend/.env` and set `MONGODB_URI`.
   - Local MongoDB: `mongodb://127.0.0.1:27017/transportbook` (already filled in)
   - Or MongoDB Atlas: use your Atlas connection string with a new database name, e.g. `.../transportbook`
2. **Backend** (port 5050):
   ```
   cd backend
   npm install
   npm run dev
   ```
3. **Frontend** (port 5180):
   ```
   cd frontend
   npm install
   npm run dev
   ```
4. Open http://localhost:5180, click **Create Account**, and start adding vehicles and parties.

## What is inside

| Area | What it does |
| --- | --- |
| **Vehicles** | Your own vehicles and hired vehicles (with owner + per trip / km / ton rate). Each vehicle page shows its monthly profit, trips, expenses, documents, services and meter readings. |
| **Parties** | Customers, vehicle owners, suppliers. Ledger per party with running balance (trips, monthly rent, credit purchases, payments). |
| **Trips** | Bill a party per trip, per km or per ton. For a hired vehicle the owner's hire is worked out too, so every trip shows its margin. |
| **Monthly Hire** | *Hire In*: take a vehicle monthly from its owner (you pay). *Give Out*: give your vehicle (or a hired one) monthly to a party (you charge). Part months are charged by days. A vehicle hired in and given out again shows the rent margin. |
| **Payments** | Money received from / paid to parties. |
| **Expenses** | Any spend on a vehicle (counts in its profit) or general/office (counts in business profit). |
| **Inventory** | Buy tyres, diesel, oil, spares into store (cash or supplier credit). Issue to a vehicle: it is costed at the average purchase rate and booked as that vehicle's expense automatically. Low stock alert. |
| **Payroll** | Drivers, helpers, mechanics and office staff on monthly salary or daily wage, each linked to the vehicle they work on. Attendance by day or as a month register. Salary sheet with days worked, earned, bonus, deductions (fines/challans), advances and paid; unpaid balance carries to the next month. Salary, advance and bata are booked automatically as that vehicle's expense. Driving licence expiry alerts. |
| **Meter Reading** | Odometer per vehicle. Trips, expenses and store issues with km also update it. |
| **Maintenance** | Service schedules due every N km and/or N days. Alerts when due soon / overdue. "Mark done" restarts the count and books the bill as an expense. |
| **Documents** | Road tax, insurance, fitness, PUC, GPS, permits, RC with expiry date and scan upload (jpg/png/pdf). Vehicle × document overview grid. Renewals keep history. |
| **Alerts** | Expired / expiring documents, services due, low stock. Checked on every page, badge in the sidebar, popup warning after sign-in if something has already expired. |
| **Profit Reports** | Month-wise vehicle profit (trip billing + rent received − trip hire − rent paid − expenses) and net business profit after office expenses. |
| **Cost Calculator** | Diesel, toll, driver, tyre wear, EMI, margin → trip cost, quote price, rate per ton / per km. One click turns it into a quotation. |
| **Quotations** | Printable A4 quotation with your letterhead, GST, amount in words, terms, WhatsApp share. |

Company details, document reminder days and default quotation terms are in **Settings**.
