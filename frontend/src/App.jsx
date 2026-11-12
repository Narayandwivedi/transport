import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import BusinessReports, { ReportPage } from './pages/BusinessReports';
import Trips from './pages/Trips';
import MonthlyHire from './pages/MonthlyHire';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import StockItems from './pages/StockItems';
import Diesel from './pages/Diesel';
import MeterReadings from './pages/MeterReadings';
import Mileage from './pages/Mileage';
import Maintenance from './pages/Maintenance';
import Documents from './pages/Documents';
import Calculator from './pages/Calculator';
import Quotations from './pages/Quotations';
import QuotationEditor from './pages/QuotationEditor';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Parties from './pages/Parties';
import Drivers from './pages/Drivers';
import PartyLedger from './pages/PartyLedger';
import Settings from './pages/Settings';
import Payroll from './pages/Payroll';
import ActivityCenter from './pages/ActivityCenter';
import StaffHome from './pages/StaffHome';

export default function App() {
  const { isAuthenticated, loading, isStaff } = useAuth();

  // A staff login gets one page: the add buttons the owner allowed and their own entries
  if (isStaff) {
    return (
      <Routes>
        <Route path="/" element={<StaffHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!loading && isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      {/* Everything else sits inside the sidebar layout, signed in only */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/activity" element={<ActivityCenter />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/business-reports" element={<BusinessReports />} />
        {/* Each report on its own page: /reports/diesel, /reports/parties-ledger… (/reports itself is Profit Reports) */}
        <Route path="/reports/:report" element={<ReportPage />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/monthly-hire" element={<MonthlyHire />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/diesel" element={<Diesel />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/meter-readings" element={<MeterReadings />} />
        <Route path="/mileage" element={<Mileage />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/quotations/new" element={<QuotationEditor />} />
        <Route path="/quotations/:id" element={<QuotationEditor />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/parties" element={<Parties />} />
        <Route path="/parties/:id" element={<PartyLedger />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/stock-items" element={<StockItems />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
