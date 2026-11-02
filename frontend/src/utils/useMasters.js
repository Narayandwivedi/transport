import { useCallback, useEffect, useState } from 'react';
import apiClient from './api';

// Vehicles and parties for the pickers in forms
export default function useMasters() {
  const [vehicles, setVehicles] = useState([]);
  const [parties, setParties] = useState([]);

  const reload = useCallback(async () => {
    const [vehicleList, partyList] = await Promise.all([
      apiClient.get('/vehicles').catch(() => []),
      apiClient.get('/parties').catch(() => []),
    ]);
    setVehicles(Array.isArray(vehicleList) ? vehicleList : []);
    setParties(Array.isArray(partyList) ? partyList : []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { vehicles, parties, reload };
}
