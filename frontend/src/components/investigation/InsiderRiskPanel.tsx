import { useState } from "react";
import { UserCog, ChevronDown, ChevronUp, Link2, Clock, Fingerprint, ShieldAlert, Gavel, CheckCircle2, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useRole } from "@/context/RoleContext";
import { insiderAlertAction, type AlertLifecycleResponse } from "@/lib/api";

export interface InsiderEvidenceItem {
  type: string;
  ref: string;
  detail: string;
}

export interface InsiderAlert {
  alert_id: string;
  employee_id: string;
  pattern_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | string;
  evidence: InsiderEvidenceItem[];
  explanation: string;
  employee_name?: string;
  designation?: string;
  status?: string;
}

export interface TimelineEvent {
  ts: string | null;
  kind: "TRANSACTION" | "EMPLOYEE_ACCESS" | "LINKED_ACCOUNT_FLOW" | string;
  ref: string;
  actor?: string | null;
  actor_name?: string;
  action?: string;
  detail: string;
}

const PATTERN_LABELS: Record<string, string> = {
  INSIDER_TERMINAL_BENEFICIARY: "Terminal Beneficiary (Employee-Linked)",
  INSIDER_STRUCTURING: "Insider-Assisted Structuring",
  INSIDER_CIRCULAR_INVOLVEMENT: "Circular Flow via Employee Account",
  INSIDER_PROFILE_MISMATCH: "Profile / Entitlement Mismatch",
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-risk-high/40 bg-risk-high/10 text-risk-high",
  HIGH: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  MEDIUM: "border-violet/30 bg-violet/10 text-violet",
};

