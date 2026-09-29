import { createFileRoute, redirect } from "@tanstack/react-router";
import { Eye, AlertTriangle, ShieldAlert, Radio } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export const Route = createFileRoute("/dashboard/threats")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/cases" });
  },
  component: ThreatsPage,
});

const threatSignals = [
  { id: "THR-901", title: "Automated Mule Account Network Detected", severity: "HIGH", region: "North America", time: "10 mins ago" },
  { id: "THR-899", title: "Crypto Tumbler Anonymization Spike", severity: "HIGH", region: "Eastern Europe", time: "25 mins ago" },
  { id: "THR-894", title: "Layering Velocity Anomaly on Shell Entities", severity: "MEDIUM", region: "Asia Pacific", time: "1 hour ago" },
];

function ThreatsPage() {
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

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Active Threat Vectors</h3>
          <div className="space-y-3">
            {threatSignals.map((signal) => (
              <div key={signal.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-5 text-risk-high mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{signal.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-risk-high/10 text-risk-high">
                        {signal.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Ref: {signal.id} · Region: {signal.region}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{signal.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
