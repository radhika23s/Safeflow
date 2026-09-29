import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export const Route = createFileRoute("/dashboard/roles")({
  component: RolesPage,
});

function RolesPage() {
  return (
    <DashboardLayout title="Roles & Permissions Configuration">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Access Scoping & RBAC Rules</h2>
              <p className="text-xs text-muted-foreground">Configure custom role privileges, SAR submission rights, and data access tiers.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Investigator Role</h3>
              <span className="text-xs font-bold text-teal bg-teal/10 px-2.5 py-0.5 rounded-full">Standard Scope</span>
            </div>
            <p className="text-xs text-muted-foreground">Can view assigned cases, run AI risk queries, compile evidence, and generate draft SAR reports.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Manager Role</h3>
              <span className="text-xs font-bold text-violet bg-violet/10 px-2.5 py-0.5 rounded-full">Elevated Scope</span>
            </div>
            <p className="text-xs text-muted-foreground">Can approve investigation sign-offs, manage escalations, reassign cases, and submit SARs to FinCEN.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Administrator Role</h3>
              <span className="text-xs font-bold text-risk-high bg-risk-high/10 px-2.5 py-0.5 rounded-full">Full System Scope</span>
            </div>
            <p className="text-xs text-muted-foreground">Full system access: user provisioning, security policies, system health monitoring, and audit log inspection.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
