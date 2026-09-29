import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Eye,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { InsiderSummaryWidget } from "./InsiderSummaryWidget";
import { demoCase } from "@/data/mock-investigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Case } from "@/types/investigation";

// Generate mock cases for manager review
const generateMockCases = (): Case[] => {
  const baseCase = demoCase;
  return [
    baseCase,
    {
      ...baseCase,
      id: "FC-2026-00422",
      alert: "Unusual destination country & rapid transfer",
      openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      risk: { ...baseCase.risk, value: 72, level: "HIGH" },
      recommendation: "VERIFY",
    },
    {
      ...baseCase,
      id: "FC-2026-00420",
      alert: "Large cash withdrawal flagged across ATMs",
      openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      risk: { ...baseCase.risk, value: 58, level: "MEDIUM" },
      recommendation: "VERIFY",
    },
    {
      ...baseCase,
      id: "FC-2026-00419",
      alert: "Round-tripping circular transfer signal",
      openedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      risk: { ...baseCase.risk, value: 45, level: "MEDIUM" },
      recommendation: "ALLOW",
    },
    {
      ...baseCase,
      id: "FC-2026-00418",
      alert: "Minor velocity alert within expected baseline",
      openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      risk: { ...baseCase.risk, value: 28, level: "LOW" },
      recommendation: "ALLOW",
    },
  ];
};

type ApprovalStatus = "pending" | "approved" | "returned" | "escalated";

interface PendingCase extends Case {
  investigator: string;
  approvalStatus: ApprovalStatus;
  daysWaiting: number;
}

const generatePendingCases = (mockCases: Case[]): PendingCase[] => {
  const investigators = ["Sarah Chen", "Marcus Johnson", "Priya Patel", "David Rodriguez"];

  return mockCases
    .filter((c) => c.recommendation !== "ALLOW")
    .map((c, idx) => ({
      ...c,
      investigator: investigators[idx % investigators.length],
      approvalStatus: (["pending", "pending", "returned", "escalated"] as ApprovalStatus[])[idx % 4],
      daysWaiting: Math.floor(Math.random() * 7) + 1,
    }));
};

