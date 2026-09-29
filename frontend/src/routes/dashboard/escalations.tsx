import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, AlertTriangle, ArrowUpRight, ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/escalations")({
  component: EscalationsPage,
});

const escalationsList = [
  {
    id: "FC-2026-00421",
    title: "Layered Structuring & High-Risk Offshore Transfers",
    risk: "CRITICAL",
    score: 84,
    escalatedBy: "Marcus Johnson",
    reason: "High transaction velocity exceeding SAR filing criteria",
    time: "30 mins ago",
  },
  {
    id: "FC-2026-00415",
    title: "PEP Related Wire Transfer Anomaly",
    risk: "HIGH",
    score: 79,
    escalatedBy: "Priya Patel",
    reason: "Politically Exposed Person sanction match confirmed",
    time: "2 hours ago",
  },
];

function EscalationsPage() {
  return (
    <DashboardLayout title="Manager Escalations Queue">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-risk-high/10 text-risk-high">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">High-Priority Escalations</h2>
              <p className="text-xs text-muted-foreground">Cases requiring urgent senior management review or SAR decisioning.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {escalationsList.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Link
                    to="/dashboard/cases/$caseId"
                    params={{ caseId: item.id }}
                    className="font-bold text-violet hover:underline text-base"
                  >
                    {item.id}
                  </Link>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-risk-high/10 text-risk-high">
                    {item.risk} ({item.score}/100)
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">Reason: {item.reason} · Escalated by {item.escalatedBy} ({item.time})</p>
              </div>

              <Button asChild size="sm" variant="default" className="text-xs gap-1 flex-shrink-0">
                <Link to="/dashboard/cases/$caseId" params={{ caseId: item.id }}>
                  Open Case Workspace
                  <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
