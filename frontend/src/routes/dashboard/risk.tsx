import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RiskIntelligencePanel } from "@/components/investigation/RiskIntelligencePanel";
import { demoCase } from "@/data/mock-investigation";

export const Route = createFileRoute("/dashboard/risk")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/cases" });
  },
  component: RiskPage,
});

function RiskPage() {
  return (
    <DashboardLayout title="Risk Intelligence Center">
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-risk-high/10 text-risk-high">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Risk Engine Intelligence</h2>
              <p className="text-xs text-muted-foreground">Multi-dimensional risk scoring, typologies, and explainable AI breakdown.</p>
            </div>
          </div>
        </div>

        <RiskIntelligencePanel risk={demoCase.risk} />
      </div>
    </DashboardLayout>
  );
}
