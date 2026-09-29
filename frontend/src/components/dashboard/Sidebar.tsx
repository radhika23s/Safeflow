import { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  Briefcase,
  Microscope,
  AlertTriangle,
  Network,
  FileCheck,
  FileText,
  Eye,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  CheckSquare,
  TrendingUp,
  ClipboardList,
  Users,
  Shield,
  Sliders,
  Lock,
  History,
  Landmark,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Mono } from "@/components/landing/shared";
import { useRole, type RoleId } from "@/context/RoleContext";
import { Logo } from "@/components/Logo";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const roleNavMap: Record<RoleId, NavItem[]> = {
  investigator: [
    { id: "dashboard", label: "Dashboard", icon: <Briefcase className="size-4" />, href: "/dashboard" },
    { id: "cases", label: "Cases", icon: <Briefcase className="size-4" />, href: "/dashboard/cases" },
    { id: "insider", label: "Insider Risk", icon: <UserCog className="size-4" />, href: "/dashboard/insider" },
    { id: "reports", label: "Reports", icon: <FileText className="size-4" />, href: "/dashboard/reports" },
    { id: "audit", label: "Audit Trail", icon: <ClipboardList className="size-4" />, href: "/dashboard/audit" },
    { id: "bank", label: "Apex Bank Core", icon: <Landmark className="size-4 text-emerald-400" />, href: "/bank" },
  ],
  manager: [
    { id: "dashboard", label: "Dashboard", icon: <Briefcase className="size-4" />, href: "/dashboard" },
    { id: "cases", label: "Cases", icon: <Briefcase className="size-4" />, href: "/dashboard/cases" },
    { id: "insider", label: "Insider Risk", icon: <UserCog className="size-4" />, href: "/dashboard/insider" },
    { id: "reports", label: "Reports", icon: <FileText className="size-4" />, href: "/dashboard/reports" },
    { id: "audit", label: "Audit Trail", icon: <ClipboardList className="size-4" />, href: "/dashboard/audit" },
    { id: "users", label: "User Directory", icon: <Users className="size-4" />, href: "/dashboard/users" },
    { id: "bank", label: "Apex Bank Core", icon: <Landmark className="size-4 text-emerald-400" />, href: "/bank" },
  ],
  administrator: [
    { id: "dashboard", label: "Dashboard", icon: <Briefcase className="size-4" />, href: "/dashboard" },
    { id: "users", label: "User Directory", icon: <Users className="size-4" />, href: "/dashboard/users" },
    { id: "cases", label: "Cases", icon: <Briefcase className="size-4" />, href: "/dashboard/cases" },
    { id: "insider", label: "Insider Risk", icon: <UserCog className="size-4" />, href: "/dashboard/insider" },
    { id: "reports", label: "Reports", icon: <FileText className="size-4" />, href: "/dashboard/reports" },
    { id: "audit", label: "Audit Trail", icon: <ClipboardList className="size-4" />, href: "/dashboard/audit" },
    { id: "bank", label: "Apex Bank Core", icon: <Landmark className="size-4 text-emerald-400" />, href: "/bank" },
  ],
};

const bottomNav: NavItem[] = [
  { id: "help", label: "Help Center", icon: <HelpCircle className="size-4" />, href: "/help" },
  { id: "signout", label: "Sign Out", icon: <LogOut className="size-4" />, href: "/sign-in" },
];

export interface SidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  userRole?: RoleId;
}

export function Sidebar({ open = true, onOpenChange, userRole: userRoleProp }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(open);
  const navigate = useNavigate();
  const location = useLocation();
  const { role: contextRole, clearRole } = useRole();

  const activeRole = userRoleProp || contextRole || "investigator";
  const mainNav = roleNavMap[activeRole] || roleNavMap.investigator;

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleNavClick = (href: string, id: string) => {
    if (id === "signout") {
      clearRole();
      navigate({ to: href });
    } else {
      navigate({ to: href });
    }
  };

  const roleLabelMap: Record<RoleId, string> = {
    investigator: "Investigator View",
    manager: "Manager View",
    administrator: "Administrator View",
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => handleOpenChange(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-xl border border-border bg-background p-2.5 shadow-sm lg:hidden"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X className="size-5 text-foreground" /> : <Menu className="size-5 text-foreground" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-xs lg:hidden"
          onClick={() => handleOpenChange(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-card transition-transform duration-300 ease-out lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto border-r border-border/80">
          {/* Brand Header */}
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="border-b border-border/80 p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none"
            aria-label="Go to Dashboard"
          >
            <div className="flex items-center gap-3">
              <Logo
                size="md"
                variant="navy"
                rounded="xl"
                shadow
                showLabel={false}
              />
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-foreground">Safe Flow</p>
                <Mono className="mt-0.5 text-[10px] text-muted-foreground">
                  {roleLabelMap[activeRole]}
                </Mono>
              </div>
            </div>

            {/* Role Badge */}
            <div className="mt-3.5 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs">
              <span className="font-semibold capitalize text-foreground text-[11px]">{activeRole}</span>
              <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal border border-teal/20">
                Active
              </span>
            </div>
          </button>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 py-5">
            <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 font-mono">
              Workspace Navigation
            </p>
            <ul className="space-y-1">
              {mainNav.map((item) => {
                const isSelected =
                  location.pathname === item.href ||
                  (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavClick(item.href, item.id)}
                      className={cn(
                        "group relative w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                        "flex items-center gap-2.5",
                        isSelected
                          ? "bg-violet/10 text-violet font-semibold border-l-2 border-violet pl-2.5"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/20",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center transition-colors",
                          isSelected ? "text-violet" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom Navigation */}
          <div className="border-t border-border/80 px-3 py-4">
            <ul className="space-y-1">
              {bottomNav.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.href, item.id)}
                    className={cn(
                      "group relative w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                      "flex items-center gap-2.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/20",
                    )}
                  >
                    <span className="flex size-4 items-center justify-center text-muted-foreground group-hover:text-foreground">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
