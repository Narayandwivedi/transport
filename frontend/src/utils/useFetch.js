import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from './api';

/**
 * GET a url and keep the result. Re-fetches when the url or params change.
 * Returns { data, loading, error, reload, setData }.
 */
export default function useFetch(url, params = {}, initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');
  const paramsKey = JSON.stringify(params);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return;
    const call = ++latest.current;
    setLoading(true);
    try {
      const response = await apiClient.get(url, { params: JSON.parse(paramsKey) });
      if (call === latest.current) {
        setData(response);
        setError('');
      }
    } catch (err) {
      if (call === latest.current) setError(err.message);
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [url, paramsKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
