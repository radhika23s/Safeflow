import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users,
  Activity,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getUsers, healthCheck } from "@/lib/api";

// System service health status
type ServiceStatus = "operational" | "warning" | "unavailable";

interface SystemService {
  id: string;
  name: string;
  status: ServiceStatus;
  lastChecked: string;
  uptime: string;
}

interface SecurityEvent {
  id: string;
  type: "user_added" | "role_updated" | "permission_changed" | "session_started" | "config_updated";
  user: string;
  description: string;
  timestamp: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "administrator" | "manager" | "investigator";
  status: "active" | "inactive" | "suspended";
  lastActive: string;
  joinDate: string;
}

const generateSystemServices = (): SystemService[] => {
  const now = new Date();
  return [
    {
      id: "service-1",
      name: "AI Investigation Engine",
      status: "operational",
      lastChecked: now.toISOString(),
      uptime: "99.98%",
    },
    {
      id: "service-2",
      name: "Regulatory Intelligence",
      status: "operational",
      lastChecked: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      uptime: "99.95%",
    },
    {
      id: "service-3",
      name: "Transaction Graph Engine",
      status: "warning",
      lastChecked: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      uptime: "97.2%",
    },
    {
      id: "service-4",
      name: "SAR Report Service",
      status: "operational",
      lastChecked: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
      uptime: "99.99%",
    },
  ];
};

