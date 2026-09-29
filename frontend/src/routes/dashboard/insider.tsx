import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserCog,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Link2,
  Clock,
  Fingerprint,
  Building2,
  KeyRound,
  Loader2,
  UserCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { cn } from "@/lib/utils";
import {
  getInsiderEmployees,
  getInsiderAlerts,
  getEmployeeTimeline,
  type InsiderEmployee,
  type InsiderAlertRecord,
  type InsiderEvidenceItem,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/insider")({
  component: InsiderRiskPage,
});

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-risk-high/40 bg-risk-high/10 text-risk-high",
  HIGH: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  MEDIUM: "border-violet/30 bg-violet/10 text-violet",
  NONE: "border-teal/30 bg-teal/5 text-teal",
};

const PATTERN_LABELS: Record<string, string> = {
  INSIDER_TERMINAL_BENEFICIARY: "Terminal Beneficiary (Employee-Linked)",
  INSIDER_STRUCTURING: "Insider-Assisted Structuring",
  INSIDER_CIRCULAR_INVOLVEMENT: "Circular Flow via Employee Account",
  INSIDER_PROFILE_MISMATCH: "Profile / Entitlement Mismatch",
};

function parseEvidence(e: InsiderAlertRecord["evidence"]): InsiderEvidenceItem[] {
  if (Array.isArray(e)) return e;
  if (typeof e === "string") {
    try {
      const parsed = JSON.parse(e);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ── Employee directory card ──────────────────────────────────────────────────

function EmployeeCard({ emp }: { emp: InsiderEmployee }) {
  const [open, setOpen] = useState(false);
  const flagged = emp.open_alert_count > 0;
  const undeclared = emp.account_links.filter((l) => !l.declared);

  return (
    <div className={cn("rounded-xl border bg-background", flagged ? SEVERITY_STYLES[emp.max_severity] : "border-border")}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              flagged ? "border-current/40 bg-current/10" : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {flagged ? <ShieldAlert className="size-4.5" /> : <UserCheck className="size-4.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground">{emp.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{emp.employee_id}</span>
              {flagged && (
                <span className="rounded-full border border-current px-1.5 py-px text-[9px] font-bold uppercase">
                  {emp.max_severity} · {emp.open_alert_count} alert{emp.open_alert_count > 1 ? "s" : ""}
                </span>
              )}
              {undeclared.length > 0 && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                  {undeclared.length} undeclared linked account{undeclared.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {emp.designation} · {emp.department} · {emp.branch_id} ({emp.branch_city})
            </p>
            {emp.alert_types.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-1">
                {emp.alert_types.map((t) => (
                  <span key={t} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                    {PATTERN_LABELS[t] || t}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="mt-1 size-4 shrink-0 opacity-60" /> : <ChevronDown className="mt-1 size-4 shrink-0 opacity-60" />}
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-3">
          {/* Access profile */}
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-muted-foreground">
              <KeyRound className="size-3" /> tier: {emp.access_tier}
            </span>
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-1 font-mono text-muted-foreground">
              <Building2 className="size-3" /> {emp.branch_id}
            </span>
            <span className="rounded bg-muted px-2 py-1 font-mono text-muted-foreground">rights: {emp.access_rights || "—"}</span>
          </div>

          {/* Account links */}
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Link2 className="size-3" /> Related-party account links ({emp.account_links.length})
            </p>
            <div className="mt-1.5 space-y-1">
              {emp.account_links.map((l) => (
                <div key={l.account_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono text-violet">{l.account_id}</span>
                  <span className="text-muted-foreground">{l.relationship.toLowerCase()}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-px text-[9px] font-bold uppercase",
                      l.declared ? "bg-teal/10 text-teal" : "bg-risk-high/15 text-risk-high",
                    )}
                  >
                    {l.declared ? "declared" : "UNDECLARED"}
                  </span>
                </div>
              ))}
              {emp.account_links.length === 0 && <p className="text-[11px] text-muted-foreground">No linked accounts on record.</p>}
            </div>
          </div>

          {/* Case jump links */}
          {flagged && <EmployeeAlerts employeeId={emp.employee_id} />}
        </div>
      )}
    </div>
  );
}

function EmployeeAlerts({ employeeId }: { employeeId: string }) {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["insider-alerts"],
    queryFn: () => getInsiderAlerts(),
    staleTime: 30_000,
  });
  const mine = (alerts || []).filter((a) => a.employee_id === employeeId);
  if (isLoading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (mine.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Fingerprint className="size-3" /> Linked investigation cases
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {mine.map((a) =>
          a.case_id ? (
            <Link
              key={a.alert_id}
              to="/dashboard/cases/$caseId"
              params={{ caseId: a.case_id }}
              className="rounded-lg border border-violet/30 bg-violet/5 px-2.5 py-1.5 text-[11px] font-semibold text-violet transition-colors hover:bg-violet/10"
            >
              {a.case_id} · {PATTERN_LABELS[a.pattern_type] || a.pattern_type}
            </Link>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ── Timeline drill-down ──────────────────────────────────────────────────────

function TimelineDrillDown({ employees }: { employees: InsiderEmployee[] }) {
  const flagged = employees.filter((e) => e.open_alert_count > 0);
  const [selected, setSelected] = useState<string | null>(null);
  const active = flagged.find((e) => e.employee_id === selected) || null;

  const { data, isLoading } = useQuery({
    queryKey: ["employee-timeline", selected],
    queryFn: () => getEmployeeTimeline(selected!),
    enabled: Boolean(selected),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
      <div className="flex items-start gap-2.5 border-b border-border pb-3">
        <Clock className="mt-0.5 size-5 text-violet" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-mono">
            Employee Activity Drill-Down
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">Access Events × Linked-Account Flow</h2>
        </div>
      </div>

      {flagged.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No flagged employees — timeline drill-down unavailable.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {flagged.map((e) => (
              <button
                key={e.employee_id}
                type="button"
                onClick={() => setSelected(e.employee_id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                  selected === e.employee_id
                    ? "border-violet bg-violet/10 text-violet"
                    : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                {e.name} ({e.employee_id})
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-4">
              {isLoading ? (
                <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading timeline...
                </div>
              ) : data ? (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Linked accounts: <span className="font-mono text-violet">{data.linked_accounts.join(", ") || "—"}</span> ·{" "}
                    {data.total_events} events
                  </p>
                  <div className="relative mt-3 max-h-96 space-y-2.5 overflow-y-auto pl-4 pr-1">
                    <div className="absolute bottom-1 left-1 top-1 w-px bg-border" aria-hidden="true" />
                    {data.events.map((ev, i) => (
                      <div key={`${ev.kind}-${i}`} className="relative">
                        <div
                          className={cn(
                            "absolute -left-[11px] top-2 size-2 rounded-full border",
                            ev.kind === "LINKED_ACCOUNT_FLOW"
                              ? "border-amber-500 bg-amber-500/40"
                              : "border-violet bg-violet/40",
                          )}
                          aria-hidden="true"
                        />
                        <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span
                              className={cn(
                                "rounded px-1.5 py-px font-mono font-bold uppercase",
                                ev.kind === "LINKED_ACCOUNT_FLOW" ? "bg-amber-500/15 text-amber-400" : "bg-violet/15 text-violet",
                              )}
                            >
                              {ev.kind === "LINKED_ACCOUNT_FLOW" ? ev.action || "flow" : ev.action || "access"}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </span>
                            {ev.entity_ref && <span className="font-mono text-muted-foreground">· {ev.entity_ref}</span>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-foreground/90">{ev.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function InsiderRiskPage() {
  const employeesQuery = useQuery({
    queryKey: ["insider-employees"],
    queryFn: getInsiderEmployees,
    staleTime: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ["insider-alerts"],
    queryFn: () => getInsiderAlerts(),
    staleTime: 30_000,
  });

  const employees = employeesQuery.data || [];
  const alerts = alertsQuery.data || [];
  const flagged = employees.filter((e) => e.open_alert_count > 0);
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");
  const undeclaredCount = employees.reduce(
    (acc, e) => acc + e.account_links.filter((l) => !l.declared).length,
    0,
  );

  return (
    <DashboardLayout title="Insider Risk — Employee × Money-Flow Intelligence">
      <div className="space-y-6">
        {/* Header stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Employees Monitored</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{employees.length}</p>
          </div>
          <div className="rounded-2xl border border-risk-high/30 bg-risk-high/5 p-4">
            <p className="text-[10px] uppercase font-mono tracking-wider text-risk-high">Flagged Staff</p>
            <p className="mt-1 text-2xl font-bold text-risk-high">{flagged.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-[10px] uppercase font-mono tracking-wider text-amber-400">Critical Alerts</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">{criticalAlerts.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Undeclared Accounts</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{undeclaredCount}</p>
          </div>
        </div>

        {/* Alerts feed */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-2.5 border-b border-border pb-3">
            <UserCog className="mt-0.5 size-5 text-violet" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-mono">
                Insider Alerts Feed
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-foreground">Evidence-Backed Employee Risk Findings</h2>
            </div>
          </div>
          {alertsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No insider alerts. Open a case workspace to run insider correlation on the money-flow graph.
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {alerts.map((a) => (
                <div key={a.alert_id} className={cn("rounded-xl border p-3", SEVERITY_STYLES[a.severity] || SEVERITY_STYLES["MEDIUM"])}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold">{PATTERN_LABELS[a.pattern_type] || a.pattern_type}</span>
                    <span className="rounded-full border border-current px-1.5 py-px text-[9px] font-bold uppercase">{a.severity}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.employee_name || a.employee_id}
                      {a.designation ? ` · ${a.designation}` : ""}
                    </span>
                    {a.case_id && (
                      <Link
                        to="/dashboard/cases/$caseId"
                        params={{ caseId: a.case_id }}
                        className="ml-auto font-mono text-[10px] font-semibold text-violet hover:underline"
                      >
                        {a.case_id} →
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/90">{a.explanation}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {parseEvidence(a.evidence).slice(0, 4).map((e, i) => (
                      <span key={i} className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {e.type}: {e.ref}
                      </span>
                    ))}
                    {parseEvidence(a.evidence).length > 4 && (
                      <span className="rounded bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        +{parseEvidence(a.evidence).length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee directory */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-2.5 border-b border-border pb-3">
            <KeyRound className="mt-0.5 size-5 text-violet" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-mono">
                Employee & Access Directory
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-foreground">Staff, Entitlements & Related-Party Links</h2>
            </div>
          </div>
          {employeesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading employees...
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {employees.map((emp) => (
                <EmployeeCard key={emp.employee_id} emp={emp} />
              ))}
            </div>
          )}
        </div>

        {/* Timeline drill-down */}
        <TimelineDrillDown employees={employees} />
      </div>
    </DashboardLayout>
  );
}
