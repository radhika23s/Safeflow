import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InsiderAuditTrail } from "@/components/dashboard/InsiderAuditTrail";
import { getAuditLog } from "@/lib/api";

export const Route = createFileRoute("/dashboard/audit-logs")({
  component: AuditLogsPage,
});

const mockAuditEvents = [
  { id: "AUD-9081", action: "Case Decision Submitted", user: "Marcus Johnson (Investigator)", target: "Case FC-2026-00421", time: "10 mins ago" },
  { id: "AUD-9079", action: "Manager Sign-Off Approved", user: "Sarah Chen (Manager)", target: "Case FC-2026-00418", time: "42 mins ago" },
  { id: "AUD-9072", action: "User Role Modified", user: "Alex Chen (Admin)", target: "David Rodriguez -> Manager", time: "2 hours ago" },
  { id: "AUD-9065", action: "Risk Model Threshold Updated", user: "Alex Chen (Admin)", target: "Medium Risk Threshold 40 -> 45", time: "5 hours ago" },
];

function AuditLogsPage() {
  const { data: apiLogs, isLoading, isError } = useQuery({
    queryKey: ["auditLog"],
    queryFn: () => getAuditLog(),
    retry: 1,
    staleTime: 10_000,
  });

  const auditEvents = apiLogs && apiLogs.length > 0
    ? apiLogs.map((log) => ({
        id: `AUD-${log.id}`,
        action: log.action,
        user: log.actor || "SYSTEM",
        target: log.case_id,
        time: new Date(log.timestamp).toLocaleString(),
      }))
    : mockAuditEvents;

  return (
    <DashboardLayout title="System Audit Logs & Security Trail">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <History className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Immutable Audit Trail (Admin)</h2>
              <p className="text-xs text-muted-foreground">
                {apiLogs
                  ? `${apiLogs.length} events logged in database`
                  : isLoading
                    ? "Connecting to backend..."
                    : "Showing demo audit trail"}
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Loading audit logs...</span>
          </div>
        )}

        <InsiderAuditTrail />

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 text-left">Event ID</th>
                  <th className="px-6 py-4 text-left">Action</th>
                  <th className="px-6 py-4 text-left">User / Actor</th>
                  <th className="px-6 py-4 text-left">Case / Target</th>
                  <th className="px-6 py-4 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono font-medium text-violet">{evt.id}</td>
                    <td className="px-6 py-4 font-semibold text-foreground text-xs">{evt.action}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{evt.user}</td>
                    <td className="px-6 py-4 text-xs text-foreground">{evt.target}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{evt.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isError && (
          <p className="text-center text-xs text-muted-foreground">
            ⚠ Backend offline — displaying local demo data
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
