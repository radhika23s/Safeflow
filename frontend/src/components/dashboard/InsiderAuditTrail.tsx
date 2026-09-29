import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInsiderAuditTrail, type InsiderAuditEvent } from "@/lib/api";

const ACTION_META: Record<string, { label: string; className: string }> = {
  INSIDER_ALERT_CLAIMED: { label: "Alert Claimed", className: "bg-violet/15 text-violet border-violet/30" },
  INSIDER_ALERT_ESCALATED: { label: "Alert Escalated", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  INSIDER_ALERT_DISMISSED: { label: "Alert Dismissed", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  INSIDER_ALERT_RESOLVED: { label: "Alert Resolved", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  INSIDER_ALERT_REOPENED: { label: "Alert Reopened", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  INSIDER_ALERT_OPENED: { label: "Alert Opened", className: "bg-risk-high/15 text-risk-high border-risk-high/30" },
};

/** Extract the alert id from a lifecycle audit detail string. */
function extractAlertId(details: string): string | null {
  return details.match(/Insider alert (INS-[A-Z0-9-]+)/)?.[1] || null;
}

/** Insider lifecycle events from the immutable audit trail (CLAIM/ESCALATE/RESOLVE...). */
export function InsiderAuditTrail() {
  const { data: events, isLoading, isError } = useQuery({
    queryKey: ["insider-audit-trail"],
    queryFn: getInsiderAuditTrail,
    retry: 1,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Loading insider audit trail...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-violet" />
          <h2 className="text-base font-semibold text-foreground">Insider Alert Lifecycle Trail</h2>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          ⚠ Backend offline — insider lifecycle events unavailable
        </p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No insider lifecycle events yet. Claim, escalate, dismiss, or resolve an insider alert from the{" "}
        <span className="font-semibold text-foreground">Insider Risk workspace</span> and transitions will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet/25 bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-violet/10 text-violet border border-violet/25">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Insider Alert Lifecycle Trail</h2>
          <p className="text-[11px] text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"} from the immutable audit log
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 text-left">Transition</th>
              <th className="px-6 py-3 text-left">Actor</th>
              <th className="px-6 py-3 text-left">Case</th>
              <th className="px-6 py-3 text-left">Alert</th>
              <th className="px-6 py-3 text-left">Timestamp</th>
              <th className="px-6 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((evt) => {
              const meta = ACTION_META[evt.action] || {
                label: evt.action,
                className: "bg-violet/15 text-violet border-violet/30",
              };
              const alertId = extractAlertId(evt.details);
              return (
                <tr key={`${evt.log_id}-${evt.timestamp}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{evt.actor}</td>
                  <td className="px-6 py-3.5 text-xs font-mono text-violet">{evt.case_id || "—"}</td>
                  <td className="px-6 py-3.5 text-xs font-mono text-foreground">{alertId || "—"}</td>
                  <td className="px-6 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(evt.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-muted-foreground">{evt.details}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