const getStatusBadge = (recommendation: string) => {
  switch (recommendation) {
    case "ESCALATE":
      return "bg-risk-high/10 text-risk-high border-risk-high/20";
    case "VERIFY":
      return "bg-risk-medium/10 text-risk-medium border-risk-medium/20";
    case "ALLOW":
      return "bg-risk-low/10 text-risk-low border-risk-low/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getRiskColor = (level: string) => {
  switch (level) {
    case "HIGH":
      return "text-risk-high";
    case "CRITICAL":
      return "text-risk-critical";
    case "MEDIUM":
      return "text-risk-medium";
    case "LOW":
      return "text-risk-low";
    default:
      return "text-muted-foreground";
  }
};

const getApprovalStatusBadge = (status: ApprovalStatus) => {
  switch (status) {
    case "pending":
      return "bg-muted text-muted-foreground border-border";
    case "approved":
      return "bg-teal/10 text-teal border-teal/20";
    case "returned":
      return "bg-risk-medium/10 text-risk-medium border-risk-medium/20";
    case "escalated":
      return "bg-risk-high/10 text-risk-high border-risk-high/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getApprovalStatusLabel = (status: ApprovalStatus) => {
  switch (status) {
    case "pending":
      return "Awaiting Review";
    case "approved":
      return "Approved";
    case "returned":
      return "Returned";
    case "escalated":
      return "Escalated";
    default:
      return "Unknown";
  }
};

export interface ManagerDashboardProps {
  userRole?: string;
}

export function ManagerDashboard({ userRole = "manager" }: ManagerDashboardProps) {
  const mockCases = generateMockCases();
  const pendingCases = generatePendingCases(mockCases);
  const [caseActions, setCaseActions] = useState<Record<string, ApprovalStatus>>(
    Object.fromEntries(pendingCases.map((c) => [c.id, c.approvalStatus])),
  );

  const pendingReviews = pendingCases.filter((c) => caseActions[c.id] === "pending").length;
  const highRiskCases = mockCases.filter((c) => c.risk.level === "HIGH" || c.risk.level === "CRITICAL").length;
  const escalations = pendingCases.filter((c) => caseActions[c.id] === "escalated").length;
  const reportsAwaitingApproval = pendingCases.filter((c) => caseActions[c.id] === "pending").length;

  const approvalActivity = [
    {
      id: "act-1",
      action: "Approved SAR Filing",
      caseId: "FC-2026-00418",
      time: "15 minutes ago",
      icon: CheckCircle2,
      color: "text-teal",
    },
    {
      id: "act-2",
      action: "Escalated to Compliance Committee",
      caseId: "FC-2026-00421",
      time: "42 minutes ago",
      icon: TrendingUp,
      color: "text-risk-high",
    },
    {
      id: "act-3",
      action: "Returned for Additional Evidence",
      caseId: "FC-2026-00422",
      time: "1 hour ago",
      icon: RotateCcw,
      color: "text-risk-medium",
    },
    {
      id: "act-4",
      action: "Approved Clearance",
      caseId: "FC-2026-00420",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "text-teal",
    },
  ];

  const escalationQueue = pendingCases.filter((c) => caseActions[c.id] === "escalated" || c.risk.level === "HIGH");

  const handleCaseAction = (caseId: string, action: "approve" | "return" | "escalate") => {
    const statusMap = { approve: "approved" as const, return: "returned" as const, escalate: "escalated" as const };
    setCaseActions((prev) => ({ ...prev, [caseId]: statusMap[action] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Statistics */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pending Reviews"
            value={pendingReviews}
            icon={<Clock className="size-4" />}
            trend={pendingReviews > 0 ? { direction: "up", value: 3 } : undefined}
          />
          <StatCard label="High Risk Cases" value={highRiskCases} icon={<AlertTriangle className="size-4" />} />
          <StatCard label="Escalations Queue" value={escalations} icon={<TrendingUp className="size-4" />} />
          <StatCard label="Reports Pending Sign-Off" value={reportsAwaitingApproval} icon={<Eye className="size-4" />} />
        </div>
      </section>

      {/* Pending Approvals Table */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">Pending Manager Approvals</h2>
          <Link to="/dashboard/approvals" className="text-xs font-semibold text-violet hover:underline">
            Go to Approvals Queue →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  <th className="px-5 py-3.5">Case Reference</th>
                  <th className="px-5 py-3.5">Risk Level</th>
                  <th className="px-5 py-3.5">AI Recommendation</th>
                  <th className="px-5 py-3.5">Investigator</th>
                  <th className="px-5 py-3.5">Sign-Off Status</th>
                  <th className="px-5 py-3.5">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingCases.map((caseItem) => {
                  const currentStatus = caseActions[caseItem.id];
                  return (
                    <tr key={caseItem.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          to="/dashboard/cases/$caseId"
                          params={{ caseId: caseItem.id }}
                          className="font-bold text-violet hover:underline text-xs"
                        >
                          {caseItem.id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold text-xs", getRiskColor(caseItem.risk.level))}>
                            {caseItem.risk.level}
                          </span>
                          <span className="text-[11px] text-muted-foreground">({caseItem.risk.value}/100)</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                            getStatusBadge(caseItem.recommendation),
                          )}
                        >
                          {caseItem.recommendation}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{caseItem.investigator}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                            getApprovalStatusBadge(currentStatus),
                          )}
                        >
                          {getApprovalStatusLabel(currentStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {currentStatus === "pending" ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaseAction(caseItem.id, "approve")}
                              className="text-[11px] h-7 px-2.5 gap-1"
                            >
                              <CheckCircle2 className="size-3 text-teal" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaseAction(caseItem.id, "return")}
                              className="text-[11px] h-7 px-2.5 gap-1"
                            >
                              <RotateCcw className="size-3 text-risk-medium" />
                              Return
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCaseAction(caseItem.id, "escalate")}
                              className="text-[11px] h-7 px-2.5 gap-1"
                            >
                              <ArrowUpRight className="size-3 text-risk-high" />
                              Escalate
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Action Recorded</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Escalation Queue */}
      {escalationQueue.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-base font-bold tracking-tight text-foreground">Active Escalation Queue</h2>
            <Link to="/dashboard/escalations" className="text-xs font-semibold text-violet hover:underline">
              View All Escalations →
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-3">
            {escalationQueue.map((caseItem, idx) => (
              <div
                key={caseItem.id}
                className={cn(
                  "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3",
                  idx !== escalationQueue.length - 1 && "border-b border-border",
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <Link
                      to="/dashboard/cases/$caseId"
                      params={{ caseId: caseItem.id }}
                      className="font-bold text-violet hover:underline text-xs"
                    >
                      {caseItem.id}
                    </Link>
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border bg-risk-high/10 text-risk-high border-risk-high/20")}>
                      {caseItem.risk.level} RISK ({caseItem.risk.value}/100)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{caseItem.alert}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1 flex-shrink-0">
                  <Link to="/dashboard/cases/$caseId" params={{ caseId: caseItem.id }}>
                    Review Case Workspace
                    <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Insider Risk Summary */}
      <InsiderSummaryWidget />

      {/* Approval Activity */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-foreground mb-3.5">Manager Audit History</h2>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="space-y-4">
            {approvalActivity.map((activity, idx) => {
              const ActivityIcon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-start gap-3.5 pb-3.5",
                    idx !== approvalActivity.length - 1 && "border-b border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl flex-shrink-0 border",
                      activity.action.startsWith("Approved")
                        ? "bg-teal/10 text-teal border-teal/20"
                        : activity.action.startsWith("Escalated")
                          ? "bg-risk-high/10 text-risk-high border-risk-high/20"
                          : "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
                    )}
                  >
                    <ActivityIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-relaxed">
                      <span className="font-semibold">{activity.action}</span> · Case {activity.caseId}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
