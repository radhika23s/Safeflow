import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserCog, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInsiderEmployees, getInsiderAlerts, type InsiderAlertRecord } from "@/lib/api";

const PATTERN_LABELS: Record<string, string> = {
  INSIDER_TERMINAL_BENEFICIARY: "Terminal Beneficiary",
  INSIDER_STRUCTURING: "Insider Structuring",
  INSIDER_CIRCULAR_INVOLVEMENT: "Circular via Employee",
  INSIDER_PROFILE_MISMATCH: "Profile Mismatch",
};

/**
 * Compact insider-risk summary for dashboard home pages.
 * Shows flagged-employee counts and the latest evidence-backed alerts,
 * with a link to the full Insider Risk workspace.
 */
export function InsiderSummaryWidget() {
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
  const alerts: InsiderAlertRecord[] = alertsQuery.data || [];
  const flagged = employees.filter((e) => e.open_alert_count > 0);
  const critical = alerts.filter((a) => a.severity === "CRITICAL" && a.status !== "RESOLVED" && a.status !== "DISMISSED");
  const latest = alerts.slice(0, 2);

  if (employeesQuery.isLoading || alertsQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading insider intelligence...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet/25 bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet border border-violet/25">
            <UserCog className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Insider Risk</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {flagged.length > 0
                ? `${flagged.length} employee${flagged.length > 1 ? "s" : ""} flagged`
                : "No employees flagged"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {critical.length} critical alert{critical.length === 1 ? "" : "s"} ·{" "}
              {employees.reduce((acc, e) => acc + e.account_links.filter((l) => !l.declared).length, 0)} undeclared linked
              accounts
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/insider"
          className="flex items-center gap-1 rounded-lg border border-violet/30 px-2.5 py-1.5 text-[11px] font-semibold text-violet transition-colors hover:bg-violet/10 shrink-0"
        >
          Workspace <ArrowRight className="size-3" />
        </Link>
      </div>

      {latest.length > 0 && (
        <div className="mt-3.5 space-y-2 border-t border-border pt-3">
          {latest.map((a) => (
            <div key={a.alert_id} className="flex items-start justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <span
                  className={cn(
                    "mr-1.5 inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase",
                    a.severity === "CRITICAL"
                      ? "bg-risk-high/15 text-risk-high"
                      : a.severity === "HIGH"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-violet/15 text-violet",
                  )}
                >
                  {a.severity}
                </span>
                <span className="font-semibold text-foreground">
                  {PATTERN_LABELS[a.pattern_type] || a.pattern_type}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {a.employee_name || a.employee_id}
                  {a.case_id ? " · " : ""}
                </span>
                {a.case_id && (
                  <Link to="/dashboard/cases/$caseId" params={{ caseId: a.case_id }} className="font-mono text-violet hover:underline">
                    {a.case_id}
                  </Link>
                )}
              </div>
              <ShieldAlert
                className={cn(
                  "size-3.5 shrink-0",
                  a.severity === "CRITICAL" ? "text-risk-high" : "text-amber-400",
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
