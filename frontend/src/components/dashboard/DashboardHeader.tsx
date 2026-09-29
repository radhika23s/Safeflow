import { useNavigate } from "@tanstack/react-router";
import { LogOut, Shield, ShieldCheck, UserCheck, ShieldAlert } from "lucide-react";
import { useRole, type RoleId } from "@/context/RoleContext";
import { Button } from "@/components/ui/button";

export interface DashboardHeaderProps {
  title?: string;
  userRole?: string;
  userName?: string;
}

const subtitleByTitle: Record<string, string> = {
  "Investigation Overview": "Monitor suspicious activity, risk signals, cases, and AI investigation services.",
  "Review & Approvals": "Review analyst decisions, escalations, reports, and compliance activity.",
  "System Administration": "Manage users, access roles, integrations, security, and audit controls.",
  "Manager Approvals Queue": "Review investigation recommendations before final managerial sign-off.",
  "Reports & Regulatory Filings": "Review generated investigation reports and regulatory filing records.",
  "Transaction Graph": "Explore transaction relationships and suspicious account connections.",
};

const roleBadgeConfig: Record<RoleId, { label: string; icon: any; className: string }> = {
  administrator: {
    label: "Administrator",
    icon: ShieldAlert,
    className: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  manager: {
    label: "Compliance Manager",
    icon: ShieldCheck,
    className: "bg-teal/10 text-teal border-teal/30",
  },
  investigator: {
    label: "AML Investigator",
    icon: Shield,
    className: "bg-primary/10 text-primary border-primary/30",
  },
};

export function DashboardHeader({
  title,
  userRole: userRoleProp,
  userName: userNameProp,
}: DashboardHeaderProps) {
  const { role, user, dashboardTitle, logout } = useRole();
  const navigate = useNavigate();

  const displayTitle = title || dashboardTitle;
  const activeRole = (userRoleProp as RoleId) || role;
  const displayUserName = userNameProp || user.name;
  const subtitle =
    subtitleByTitle[displayTitle] ||
    "Operational workspace for financial crime investigation and oversight.";

  const badge = roleBadgeConfig[activeRole] || roleBadgeConfig.investigator;
  const BadgeIcon = badge.icon;

  const handleLogout = () => {
    logout();
    navigate({ to: "/sign-in" });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {displayTitle}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Role Pill - Locked to authenticated DB session */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.className}`}
          >
            <BadgeIcon className="size-3.5" />
            <span>{badge.label}</span>
          </div>

          {/* User info */}
          <div className="hidden text-right md:block">
            <p className="text-xs font-semibold text-foreground">{displayUserName}</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{user.email}</p>
          </div>

          {/* Logout Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-8 gap-1.5 rounded-xl border-border px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sign out of workspace"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
