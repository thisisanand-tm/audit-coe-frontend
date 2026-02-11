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


export async function submitTaskResponse(payload) {
  // Defensive: never throw from this helper. Return { ok, data, error }.
  try {
    const res = await fetch(`${API_BASE}/task-responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await safeJson(res);
    if (!res.ok) {
      return { ok: false, error: `task-responses failed (${res.status}): ${JSON.stringify(body)}`, data: body };
    }
    return { ok: true, data: body, error: null };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e), data: null };
  }
}
