import { createFileRoute, redirect } from "@tanstack/react-router";
import { Eye, Radio } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export const Route = createFileRoute("/dashboard/threat")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/cases" });
  },
  component: ThreatAliasPage,
});

function ThreatAliasPage() {
  return (
    <DashboardLayout title="Threat Watch & Real-time Signals">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-risk-high/10 text-risk-high">
              <Eye className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Global Financial Threat Watch</h2>
              <p className="text-xs text-muted-foreground">Real-time fraud network detection and illicit activity telemetry.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-risk-high/10 text-risk-high animate-pulse">
            <Radio className="size-3.5" />
            Live Threat Stream
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
