import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Check, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { cn } from "@/lib/utils";
import { ROLE_PERMISSIONS, type Permission, type RoleId } from "@/lib/permissions";

export const Route = createFileRoute("/dashboard/roles")({
  component: RolesPage,
});

const PERMISSION_GROUPS: { group: string; items: { label: string; perm: Permission }[] }[] = [
  {
    group: "Case Decisions (Maker–Checker)",
    items: [
      { label: "View cases & evidence", perm: "case.view" },
      { label: "Flag for monitoring", perm: "case.decide_flag" },
      { label: "Dismiss false positive", perm: "case.decide_dismiss" },
      { label: "Escalate to manager", perm: "case.decide_escalate" },
      { label: "Block & Report (freeze account)", perm: "case.decide_block" },
      { label: "Edit report / STR draft", perm: "case.update" },
    ],
  },
  {
    group: "Insider Risk Alerts",
    items: [
      { label: "Claim alert", perm: "insider.claim" },
      { label: "Escalate alert", perm: "insider.escalate" },
      { label: "Dismiss alert", perm: "insider.dismiss" },
      { label: "Resolve alert", perm: "insider.resolve" },
      { label: "Reopen alert", perm: "insider.reopen" },
    ],
  },
  {
    group: "Users & Administration",
    items: [
      { label: "View user directory", perm: "users.view" },
      { label: "Create / provision users", perm: "users.create" },
      { label: "Activate / deactivate users", perm: "users.status" },
      { label: "Manage platform settings", perm: "settings.manage" },
    ],
  },
  {
    group: "Reports & Regulatory Filings",
    items: [
      { label: "View reports", perm: "reports.view" },
      { label: "Draft STR / SAR", perm: "reports.draft" },
      { label: "Submit STR / SAR to FIU-IND", perm: "reports.submit" },
    ],
  },
  {
    group: "Audit Trail",
    items: [
      { label: "View own activity", perm: "audit.view_self" },
      { label: "View full audit trail", perm: "audit.view_all" },
    ],
  },
];

const ROLE_META: Record<RoleId, { label: string; tier: string; badgeClass: string }> = {
  investigator: { label: "Investigator", tier: "1st Line", badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  manager: { label: "Manager", tier: "2nd Line", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  administrator: { label: "Administrator", tier: "3rd Line", badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
};

function RolesPage() {
  const roles: RoleId[] = ["investigator", "manager", "administrator"];

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
              <p className="text-xs text-muted-foreground">
                Live permission matrix — mirrored from the backend enforcement layer (Three Lines of Defense).
              </p>
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left">Capability</th>
                  {roles.map((r) => (
                    <th key={r} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-foreground normal-case">{ROLE_META[r].label}</span>
                        <span className={cn("rounded-full border px-2 py-px text-[9px] font-bold", ROLE_META[r].badgeClass)}>
                          {ROLE_META[r].tier}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PERMISSION_GROUPS.map((g) => (
                  <>
                    <tr key={g.group} className="bg-muted/20">
                      <td colSpan={4} className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {g.group}
                      </td>
                    </tr>
                    {g.items.map((item) => (
                      <tr key={item.perm} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-2.5 text-xs text-foreground">{item.label}</td>
                        {roles.map((r) => (
                          <td key={r} className="px-4 py-2.5 text-center">
                            {ROLE_PERMISSIONS[r].has(item.perm) ? (
                              <Check className="inline size-4 text-teal" aria-label="Allowed" />
                            ) : (
                              <X className="inline size-4 text-muted-foreground/40" aria-label="Denied" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-semibold text-foreground text-sm">Separation-of-Duties Rules</h3>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
            <li>
              <strong className="text-foreground">Maker–Checker (RBI):</strong> Investigators (1st Line) build evidence and may
              flag, dismiss, or escalate. Only Managers (2nd Line) can freeze accounts via Block &amp; Report.
            </li>
            <li>
              <strong className="text-foreground">Administrators decide nothing:</strong> The 3rd Line manages users, settings,
              and verifies audit trails — it never takes case verdicts, keeping governance independent.
            </li>
            <li>
              <strong className="text-foreground">Enforcement:</strong> This matrix is enforced server-side on every API call
              (auth.py) — the UI simply reflects what each role is allowed to do.
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
