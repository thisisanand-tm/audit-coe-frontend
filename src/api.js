// Central API helpers for the Audit CoE frontend (CRA)
// Update API_BASE if your backend URL changes.
const API_BASE = "https://audit-coe-api.onrender.com";

async function safeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text };
  }
}

export async function getAuditRuns() {
  const res = await fetch(`${API_BASE}/audit-runs`, { method: "GET" });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`audit-runs failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const data = await res.json();
  return data?.items ?? [];
}

export async function getTasks(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${API_BASE}/tasks?${qs}` : `${API_BASE}/tasks`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`tasks failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const data = await res.json();
  return data?.items ?? [];
}
