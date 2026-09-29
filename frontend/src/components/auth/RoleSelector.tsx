import { CheckCircle2, ShieldCheck, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoleSelectorProps {
  selectedRole: RoleId;
  onRoleSelect: (roleId: RoleId) => void;
  onContinue?: () => void;
}

export const roleOptions = [
  {
    id: "investigator",
    label: "Investigator",
    description: "Fraud / AML Analyst",
    purpose: "Investigate suspicious cases, evidence, risk and AI analysis.",
    icon: ShieldCheck,
    theme: "investigator",
  },
  {
    id: "manager",
    label: "Manager",
    description: "AML / Compliance Manager",
    purpose: "Review investigations, approve recommendations, manage escalations and reports.",
    icon: FileText,
    theme: "manager",
  },
  {
    id: "administrator",
    label: "Administrator",
    description: "Bank IT / Security Administrator",
    purpose: "Manage users, roles, integrations and platform security.",
    icon: Lock,
    theme: "administrator",
  },
] as const;

export type RoleId = (typeof roleOptions)[number]["id"];

export function RoleSelector({ selectedRole, onRoleSelect, onContinue }: RoleSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Select your role</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Choose the role that matches your position to access relevant tools and data.
        </p>
      </div>

      <div className="grid gap-3">
        {roleOptions.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onRoleSelect(role.id)}
              className={cn(
                "group relative rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "focus-visible:ring-violet focus-visible:ring-offset-background",
                isSelected
                  ? "border-violet/35 bg-violet/8 ring-2 ring-violet/20"
                  : "border-border bg-background hover:border-violet/20 hover:bg-violet/5",
              )}
              aria-pressed={isSelected}
              aria-label={`Select ${role.label} role`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
                      isSelected
                        ? "bg-violet/25 text-violet"
                        : "bg-deep/30 text-gov group-hover:bg-violet/15 group-hover:text-violet",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{role.label}</p>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tracking-[0.08em]">
                        {role.description}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{role.purpose}</p>
                  </div>
                </div>

                {isSelected && (
                  <div
                    className="flex size-5 items-center justify-center rounded-full bg-violet text-white flex-shrink-0"
                    aria-hidden
                  >
                    <CheckCircle2 className="size-4" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {onContinue && (
        <button
          onClick={onContinue}
          className={cn(
            "w-full rounded-xl px-4 py-3 font-medium text-sm transition-colors duration-200",
            "bg-violet text-white hover:bg-violet/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "focus-visible:ring-violet focus-visible:ring-offset-background",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Continue as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
        </button>
      )}
    </div>
  );
}
