import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { useAuditData } from "./useAuditData";
import { submitTaskResponse } from "./api";

const demo = {
  user: { name: "Anand", role: "COE Admin" },
  domains: [
    { id: "legal", name: "Legal & Compliance", poc: "Lebogangshadi Jiyana", escalation: "Jillian Stillman" },
    { id: "infosec", name: "Information Security", poc: "Hanuma Sateesh", escalation: "Gopinath Subramaniyam" },
    { id: "it", name: "IT", poc: "TAM Queue", escalation: "SSG Leads" },
    { id: "hr", name: "HR", poc: "HR Audit Team", escalation: "Ranveer Chawla" },
  ],
  audit: {
    id: "AUD-2026-021",
    account: "Client",
    cohort: "Cohort 3: Planned Client Audit",
    dueDate: "2026-02-28",
    status: "In Progress",
  },
  assignments: [
    {
      id: "asgn-1",
      domainId: "legal",
      assignee: "Lebogangshadi Jiyana",
      dueDate: "2026-02-14",
      status: "In Progress",
      lastUpdated: "2026-02-09 10:12",
      questions: [
        { id: "q-1", text: "Provide evidence of updated compliance training completion.", type: "text" },
        { id: "q-2", text: "Are contractual compliance clauses met?", type: "choice" },
      ],
      responses: {
        "q-1": { choice: null, text: "Training tracker attached.", evidence: ["training_tracker.xlsx"] },
        "q-2": { choice: "Compliant", text: "All required clauses met as per latest review.", evidence: [] },
      },
    },
    {
      id: "asgn-2",
      domainId: "infosec",
      assignee: "Hanuma Sateesh",
      dueDate: "2026-02-11",
      status: "Overdue",
      lastUpdated: "2026-02-08 17:40",
      questions: [
        { id: "q-3", text: "Confirm MFA enforcement and provide policy reference.", type: "choice" },
        { id: "q-4", text: "Upload latest vulnerability scan report.", type: "upload" },
      ],
      responses: {
        "q-3": { choice: "Non-Compliant", text: "MFA rollout in progress for legacy apps.", evidence: [] },
        "q-4": { choice: null, text: "", evidence: [] },
      },
    },
    {
      id: "asgn-3",
      domainId: "it",
      assignee: "TAM Queue",
      dueDate: "2026-02-13",
      status: "Not Started",
      lastUpdated: "—",
      questions: [
        { id: "q-5", text: "Provide IT access review evidence for last quarter.", type: "upload" },
        { id: "q-6", text: "Confirm incident response process is documented.", type: "choice" },
      ],
      responses: {},
    },
  ],
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function StatusChip({ status }) {
  const map = {
    "Not Started": "bg-slate-100 text-slate-700",
    "In Progress": "bg-blue-100 text-blue-700",
    "Overdue": "bg-red-100 text-red-700",
    "Completed": "bg-green-100 text-green-700",
  };
  return (
    <span className={cx("px-2 py-1 rounded-full text-xs font-medium", map[status] || "bg-slate-100")}>
      {status}
    </span>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

export default function App() {
  const { auditRuns, tasks, loading, error, refresh } = useAuditData();
  // -----------------------------------------------------------------
  // LIVE WRITE PATH (Phase A): minimal UI to POST /task-responses
  // Defensive rule: never crash the UI; always surface errors.
  // -----------------------------------------------------------------
  const [liveTaskId, setLiveTaskId] = useState("");
  const [liveResponseText, setLiveResponseText] = useState("");
  const [liveSubmitState, setLiveSubmitState] = useState({ status: "idle", message: "" });

  const hasLiveData = (auditRuns && auditRuns.length > 0) || (tasks && tasks.length > 0);
  useEffect(() => {
    // Initialize live task selection once tasks are loaded.
    if (!liveTaskId && Array.isArray(tasks) && tasks.length > 0) {
      setLiveTaskId(tasks[0]?.id || "");
    }
  }, [tasks, liveTaskId]);

  const [view, setView] = useState("command"); // command | inbox | respond
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(demo.assignments[0].id);
  const [state, setState] = useState(() => structuredClone(demo));

  // ✅ Demo Role Switcher
  const roles = ["COE Admin", "Domain POC", "Executive Viewer"];
  const [activeRole, setActiveRole] = useState("COE Admin");
  const [activePocName, setActivePocName] = useState("Hanuma Sateesh");

  const domainById = useMemo(() => Object.fromEntries(state.domains.map((d) => [d.id, d])), [state.domains]);

  // 🔐 Role-based filtering for Domain POC demo (others see all)
  const visibleAssignments = useMemo(() => {
    if (activeRole !== "Domain POC") return state.assignments;
    return state.assignments.filter((a) => a.assignee === activePocName);
  }, [activeRole, activePocName, state.assignments]);

  // Keep selected assignment valid when role/POC changes
  useEffect(() => {
    if (activeRole === "Executive Viewer") {
      setView("command");
      return;
    }
    if (activeRole === "Domain POC" && view === "command") setView("inbox");

    const ids = new Set(visibleAssignments.map((a) => a.id));
    if (!ids.has(selectedAssignmentId)) {
      setSelectedAssignmentId(visibleAssignments[0]?.id || state.assignments[0]?.id);
    }
  }, [activeRole, activePocName, visibleAssignments, selectedAssignmentId, state.assignments, view]);

  const selected = useMemo(() => {
    const pool = activeRole === "Domain POC" ? visibleAssignments : state.assignments;
    return pool.find((a) => a.id === selectedAssignmentId) || pool[0];
  }, [activeRole, selectedAssignmentId, state.assignments, visibleAssignments]);

  const statsBase = useMemo(() => {
    // Exec & COE want full picture; POC sees their slice
    return activeRole === "Domain POC" ? visibleAssignments : state.assignments;
  }, [activeRole, state.assignments, visibleAssignments]);

  const stats = useMemo(() => {
    const total = statsBase.length;
    const completed = statsBase.filter((a) => a.status === "Completed").length;
    const overdue = statsBase.filter((a) => a.status === "Overdue").length;
    const inProgress = statsBase.filter((a) => a.status === "In Progress").length;

    const nonCompliances = statsBase.reduce((acc, a) => {
      const r = a.responses || {};
      const count = Object.values(r).filter((x) => x?.choice === "Non-Compliant").length;
      return acc + count;
    }, 0);

    const evidenceCount = statsBase.reduce((acc, a) => {
      const r = a.responses || {};
      const files = Object.values(r).flatMap((x) => x?.evidence || []);
      return acc + files.length;
    }, 0);

    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, overdue, inProgress, nonCompliances, evidenceCount, pct };
  }, [statsBase]);

  function fastForwardSLA() {
    setState((s) => {
      const next = structuredClone(s);
      next.assignments = next.assignments.map((a) => {
        if (a.status === "Not Started") return { ...a, status: "In Progress", lastUpdated: "2026-02-09 11:00" };
        if (a.status === "In Progress") return { ...a, status: "Overdue", lastUpdated: "2026-02-09 11:00" };
        if (a.status === "Overdue") return { ...a, status: "Completed", lastUpdated: "2026-02-09 11:00" };
        return a;
      });
      return next;
    });
  }

  function updateResponse(questionId, patch) {
    setState((s) => {
      const next = structuredClone(s);
      const a = next.assignments.find((x) => x.id === selectedAssignmentId) || next.assignments[0];
      a.responses = a.responses || {};
      a.responses[questionId] = { ...(a.responses[questionId] || {}), ...patch };
      a.lastUpdated = "2026-02-09 11:05";
      if (a.status === "Not Started") a.status = "In Progress";
      return next;
    });
  }

  function addEvidence(questionId, fileName) {
    setState((s) => {
      const next = structuredClone(s);
      const a = next.assignments.find((x) => x.id === selectedAssignmentId) || next.assignments[0];
      a.responses = a.responses || {};
      const r = a.responses[questionId] || { choice: null, text: "", evidence: [] };
      const evidence = Array.from(new Set([...(r.evidence || []), fileName]));
      a.responses[questionId] = { ...r, evidence };
      a.lastUpdated = "2026-02-09 11:06";
      if (a.status === "Not Started") a.status = "In Progress";
      return next;
    });
  }


async function submitLiveResponse() {
  // Pre-flight checks (frontend)
  try {
    if (!liveTaskId) {
      setLiveSubmitState({ status: "error", message: "No live task selected." });
      return;
    }
    const text = (liveResponseText || "").trim();
    if (!text) {
      setLiveSubmitState({ status: "error", message: "Response text is empty." });
      return;
    }

    setLiveSubmitState({ status: "submitting", message: "Saving…" });

    const result = await submitTaskResponse({
      task_id: liveTaskId,
      response_text: text,
      response_type: "text",
      // user_id intentionally omitted unless you want to pass it later
    });

    if (!result || !result.ok) {
      setLiveSubmitState({ status: "error", message: (result && result.error) || "Save failed." });
      return;
    }

    setLiveSubmitState({ status: "success", message: "Saved to backend ✅" });

    // Best-effort refresh of read models so the UI stays consistent.
    if (typeof refresh === "function") {
      try {
        await refresh();
      } catch {
        // swallow; never crash UI
      }
    }
  } catch (e) {
    setLiveSubmitState({ status: "error", message: e?.message || "Unexpected error while saving." });
  }
}
  function markCompleted() {
    setState((s) => {
      const next = structuredClone(s);
      const a = next.assignments.find((x) => x.id === selectedAssignmentId) || next.assignments[0];
      a.status = "Completed";
      a.lastUpdated = "2026-02-09 11:10";
      return next;
    });
  }

  function generateAuditPack() {
    const lines = [];
    lines.push(`Audit Pack (Mock)\nAudit: ${state.audit.id} | ${state.audit.account}\n`);

    // Exec/COE export full pack; POC exports their slice
    const exportBase = activeRole === "Domain POC" ? visibleAssignments : state.assignments;

    for (const a of exportBase) {
      const domain = domainById[a.domainId]?.name || a.domainId;
      lines.push(`\n=== ${domain} ===`);
      lines.push(`Assignee: ${a.assignee} | Status: ${a.status} | Due: ${a.dueDate}`);
      for (const q of a.questions) {
        const r = (a.responses || {})[q.id] || {};
        lines.push(`- Q: ${q.text}`);
        lines.push(`  Answer: ${r.choice || ""} ${r.text ? `| ${r.text}` : ""}`);
        const ev = (r.evidence || []).join(", ");
        if (ev) lines.push(`  Evidence: ${ev}`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.audit.id}_AuditPack.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showCommand = activeRole !== "Domain POC";
  const showInbox = activeRole !== "Executive Viewer";
  const showRespond = activeRole !== "Executive Viewer";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold">{state.audit.account} — Audit Command Center</div>
            <div className="text-sm text-slate-500">
              {state.audit.id} • {state.audit.cohort} • Due {state.audit.dueDate}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ✅ Role Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Role:</span>
              <select
                className="border rounded-lg px-2 py-2 text-sm bg-white"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {activeRole === "Domain POC" && (
                <>
                  <span className="text-xs text-slate-500 ml-2">POC:</span>
                  <select
                    className="border rounded-lg px-2 py-2 text-sm bg-white"
                    value={activePocName}
                    onChange={(e) => setActivePocName(e.target.value)}
                  >
                    {Array.from(new Set(state.assignments.map((a) => a.assignee))).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <button
              className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm"
              onClick={fastForwardSLA}
              title="Demo trick: simulate reminders/escalation by advancing statuses"
            >
              ⏩ Fast-forward SLA
            </button>
            <button className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm" onClick={generateAuditPack}>
              Generate Audit Pack
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3 flex gap-2">
          {showCommand && (
            <button
              className={cx(
                "px-3 py-2 rounded-lg text-sm border",
                view === "command" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
              )}
              onClick={() => setView("command")}
            >
              Command Center
            </button>
          )}

          {showInbox && (
            <button
              className={cx(
                "px-3 py-2 rounded-lg text-sm border",
                view === "inbox" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
              )}
              onClick={() => setView("inbox")}
            >
              POC Task Inbox
            </button>
          )}

          {showRespond && (
            <button
              className={cx(
                "px-3 py-2 rounded-lg text-sm border",
                view === "respond" ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
              )}
              onClick={() => setView("respond")}
              disabled={activeRole === "Domain POC" && !selected}
              title={activeRole === "Domain POC" && !selected ? "No tasks assigned to this POC" : ""}
            >
              Respond
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {view === "command" && showCommand && (
          <>
            <SectionTitle
              title="Audit Command Center"
              subtitle={activeRole === "Executive Viewer" ? "Leadership view (read-only)" : "Real-time status across domains and SLAs (mock data)"}
            />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Card label="Progress" value={`${stats.pct}%`} sub={`Completed: ${stats.completed}/${stats.total}`} />
              <Card label="Overdue" value={`${stats.overdue}`} sub="Needs escalation" emphasis={stats.overdue > 0} />
              <Card label="In Progress" value={`${stats.inProgress}`} sub="Active responses" />
              <Card
                label="Non-compliance flags"
                value={`${stats.nonCompliances}`}
                sub="Across all questions"
                emphasis={stats.nonCompliances > 0}
              />
              <Card label="Evidence uploaded" value={`${stats.evidenceCount}`} sub="Files attached" />
            </div>

            <div className="mt-4 bg-white border rounded-2xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Overall Completion</span>
                <span className="text-slate-500">{stats.pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="bg-slate-900 h-3 rounded-full" style={{ width: `${stats.pct}%` }}></div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Domain Status</div>
                  <div className="text-xs text-slate-500">Due date: {state.audit.dueDate}</div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2">Domain</th>
                        <th>Assignee</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Last Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.assignments.map((a) => {
                        const d = domainById[a.domainId];
                        return (
                          <tr key={a.id} className="border-t">
                            <td className="py-2 font-medium">{d?.name}</td>
                            <td>{a.assignee}</td>
                            <td>
                              <StatusChip status={a.status} />
                            </td>
                            <td>{a.dueDate}</td>
                            <td className="text-slate-500">{a.lastUpdated}</td>
                            <td className="text-right">
                              <button
                                className="px-2 py-1 rounded-lg border bg-white hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedAssignmentId(a.id);
                                  setView("respond");
                                }}
                                disabled={activeRole === "Executive Viewer"}
                                title={activeRole === "Executive Viewer" ? "Executive view is read-only" : ""}
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-4">
                <div className="font-semibold mb-2">Audit Trail (demo)</div>
                <div className="text-sm text-slate-600 space-y-2">
                  <TimelineItem time="09:40" text="Audit created from intake form" />
                  <TimelineItem time="09:41" text="Questions assigned to domain POCs (auto-mapped)" />
                  <TimelineItem time="10:12" text="Legal updated responses + attached evidence" />
                  <TimelineItem time="17:40" text="Infosec flagged non-compliance (MFA rollout)" />
                  <TimelineItem time="Now" text="Dashboard refreshed in real-time" />
                </div>
              </div>
            </div>
          </>
        )}

        {view === "inbox" && showInbox && (
          <>
            <SectionTitle
              title="POC Task Inbox"
              subtitle={
                activeRole === "Domain POC"
                  ? `Logged in as ${activePocName} • Only assigned items are visible`
                  : "What each domain owner sees (deep-link experience)"
              }
            />

            <div className="bg-white border rounded-2xl p-4">
              <div className="text-sm text-slate-500 mb-3">Tip: click any task to open the response view.</div>

              {visibleAssignments.length === 0 ? (
                <div className="border rounded-2xl p-6 bg-slate-50 text-slate-700">
                  No tasks assigned to <span className="font-medium">{activePocName}</span> in this demo dataset.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleAssignments.map((a) => {
                    const d = domainById[a.domainId];
                    return (
                      <button
                        key={a.id}
                        className="text-left bg-slate-50 hover:bg-slate-100 border rounded-2xl p-4"
                        onClick={() => {
                          setSelectedAssignmentId(a.id);
                          setView("respond");
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{d?.name}</div>
                          <StatusChip status={a.status} />
                        </div>
                        <div className="text-sm text-slate-600 mt-1">Assignee: {a.assignee}</div>
                        <div className="text-sm text-slate-600">Due: {a.dueDate}</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {a.questions.length} questions • Last updated: {a.lastUpdated}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {view === "respond" && showRespond && selected && (
          <>
            <SectionTitle
              title="Respond to Assigned Questions"
              subtitle={`Domain: ${domainById[selected.domainId]?.name} • Assignee: ${selected.assignee} • Due: ${selected.dueDate}`}
            />

            <div className="bg-white border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusChip status={selected.status} />
                  <div className="text-sm text-slate-500">Last updated: {selected.lastUpdated}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                    onClick={() => setView("inbox")}
                  >
                    Back to Inbox
                  </button>

                  <button
                    className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                    onClick={() => alert("Demo: Reassign to another POC")}
                    title="Mock action for demo"
                  >
                    Reassign
                  </button>

                  <button
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
                    onClick={markCompleted}
                  >
                    Mark Completed
                  </button>
                </div>
              </div>



              {/* ---------------------------------------------------------
                  Phase A (Live Write Path): POST /task-responses
                  This is a minimal, non-invasive panel so the demo UX stays intact.
                 --------------------------------------------------------- */}
              {Array.isArray(tasks) && tasks.length > 0 && (
                <div className="mt-4 border rounded-2xl p-4 bg-slate-50">
                  <div className="font-semibold">Live Backend: Save a Task Response</div>
                  <div className="text-sm text-slate-600 mt-1">
                    This writes to Supabase via Render (POST /task-responses). It does not change the demo assignment UI yet.

<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
  <span className={cx("px-2 py-1 rounded-full", loading ? "bg-amber-100 text-amber-800" : error ? "bg-red-100 text-red-800" : hasLiveData ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700")}>
    {loading ? "Loading…" : error ? "Backend error" : hasLiveData ? "Live data connected" : "No live data"}
  </span>
  <span className="text-slate-500">
    Runs: {Array.isArray(auditRuns) ? auditRuns.length : 0} · Tasks: {Array.isArray(tasks) ? tasks.length : 0}
  </span>
  {Array.isArray(auditRuns) && auditRuns.length > 0 && (
    <span className="text-slate-500">
      Latest run: {(auditRuns[0]?.id || auditRuns[0]?.audit_run_id || "").toString().slice(0, 12) || "—"}
    </span>
  )}
  {error ? <span className="text-red-700">{String(error)}</span> : null}
  <button
    className="ml-auto px-2 py-1 rounded-lg border bg-white hover:bg-slate-50"
    onClick={() => (typeof refresh === "function" ? refresh() : null)}
    type="button"
    title="Reload audit runs and tasks from backend"
  >
    Refresh
  </button>
</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <label className="text-xs text-slate-500">Live task</label>
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={liveTaskId}
                        onChange={(e) => setLiveTaskId(e.target.value)}
                      >
                        {tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {(t.title || "").slice(0, 50) || t.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-500">Response</label>
                      <input
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={liveResponseText}
                        onChange={(e) => setLiveResponseText(e.target.value)}
                        placeholder="Type a response to save to the backend…"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
                      disabled={liveSubmitState.status === "submitting"}
                      onClick={submitLiveResponse}
                    >
                      {liveSubmitState.status === "submitting" ? "Saving…" : "Save Response"}
                    </button>

                    {liveSubmitState.status !== "idle" && (
                      <div
                        className={cx(
                          "text-sm",
                          liveSubmitState.status === "success" ? "text-green-700" : liveSubmitState.status === "error" ? "text-red-700" : "text-slate-700"
                        )}
                      >
                        {liveSubmitState.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-4">
                {selected.questions.map((q) => {
                  const r = (selected.responses || {})[q.id] || { choice: "", text: "", evidence: [] };
                  return (
                    <div key={q.id} className="border rounded-2xl p-4">
                      <div className="font-medium">{q.text}</div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-500">Status</label>
                          <select
                            className="mt-1 w-full border rounded-lg px-3 py-2"
                            value={r.choice || ""}
                            onChange={(e) => updateResponse(q.id, { choice: e.target.value })}
                          >
                            <option value="">Select…</option>
                            <option value="Compliant">Compliant</option>
                            <option value="Non-Compliant">Non-Compliant</option>
                            <option value="Not Applicable">Not Applicable</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-slate-500">Comment</label>
                          <input
                            className="mt-1 w-full border rounded-lg px-3 py-2"
                            value={r.text || ""}
                            onChange={(e) => updateResponse(q.id, { text: e.target.value })}
                            placeholder="Add rationale / notes"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-500">Evidence</label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Type a filename and hit Enter (e.g., vuln_scan.pdf)"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const name = e.currentTarget.value.trim();
                                if (name) addEvidence(q.id, name);
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <button
                            className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm"
                            onClick={() => addEvidence(q.id, `evidence_${q.id}.pdf`)}
                            title="Mock upload"
                          >
                            + Mock Upload
                          </button>
                        </div>

                        {(r.evidence || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.evidence.map((f) => (
                              <span key={f} className="text-xs px-2 py-1 bg-slate-100 rounded-full">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, emphasis }) {
  return (
    <div className={cx("bg-white border rounded-2xl p-4", emphasis ? "border-red-300" : "")}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-sm text-slate-600 mt-1">{sub}</div>
    </div>
  );
}

function TimelineItem({ time, text }) {
  return (
    <div className="flex gap-3">
      <div className="w-12 text-xs text-slate-400">{time}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
