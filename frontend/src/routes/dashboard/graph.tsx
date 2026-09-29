import { createFileRoute, redirect } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InvestigationGraph } from "@/components/investigation/InvestigationGraph";
import { graphNodes, graphEdges } from "@/data/mock-investigation";

export const Route = createFileRoute("/dashboard/graph")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/cases" });
  },
  component: GraphPage,
});

function GraphPage() {
  return (
    <DashboardLayout title="Transaction Network Graph">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Network className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Multi-Hop Entity Link Graph</h2>
              <p className="text-xs text-muted-foreground">Interactive visualization of funds flow, counterparties, shell companies, and high-risk nodes.</p>
            </div>
          </div>
        </div>

        <InvestigationGraph nodes={graphNodes} edges={graphEdges} />
      </div>
    </DashboardLayout>
  );
}
