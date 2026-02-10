import { useEffect, useState } from "react";

const API_BASE = "https://audit-coe-api.onrender.com";

function App() {
  const [auditRuns, setAuditRuns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [runsRes, tasksRes] = await Promise.all([
          fetch(`${API_BASE}/audit-runs`),
          fetch(`${API_BASE}/tasks`),
        ]);

        if (!runsRes.ok) throw new Error("Failed to load audit runs");
        if (!tasksRes.ok) throw new Error("Failed to load tasks");

        const runsData = await runsRes.json();
        const tasksData = await tasksRes.json();

        setAuditRuns(runsData.items || []);
        setTasks(tasksData.items || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading real audit data…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "red" }}>
        Error loading data: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Audit Command Center</h1>

      <h2>Audit Runs</h2>
      <ul>
        {auditRuns.map((run) => (
          <li key={run.id}>
            <strong>Status:</strong> {run.status}{" "}
            {run.due_at ? `(Due: ${run.due_at})` : ""}
          </li>
        ))}
      </ul>

      <h2>Tasks</h2>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <strong>{task.title}</strong> — {task.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
