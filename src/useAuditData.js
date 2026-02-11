import { useEffect, useMemo, useState } from "react";
import { getAuditRuns, getTasks } from "./api";

/**
 * useAuditData
 * - Loads audit runs and tasks from the live backend
 * - Returns data + loading/error flags
 *
 * NOTE: This hook is intentionally generic so you can map it into your existing UX
 * without changing layout/styling.
 */
export function useAuditData() {
  const [auditRuns, setAuditRuns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [runs, tsks] = await Promise.all([getAuditRuns(), getTasks()]);
      setAuditRuns(runs);
      setTasks(tsks);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({ auditRuns, tasks, loading, error, refresh }),
    [auditRuns, tasks, loading, error]
  );
}
