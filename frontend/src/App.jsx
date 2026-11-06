import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Trips from './pages/Trips';
import MonthlyHire from './pages/MonthlyHire';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import StockItems from './pages/StockItems';
import MeterReadings from './pages/MeterReadings';
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

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!loading && isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      {/* Everything else sits inside the sidebar layout, signed in only */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/monthly-hire" element={<MonthlyHire />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/meter-readings" element={<MeterReadings />} />
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