const generateSecurityEvents = (): SecurityEvent[] => {
  const now = new Date();
  return [
    {
      id: "event-1",
      type: "user_added",
      user: "Alex Chen",
      description: "New user provisioned: jennifer.martinez@smarthorizon.ai (Investigator)",
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "event-2",
      type: "permission_changed",
      user: "Sarah Chen",
      description: "Permission updated: Enhanced Compliance Review access granted",
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "event-3",
      type: "session_started",
      user: "Marcus Johnson",
      description: "Session authenticated via Corporate SSO (ADFS)",
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "event-4",
      type: "role_updated",
      user: "Alex Chen",
      description: "David Rodriguez promoted from Investigator to Manager",
      timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "event-5",
      type: "config_updated",
      user: "Alex Chen",
      description: "Risk threshold policy updated: Medium Risk baseline set to 45",
      timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

const generateAdminUsers = (): AdminUser[] => {
  const now = new Date();
  return [
    {
      id: "user-1",
      name: "Alex Chen",
      email: "alex.chen@smarthorizon.ai",
      role: "administrator",
      status: "active",
      lastActive: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      joinDate: new Date(2025, 0, 15).toISOString(),
    },
    {
      id: "user-2",
      name: "Sarah Chen",
      email: "sarah.chen@smarthorizon.ai",
      role: "manager",
      status: "active",
      lastActive: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      joinDate: new Date(2024, 11, 1).toISOString(),
    },
    {
      id: "user-3",
      name: "Marcus Johnson",
      email: "marcus.johnson@smarthorizon.ai",
      role: "investigator",
      status: "active",
      lastActive: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      joinDate: new Date(2024, 10, 15).toISOString(),
    },
    {
      id: "user-4",
      name: "Priya Patel",
      email: "priya.patel@smarthorizon.ai",
      role: "investigator",
      status: "active",
      lastActive: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      joinDate: new Date(2024, 9, 20).toISOString(),
    },
    {
      id: "user-5",
      name: "David Rodriguez",
      email: "david.rodriguez@smarthorizon.ai",
      role: "manager",
      status: "inactive",
      lastActive: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      joinDate: new Date(2024, 8, 10).toISOString(),
    },
  ];
};

const getServiceStatusIcon = (status: ServiceStatus) => {
  switch (status) {
    case "operational":
      return <CheckCircle2 className="size-4 text-teal" />;
    case "warning":
      return <AlertCircle className="size-4 text-risk-medium" />;
    case "unavailable":
      return <AlertTriangle className="size-4 text-risk-high" />;
    default:
      return <CheckCircle2 className="size-4" />;
  }
};

const getServiceStatusBadge = (status: ServiceStatus) => {
  switch (status) {
    case "operational":
      return "bg-teal/10 text-teal border-teal/20";
    case "warning":
      return "bg-risk-medium/10 text-risk-medium border-risk-medium/20";
    case "unavailable":
      return "bg-risk-high/10 text-risk-high border-risk-high/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getSecurityEventIcon = (type: string) => {
  switch (type) {
    case "user_added":
      return <Users className="size-4" />;
    case "role_updated":
      return <Shield className="size-4" />;
    case "permission_changed":
      return <AlertTriangle className="size-4" />;
    case "session_started":
      return <Activity className="size-4" />;
    case "config_updated":
      return <Settings className="size-4" />;
    default:
      return <Clock className="size-4" />;
  }
};

const getRoleBadge = (role: string) => {
  switch (role) {
    case "administrator":
      return "bg-risk-high/10 text-risk-high border-risk-high/20";
    case "manager":
      return "bg-violet/10 text-violet border-violet/20";
    case "investigator":
      return "bg-teal/10 text-teal border-teal/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return "bg-teal/10 text-teal border-teal/20";
    case "inactive":
      return "bg-muted text-muted-foreground border-border";
    case "suspended":
      return "bg-risk-high/10 text-risk-high border-risk-high/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

export interface AdminDashboardProps {
  userRole?: string;
}

export function AdminDashboard({ userRole = "administrator" }: AdminDashboardProps) {
  const { data: dbUsers } = useQuery({ queryKey: ["users"], queryFn: getUsers, refetchInterval: 15000 });
  const systemServices = generateSystemServices();
  const securityEvents = generateSecurityEvents();
  const staticUsers = generateAdminUsers();

  const adminUsers: AdminUser[] = dbUsers && dbUsers.length > 0
    ? dbUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as any,
        status: (u.status.toLowerCase() === "active" ? "active" : "inactive") as any,
        lastActive: u.created_at || new Date().toISOString(),
        joinDate: u.created_at || new Date().toISOString(),
      }))
    : staticUsers;

  const activeUsers = adminUsers.filter((u) => u.status === "active").length;
  const activeSessions = adminUsers.filter((u) => u.status === "active").length;
  const investigators = adminUsers.filter((u) => u.role === "investigator").length;
  const managers = adminUsers.filter((u) => u.role === "manager").length;

  const operationalServices = systemServices.filter((s) => s.status === "operational").length;
  const warningServices = systemServices.filter((s) => s.status === "warning").length;

  return (
    <div className="space-y-6">
      {/* Top Statistics */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Users" value={activeUsers} icon={<Users className="size-4" />} />
          <StatCard label="Active SSO Sessions" value={activeSessions} icon={<Activity className="size-4" />} />
          <StatCard label="Investigator Accounts" value={investigators} icon={<Shield className="size-4" />} />
          <StatCard label="Manager Accounts" value={managers} icon={<Settings className="size-4" />} />
        </div>
      </section>

      {/* System Health */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-foreground mb-3.5">System Health & Telemetry</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {systemServices.map((service) => (
            <div key={service.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-violet/20">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-foreground truncate">{service.name}</p>
                {getServiceStatusIcon(service.status)}
              </div>
              <div className="space-y-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border capitalize",
                    getServiceStatusBadge(service.status),
                  )}
                >
                  {service.status}
                </span>
                <div className="flex items-center justify-between pt-2 border-t border-border text-[11px]">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="font-bold text-foreground font-mono">{service.uptime}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Last Check:</span>
                  <span className="text-muted-foreground font-mono">{formatTime(service.lastChecked)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Status Summary */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">Infrastructure Summary</h2>
          <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1">
            <Link to="/dashboard/settings">
              <Settings className="size-3" />
              Configure System Settings
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/40 p-4 border border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="size-4 text-teal" />
              <span className="text-xs font-semibold text-foreground">Operational Services</span>
            </div>
            <p className="text-2xl font-bold text-teal">{operationalServices} / 4</p>
            <p className="text-[11px] text-muted-foreground mt-1">All core gateways nominal</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4 border border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertCircle className="size-4 text-risk-medium" />
              <span className="text-xs font-semibold text-foreground">Monitoring Warnings</span>
            </div>
            <p className="text-2xl font-bold text-risk-medium">{warningServices} / 4</p>
            <p className="text-[11px] text-muted-foreground mt-1">Minor latency warning on Graph API</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4 border border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="size-4 text-risk-high" />
              <span className="text-xs font-semibold text-foreground">Outages</span>
            </div>
            <p className="text-2xl font-bold text-teal">0</p>
            <p className="text-[11px] text-muted-foreground mt-1">Zero downtime reported</p>
          </div>
        </div>
      </section>

      {/* Recent Security Activity */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">Security Audit Trail</h2>
          <Link to="/dashboard/audit-logs" className="text-xs font-semibold text-violet hover:underline">
            View All Logs →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="space-y-3.5">
            {securityEvents.map((event, idx) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-start gap-3.5 pb-3.5",
                  idx !== securityEvents.length - 1 && "border-b border-border",
                )}
              >
                <div className="flex size-8 items-center justify-center rounded-xl bg-violet/10 text-violet border border-violet/20 flex-shrink-0">
                  {getSecurityEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{event.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Initiated by: {event.user}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">{formatTime(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Management */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">Active Directory Provisioning</h2>
          <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1">
            <Link to="/dashboard/users">
              <UserPlus className="size-3" />
              Manage Users Directory
            </Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  <th className="px-5 py-3.5">User Identity</th>
                  <th className="px-5 py-3.5">Assigned Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Active</th>
                  <th className="px-5 py-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {adminUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-foreground">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border capitalize",
                          getRoleBadge(user.role),
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border capitalize",
                          getStatusBadge(user.status),
                        )}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-[11px]">
                      {formatTime(user.lastActive)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Button size="sm" variant="ghost" className="size-7 p-0">
                        <MoreHorizontal className="size-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
