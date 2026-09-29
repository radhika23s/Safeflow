import { createFileRoute } from "@tanstack/react-router";
import { Settings, Sliders, Shield, Bell, Key, Database } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useRole } from "@/context/RoleContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { role, user } = useRole();

  return (
    <DashboardLayout title="Workspace Settings">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Settings className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Platform Configuration</h2>
              <p className="text-xs text-muted-foreground">Manage your account preferences, threshold parameters, and security policies.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* User Preferences */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="size-4 text-violet" />
              Active Session Profile
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-muted-foreground">Full Name</span>
                <p className="font-semibold text-foreground mt-1">{user.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Role</span>
                <p className="font-semibold text-foreground mt-1 capitalize">{role}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Work Email</span>
                <p className="font-semibold text-foreground mt-1">{user.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Environment</span>
                <p className="font-semibold text-teal mt-1">Protected Demo Environment</p>
              </div>
            </div>
          </div>

          {/* AI Risk Engine Parameters */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sliders className="size-4 text-violet" />
              AI Risk Scoring Parameters
            </h3>
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">High-Risk Alert Threshold</p>
                  <p className="text-muted-foreground">Trigger immediate senior manager escalation above score</p>
                </div>
                <span className="font-bold text-foreground bg-muted px-3 py-1 rounded-lg">75 / 100</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Automated Sanctions Screening</p>
                  <p className="text-muted-foreground">Real-time match check on beneficiary transactions</p>
                </div>
                <span className="font-semibold text-teal bg-teal/10 px-2.5 py-1 rounded-full">Enabled</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-foreground">Audit Log Retention</p>
                  <p className="text-muted-foreground">Regulatory compliance log archiving period</p>
                </div>
                <span className="font-bold text-foreground bg-muted px-3 py-1 rounded-lg">7 Years</span>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-xs">
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
