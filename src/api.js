const API_BASE = "https://audit-coe-api.onrender.com";

export async function getAuditRuns() {
  const res = await fetch(`${API_BASE}/audit-runs`);
  if (!res.ok) throw new Error(`audit-runs failed: ${res.status}`);
  return res.json();
}

export async function getTasks(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${API_BASE}/tasks?${qs}` : `${API_BASE}/tasks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tasks failed: ${res.status}`);
  return res.json();
}
