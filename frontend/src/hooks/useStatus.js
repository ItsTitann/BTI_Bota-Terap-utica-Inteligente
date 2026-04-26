import { useCallback, useEffect, useRef, useState } from 'react';
import { getStatus } from '../lib/api';

/**
 * Polling de /api/status cada 2 segundos.
 * Devuelve { status, error, loading, lastUpdate, refresh }.
 */
export default function useStatus(intervalMs = 2000) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const mounted = useRef(true);
  const timer = useRef(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStatus();
      if (!mounted.current) return;
      setStatus(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.userMessage || e?.response?.data?.detail || e?.message || 'Error desconocido';
      setError(msg);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchOnce();
    timer.current = setInterval(fetchOnce, intervalMs);
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [fetchOnce, intervalMs]);

  return { status, error, loading, lastUpdate, refresh: fetchOnce };
}
