import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../utils/api';

const AlertsContext = createContext({ alerts: null, reload: () => {} });

/**
 * Document expiry, service due and low stock, checked whenever the page changes.
 * The first check after signing in pops a warning when something has already expired or is overdue.
 */
export const AlertsProvider = ({ children }) => {
  const [alerts, setAlerts] = useState(null);
  const warned = useRef(false);
  const location = useLocation();

  const reload = useCallback(async () => {
    try {
      const response = await apiClient.get('/alerts');
      setAlerts(response);
      if (!warned.current && response.urgent > 0) {
        warned.current = true;
        toast.warn(`${response.urgent} document${response.urgent === 1 ? ' has' : 's have'} expired or service is overdue. Open Alerts.`, { autoClose: 5000 });
      }
    } catch {
      // Alerts are a convenience; the page works without them
    }
  }, []);

  useEffect(() => {
    reload();
  }, [location.pathname, reload]);

  return <AlertsContext.Provider value={{ alerts, reload }}>{children}</AlertsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAlerts = () => useContext(AlertsContext);
