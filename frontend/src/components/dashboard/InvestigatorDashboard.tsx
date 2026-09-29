import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { InsiderSummaryWidget } from "./InsiderSummaryWidget";
import { demoCase } from "@/data/mock-investigation";
import { cn } from "@/lib/utils";
import type { Case } from "@/types/investigation";
import { getCaseStats, listCases, getAuditLog } from "@/lib/api";

// Generate mock cases based on the demo case pattern
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
      alert: "Large cash withdrawal flagged across multiple ATMs",
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

export interface InvestigatorDashboardProps {
  userRole?: string;
}

export function InvestigatorDashboard({ userRole = "investigator" }: InvestigatorDashboardProps) {
  const mockCases = generateMockCases();

  // Try to fetch real stats from backend
  const { data: stats } = useQuery({
    queryKey: ["caseStats"],
    queryFn: getCaseStats,
    retry: 1,
    staleTime: 15_000,
  });

  // Fetch real cases from backend SQLite
  const { data: casesData } = useQuery({
    queryKey: ["recentCases"],
    queryFn: () => listCases({ limit: 6 }),
    staleTime: 15_000,
  });

  // Fetch real audit entries from backend SQLite
  const { data: auditData } = useQuery({
    queryKey: ["recentAudit"],
    queryFn: () => getAuditLog(),
    staleTime: 15_000,
  });

  const displayCases: Case[] =
    casesData?.cases && casesData.cases.length > 0
      ? casesData.cases.map((c) => ({
          id: c.case_id,
          alert:
            c.transaction?.type
              ? `${c.transaction.type} transaction alert`
              : c.analyst_notes || "Automated telemetry alert",
          openedAt: c.opened_at,
          risk: {
            value: Math.round(c.risk_score),
            max: 100,
            level: (c.risk_band?.toUpperCase() as any) || "MEDIUM",
            factors: [],
          },
          recommendation: (c.recommended_action?.toUpperCase() as any) || "VERIFY",
          evidence: [],
          transactionId: c.transaction_id,
        }))
      : mockCases;

  // Use API stats when available, otherwise compute from mock data
  const openCases = stats
    ? (stats.by_status.find((s) => s.status === "OPEN")?.count ?? stats.total)
    : displayCases.length;
  const highRiskCases = stats
    ? ((stats.by_band.find((b) => b.risk_band === "HIGH")?.count ?? 0) +
       (stats.by_band.find((b) => b.risk_band === "CRITICAL")?.count ?? 0))
    : displayCases.filter((c) => c.risk.level === "HIGH" || c.risk.level === "CRITICAL").length;
  const pendingReviews = stats
    ? (stats.by_status.find((s) => s.status === "OPEN")?.count ?? 0)
    : displayCases.filter((c) => c.recommendation === "VERIFY").length;
  const escalatedCases = stats
    ? (stats.by_status.find((s) => s.status === "ESCALATED")?.count ?? 0)
    : displayCases.filter((c) => c.recommendation === "ESCALATE").length;

  const riskDistribution = {
    HIGH: stats
      ? (stats.by_band.find((b) => b.risk_band === "HIGH")?.count ?? 0)
      : displayCases.filter((c) => c.risk.level === "HIGH").length,
    MEDIUM: stats
      ? (stats.by_band.find((b) => b.risk_band === "MEDIUM")?.count ?? 0)
      : displayCases.filter((c) => c.risk.level === "MEDIUM").length,
    LOW: stats
      ? (stats.by_band.find((b) => b.risk_band === "LOW")?.count ?? 0)
      : displayCases.filter((c) => c.risk.level === "LOW").length,
  };

  const defaultActivityEvents = [
    {
      id: "evt-1",
      type: "escalate",
      description: "Case FC-2026-00421 escalated to senior analyst review",
      time: "2 minutes ago",
      icon: AlertTriangle,
    },
    {
      id: "evt-2",
      type: "review",
      description: "AI Risk score re-evaluated for case FC-2026-00422",
      time: "12 minutes ago",
      icon: TrendingUp,
    },
    {
      id: "evt-3",
      type: "complete",
      description: "Case FC-2026-00420 marked for verification",
      time: "28 minutes ago",
      icon: CheckCircle2,
    },
    {
      id: "evt-4",
      type: "alert",
      description: "New automated alert FC-2026-00423 ingested from transaction gateway",
      time: "1 hour ago",
      icon: AlertTriangle,
    },
  ];

  const activityEvents =
    auditData && auditData.length > 0
      ? auditData.slice(0, 5).map((entry, idx) => ({
          id: entry.id || `audit-${idx}`,
          type: entry.action.toLowerCase().includes("escalat")
            ? "escalate"
            : entry.action.toLowerCase().includes("decision") || entry.action.toLowerCase().includes("approv")
            ? "complete"
            : "alert",
          description: `${entry.action}: ${entry.details || `Case ${entry.case_id}`}`,
          time: entry.timestamp
            ? new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Recently",
          icon: entry.action.toLowerCase().includes("escalat")
            ? AlertTriangle
            : entry.action.toLowerCase().includes("decision") || entry.action.toLowerCase().includes("approv")
            ? CheckCircle2
            : TrendingUp,
        }))
      : defaultActivityEvents;

  return (
    <div className="space-y-6">
      {/* Top Statistics */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open Cases" value={openCases} icon={<Zap className="size-4" />} />
          <StatCard
            label="High Risk Cases"
            value={highRiskCases}
            icon={<AlertTriangle className="size-4" />}
            trend={{ direction: "up", value: 12 }}
          />
          <StatCard label="Pending Reviews" value={pendingReviews} icon={<Clock className="size-4" />} />
          <StatCard label="Escalated Cases" value={escalatedCases} icon={<TrendingUp className="size-4" />} />
        </div>
      </section>

      {/* Risk Overview */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-foreground mb-3.5">Risk Distribution Overview</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* High Risk */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-risk-high/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">High Risk</p>
                <p className="mt-2 text-3xl font-bold text-risk-high">{riskDistribution.HIGH}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Cases requiring immediate triage</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-risk-high/10 text-risk-high border border-risk-high/20">
                <AlertTriangle className="size-5" />
              </div>
            </div>
          </div>

          {/* Medium Risk */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-risk-medium/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Medium Risk</p>
                <p className="mt-2 text-3xl font-bold text-risk-medium">{riskDistribution.MEDIUM}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Active monitoring & review</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-risk-medium/10 text-risk-medium border border-risk-medium/20">
                <TrendingUp className="size-5" />
              </div>
            </div>
          </div>

          {/* Low Risk */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-risk-low/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Low Risk</p>
                <p className="mt-2 text-3xl font-bold text-risk-low">{riskDistribution.LOW}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Standard compliance checks</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-risk-low/10 text-risk-low border border-risk-low/20">
                <CheckCircle2 className="size-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insider Risk Summary */}
      <InsiderSummaryWidget />

      {/* Recent Investigations */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">Recent Investigations</h2>
          <Link to="/dashboard/cases" className="text-xs font-semibold text-violet hover:underline">
            View All Cases →
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  <th className="px-5 py-3.5">Case Reference</th>
                  <th className="px-5 py-3.5">Risk Score</th>
                  <th className="px-5 py-3.5">Telemetry Alert</th>
                  <th className="px-5 py-3.5">AI Recommendation</th>
                  <th className="px-5 py-3.5">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayCases.map((caseItem) => (
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
                      <span className="text-muted-foreground text-xs">{caseItem.alert}</span>
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
                    <td className="px-5 py-3.5 text-muted-foreground text-[11px]">
                      {new Date(caseItem.openedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Investigation Activity */}
      <section>
        <h2 className="text-base font-bold tracking-tight text-foreground mb-3.5">Investigation Audit Telemetry</h2>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <div className="space-y-4">
            {activityEvents.map((event, idx) => {
              const EventIcon = event.icon;
              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-start gap-3.5 pb-3.5",
                    idx !== activityEvents.length - 1 && "border-b border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl flex-shrink-0 border",
                      event.type === "escalate"
                        ? "bg-risk-high/10 text-risk-high border-risk-high/20"
                        : event.type === "alert"
                          ? "bg-risk-medium/10 text-risk-medium border-risk-medium/20"
                          : event.type === "complete"
                            ? "bg-risk-low/10 text-risk-low border-risk-low/20"
                            : "bg-violet/10 text-violet border-violet/20",
                    )}
                  >
                    <EventIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-relaxed">{event.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">{event.time}</p>
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
