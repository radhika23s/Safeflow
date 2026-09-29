import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck, Key, ShieldAlert } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export const Route = createFileRoute("/dashboard/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <DashboardLayout title="Security & Authentication Policies">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Platform Security Controls</h2>
              <p className="text-xs text-muted-foreground">Configure access security, SSO integration, session management, and encryption standards.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <ShieldCheck className="size-6 text-teal" />
            <h3 className="font-semibold text-foreground text-sm">Enterprise Single Sign-On (SSO)</h3>
            <p className="text-xs text-muted-foreground">OIDC / SAML 2.0 Identity Provider authentication connected to corporate Active Directory.</p>
            <span className="inline-block text-[11px] font-semibold text-teal bg-teal/10 px-2.5 py-1 rounded-full">Enforced</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <Key className="size-6 text-violet" />
            <h3 className="font-semibold text-foreground text-sm">Role-Based Access Control (RBAC)</h3>
            <p className="text-xs text-muted-foreground">Granular permission scoping for Investigators, Managers, and Administrators.</p>
            <span className="inline-block text-[11px] font-semibold text-violet bg-violet/10 px-2.5 py-1 rounded-full">Active</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