function EvidenceChain({ evidence }: { evidence: InsiderEvidenceItem[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Fingerprint className="size-3" /> Evidence chain ({evidence.length})
      </p>
      {evidence.map((e, i) => (
        <div
          key={`${e.type}-${e.ref}-${i}`}
          className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-2"
        >
          <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-muted-foreground shrink-0">
            {e.type.replace(/_/g, " ")}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-violet">{e.ref}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">{e.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-background/70 text-foreground/80",
  CLAIMED: "bg-violet/15 text-violet",
  ESCALATED: "bg-risk-high/15 text-risk-high",
  DISMISSED: "bg-muted text-muted-foreground",
  RESOLVED: "bg-teal/15 text-teal",
};

function InsiderAlertCard({ alert, onStatusChange }: { alert: InsiderAlert; onStatusChange?: (alertId: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = alert.status || "OPEN";

  const act = async (action: "CLAIM" | "ESCALATE" | "DISMISS" | "RESOLVE" | "REOPEN") => {
    setBusy(action);
    setError(null);
    try {
      const res: AlertLifecycleResponse = await insiderAlertAction(alert.alert_id, action);
      onStatusChange?.(alert.alert_id, res.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("rounded-xl border p-3", SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES["MEDIUM"])}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold">{PATTERN_LABELS[alert.pattern_type] || alert.pattern_type}</span>
            <span className="rounded-full border border-current px-1.5 py-px text-[9px] font-bold uppercase">{alert.severity}</span>
            <span className={cn("rounded px-1.5 py-px text-[9px] font-bold uppercase", STATUS_STYLES[status] || STATUS_STYLES["OPEN"])}>{status}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {alert.employee_name ? `${alert.employee_name} · ${alert.designation} · ` : ""}
            <span className="font-mono">{alert.employee_id}</span>
          </p>
        </div>
        {open ? <ChevronUp className="size-4 shrink-0 opacity-60" /> : <ChevronDown className="size-4 shrink-0 opacity-60" />}
      </button>
      {open && (
        <div className="mt-2 border-t border-current/20 pt-2">
          <p className="text-[11px] leading-relaxed text-foreground">{alert.explanation}</p>
          <EvidenceChain evidence={alert.evidence || []} />
          <AlertActions alert={alert} status={status} busy={busy} error={error} onAct={act} />
        </div>
      )}
    </div>
  );
}

function AlertActions({
  alert,
  status,
  busy,
  error,
  onAct,
}: {
  alert: InsiderAlert;
  status: string;
  busy: string | null;
  error: string | null;
  onAct: (action: "CLAIM" | "ESCALATE" | "DISMISS" | "RESOLVE" | "REOPEN") => void;
}) {
  const canClaim = status === "OPEN" || status === "CLAIMED";
  const canEscalate = status === "OPEN" || status === "CLAIMED" || status === "ESCALATED";
  const canResolve = status === "CLAIMED" || status === "ESCALATED";
  const canReopen = status === "DISMISSED" || status === "RESOLVED";
  const canDismiss = status === "OPEN" || status === "CLAIMED" || status === "ESCALATED";

  // RBAC: matrix in lib/permissions.ts, enforced by backend/routers/insider.py.
  const { role } = useRole();
  const mayClaim = can(role, "insider.claim");
  const mayEscalate = can(role, "insider.escalate");
  const mayResolve = can(role, "insider.resolve");
  const mayReopen = can(role, "insider.reopen");
  const mayDismiss = can(role, "insider.dismiss");
  const isViewOnly = !mayClaim && !mayEscalate && !mayResolve && !mayReopen && !mayDismiss;

  if (isViewOnly) {
    return (
      <div className="mt-2.5 rounded-lg border border-border/60 bg-background/60 p-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Gavel className="size-3" /> Reviewer Actions
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="size-3 shrink-0" />
          View-only (3rd Line): alert lifecycle actions belong to Investigators and Managers.
        </p>
      </div>
    );
  }

  if (!canClaim && !canEscalate && !canResolve && !canReopen && !canDismiss) return null;

  return (
    <div className="mt-2.5 rounded-lg border border-border/60 bg-background/60 p-2">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Gavel className="size-3" /> Reviewer Actions
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {canClaim && status === "OPEN" && mayClaim && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onAct("CLAIM")}
            className="rounded-lg border border-violet/40 px-2 py-1 text-[10px] font-semibold text-violet transition-colors hover:bg-violet/10 disabled:opacity-50"
          >
            {busy === "CLAIM" ? <Loader2 className="size-3 animate-spin" /> : "Claim"}
          </button>
        )}
        {canEscalate && mayEscalate && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onAct("ESCALATE")}
            className="rounded-lg border border-risk-high/40 px-2 py-1 text-[10px] font-semibold text-risk-high transition-colors hover:bg-risk-high/10 disabled:opacity-50"
          >
            {busy === "ESCALATE" ? <Loader2 className="size-3 animate-spin" /> : "Escalate"}
          </button>
        )}
        {canResolve && mayResolve && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onAct("RESOLVE")}
            className="flex items-center gap-1 rounded-lg border border-teal/40 px-2 py-1 text-[10px] font-semibold text-teal transition-colors hover:bg-teal/10 disabled:opacity-50"
          >
            {busy === "RESOLVE" ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            Resolve (Manager)
          </button>
        )}
        {canReopen && mayReopen && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onAct("REOPEN")}
            className="rounded-lg border border-amber-500/40 px-2 py-1 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
          >
            Reopen (Manager)
          </button>
        )}
        {canDismiss && mayDismiss && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onAct("DISMISS")}
            className="rounded-lg border border-muted-foreground/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            Dismiss (Manager)
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[10px] text-amber-400">{error}</p>}
    </div>
  );
}

function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative space-y-2.5 pl-4">
      <div className="absolute left-1 top-1 bottom-1 w-px bg-border" aria-hidden="true" />
      {events.map((e, i) => (
        <div key={`${e.kind}-${e.ref}-${i}`} className="relative">
          <div
            className={cn(
              "absolute -left-[11px] top-1.5 size-2 rounded-full border",
              e.kind === "TRANSACTION"
                ? "border-risk-high bg-risk-high/40"
                : e.kind === "LINKED_ACCOUNT_FLOW"
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
                  e.kind === "TRANSACTION"
                    ? "bg-risk-high/15 text-risk-high"
                    : e.kind === "LINKED_ACCOUNT_FLOW"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-violet/15 text-violet",
                )}
              >
                {e.kind === "EMPLOYEE_ACCESS" ? e.action || "access" : e.kind.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-muted-foreground">
                {e.ts ? new Date(e.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
              </span>
              {e.actor && (
                <span className="text-muted-foreground">
                  · {e.actor_name || e.actor}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-foreground/90">{e.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsiderRiskPanel({
  alerts = [],
  timeline = [],
}: {
  alerts?: InsiderAlert[] | null | undefined;
  timeline?: TimelineEvent[] | null | undefined;
}) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const hasAlerts = alerts && alerts.length > 0;
  const maxSeverity = hasAlerts
    ? alerts.some((a) => a.severity === "CRITICAL")
      ? "CRITICAL"
      : alerts.some((a) => a.severity === "HIGH")
        ? "HIGH"
        : "MEDIUM"
    : null;

  if (!hasAlerts && (!timeline || timeline.length === 0)) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <UserCog className="size-5 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-mono">
              Insider Risk Correlation
            </p>
            <h2 className="mt-0.5 text-sm font-bold text-foreground">No employee-linked anomalies</h2>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Employees, access rights and related-party accounts were checked against this money flow. No insider signals detected.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-xs" aria-labelledby="insider-risk-title">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-start gap-2.5">
          <UserCog className="mt-0.5 size-5 text-violet" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-mono">
              Insider Risk Correlation
            </p>
            <h2 id="insider-risk-title" className="mt-0.5 text-lg font-bold text-foreground">
              Employee × Money-Flow Evidence
            </h2>
          </div>
        </div>
        {maxSeverity && (
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", SEVERITY_STYLES[maxSeverity])}>
            <ShieldAlert className="size-3" />
            {maxSeverity} · {alerts!.length} alert{alerts!.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2.5">
        {hasAlerts ? (
          alerts!.map((a) => {
            const withStatus = { ...a, status: statusOverrides[a.alert_id] ?? a.status ?? "OPEN" };
            return (
              <InsiderAlertCard
                key={a.alert_id}
                alert={withStatus}
                onStatusChange={(alertId, status) =>
                  setStatusOverrides((prev) => ({ ...prev, [alertId]: status }))
                }
              />
            );
          })
        ) : (
          <p className="text-[11px] text-muted-foreground">No insider alerts for this case.</p>
        )}
      </div>

      {timeline && timeline.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3.5" />
              Activity Timeline · Employee Actions + Money Flow ({timeline.length})
            </span>
            {showTimeline ? <ChevronUp className="size-4 opacity-60" /> : <ChevronDown className="size-4 opacity-60" />}
          </button>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2 className="size-3" />
            Links employee access events (logins, overrides, profile changes) to account & transaction changes.
          </p>
          {showTimeline && <div className="mt-3 max-h-96 overflow-y-auto pr-1"><ActivityTimeline events={timeline} /></div>}
        </div>
      )}
    </section>
  );
}
