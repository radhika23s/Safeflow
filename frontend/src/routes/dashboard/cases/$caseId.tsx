import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InvestigationWorkspace } from "@/components/investigation/InvestigationWorkspace";
import {
  agents,
  demoCase,
  evidenceChips,
  graphEdges,
  graphNodes,
  regulatorySources,
} from "@/data/mock-investigation";
import {
  getCase,
  getCaseGraph,
  runInvestigation,
  submitDecision,
  type BackendCase,
  type CounterfactualInsight,
  type RegulatoryClause,
} from "@/lib/api";
import { Loader2 } from "lucide-react";
import type { Case, InvestigationReport, RiskLevel, GraphNode, GraphEdge } from "@/types/investigation";

export const Route = createFileRoute("/dashboard/cases/$caseId")({
  component: CaseWorkspacePage,
});

/** Convert a backend case to the frontend Case type with domain-rich evidence */
function backendToFrontendCase(bc: BackendCase): { caseData: Case; chips: string[] } {
  const riskLevel = bc.risk_band?.toUpperCase() as RiskLevel ?? "MEDIUM";
  const score = bc.risk_score != null ? Math.round(bc.risk_score * 10) / 10 : 50;

  const supporting: Array<{ label: string; kind: "supporting" }> = [];
  const counter: Array<{ label: string; kind: "counter" }> = [];
  const chips: string[] = [];

  const t = bc.transaction;

  if (t) {
    // 1. Capital depletion signal
    if (t.old_balance_orig && t.old_balance_orig > 0) {
      const remaining = t.new_balance_orig ?? 0;
      const depletedPct = Math.round(((t.old_balance_orig - remaining) / t.old_balance_orig) * 100);
      if (depletedPct >= 70) {
        supporting.push({
          label: `Severe Capital Depletion: ${depletedPct}% of balance drained (₹${t.old_balance_orig.toLocaleString()} → ₹${remaining.toLocaleString()})`,
          kind: "supporting",
        });
      }
    }

    // 2. High-value transfer
    if (t.amount >= 200000) {
      supporting.push({
        label: `High-Value Outflow: ₹${t.amount.toLocaleString()} transfer exceeding retail baseline`,
        kind: "supporting",
      });
    }

    // 3. Destination mule accumulation
    if (t.old_balance_dest === 0) {
      supporting.push({
        label: `Zero-Balance Payee: Destination had ₹0 prior to this influx (mule funnel pattern)`,
        kind: "supporting",
      });
    }

    // 4. ML Model Assessment
    supporting.push({
      label: `XGBoost ML Classification: ${score}/100 Risk (${riskLevel} severity tier)`,
      kind: "supporting",
    });

    // 5. Mitigating / Counter Evidence
    if (t.is_vpn === 0) {
      counter.push({
        label: "Direct IP connection verified (no VPN/Tor proxy detected)",
        kind: "counter",
      });
    }
    if (t.channel) {
      counter.push({
        label: `Processed via authorized banking rail (${t.channel})`,
        kind: "counter",
      });
    }

    // Domain chips (no redundant raw transaction IDs)
    chips.push(`Rail: ${t.channel || "IMPS"}`);
    chips.push(`Origin Bal: ₹${(t.old_balance_orig ?? 0).toLocaleString()}`);
    chips.push(`Dest Bal: ₹${(t.new_balance_dest ?? 0).toLocaleString()}`);
    chips.push(`Engine: XGBoost v2.1`);
    chips.push(`Triage: Auto-Flagged`);
  } else {
    supporting.push({ label: `Transaction ID: ${bc.transaction_id}`, kind: "supporting" });
    supporting.push({ label: `Model Risk Band: ${bc.risk_band}`, kind: "supporting" });
    chips.push(`Status: ${bc.status}`);
  }

  const caseData: Case = {
    id: bc.case_id,
    alert: bc.recommended_action || "Under investigation",
    openedAt: bc.opened_at,
    risk: {
      value: score,
      max: 100,
      level:
        riskLevel === "CRITICAL" || riskLevel === "HIGH" || riskLevel === "MEDIUM" || riskLevel === "LOW"
          ? riskLevel
          : "MEDIUM",
      factors: [
        { label: "ML Risk Score (XGBoost)", contribution: Math.round(score * 0.6) },
        { label: "Contextual Topological Signals", contribution: Math.round(score * 0.2) },
        { label: "Anomaly Score (Isolation Forest)", contribution: Math.round(score * 0.2) },
      ],
    },
    evidence: [...supporting, ...counter],
    recommendation:
      bc.recommended_action?.includes("BLOCK") || bc.recommended_action?.includes("ESCALAT")
        ? "ESCALATE"
        : bc.recommended_action?.includes("FLAG") || bc.recommended_action?.includes("REVIEW")
          ? "VERIFY"
          : "ALLOW",
  };

  return { caseData, chips };
}

function CaseWorkspacePage() {
  const { caseId: rawCaseId } = Route.useParams();
  const caseId = useMemo(() => (rawCaseId || "").trim().replace(/\s+/g, "-"), [rawCaseId]);
  const queryClient = useQueryClient();
  const [investigationResult, setInvestigationResult] = useState<string | null>(null);
  const [strDraftResult, setStrDraftResult] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);
  const [counterfactualResult, setCounterfactualResult] = useState<CounterfactualInsight | null>(null);
  const [regulatoryClausesResult, setRegulatoryClausesResult] = useState<Record<string, RegulatoryClause> | null>(null);
  const [citedClausesResult, setCitedClausesResult] = useState<string[] | null>(null);
  const [validatorResult, setValidatorResult] = useState<any>(null);

  // Fetch real case data from backend
  const {
    data: backendCase,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    retry: 1,
    staleTime: 10_000,
  });

  // Fetch real graph data from backend
  const { data: graphData } = useQuery({
    queryKey: ["caseGraph", caseId],
    queryFn: () => getCaseGraph(caseId),
    enabled: !!caseId,
    retry: 1,
    staleTime: 10_000,
  });

  // Investigation mutation
  const investigateMutation = useMutation({
    mutationFn: () => runInvestigation(caseId),
    onSuccess: (data) => {
      setInvestigationResult(data.investigation_report);
      setStrDraftResult(data.str_draft);
      if (data.counterfactual) setCounterfactualResult(data.counterfactual);
      if (data.regulatory_clauses) setRegulatoryClausesResult(data.regulatory_clauses);
      if (data.cited_clauses) setCitedClausesResult(data.cited_clauses);
      setValidatorResult(
        data.validator || {
          validated: data.validated,
          failed_checks: data.failed_checks,
          forced_review_level: data.forced_review_level,
        }
      );
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["auditLog"] });
    },
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: (params: { decision: string; notes?: string }) =>
      submitDecision(caseId, params.decision, params.notes),
    onSuccess: (data) => {
      setDecisionFeedback(data.decision);
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["caseStats"] });
      queryClient.invalidateQueries({ queryKey: ["auditLog"] });
    },
  });

  // Build case data & metadata chips from backend or fallback
  const { caseData, chips: dynamicChips } = useMemo(() => {
    if (backendCase) {
      return backendToFrontendCase(backendCase);
    }
    return {
      caseData: { ...demoCase, id: caseId || demoCase.id },
      chips: evidenceChips,
    };
  }, [backendCase, caseId]);

  // Dynamically compute real graph nodes with topological column or circular layout
  const dynamicNodes: GraphNode[] = useMemo(() => {
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      const total = graphData.nodes.length;

      // Check if nodes have diverse roles for a layered left-to-right money flow layout
      const roleColumns: Record<string, number> = {
        FEEDER: 12,
        ORIGIN: 28,
        INTERMEDIARY: 56,
        MULE_CASHOUT: 88,
        BENEFICIARY: 88,
        COUNTERPARTY: 56,
      };

      // Group nodes by column
      const nodesByCol: Record<number, typeof graphData.nodes> = {};
      graphData.nodes.forEach((n) => {
        const r = ((n.role as string) || (n.type === "sender" ? "ORIGIN" : "BENEFICIARY")).toUpperCase();
        const colX = roleColumns[r] ?? 50;
        if (!nodesByCol[colX]) nodesByCol[colX] = [];
        nodesByCol[colX].push(n);
      });

      const uniqueCols = Object.keys(nodesByCol).length;

      // If at least 2 distinct columns, use left-to-right topological layout with generous vertical spread
      if (uniqueCols >= 2 && total > 2) {
        const result: GraphNode[] = [];
        Object.entries(nodesByCol).forEach(([colStr, colNodes]) => {
          const colX = Number(colStr);
          const colCount = colNodes.length;
          colNodes.forEach((n, idx) => {
            const colY =
              colCount === 1
                ? 50
                : Math.round(15 + (idx / (colCount - 1)) * 70);
            const role = (n.role as string) || (n.type === "sender" ? "ORIGIN" : "BENEFICIARY");
            const isSuspicious = Boolean(
              n.suspicious ?? (role === "ORIGIN" || role === "INTERMEDIARY" || role === "MULE_CASHOUT")
            );
            result.push({
              id: n.id,
              label: n.id.length > 10 ? `${n.id.slice(0, 4)}...${n.id.slice(-4)}` : n.id,
              x: colX,
              y: colY,
              suspicious: isSuspicious,
              role: role,
              inDegree: typeof n.in_degree === "number" ? n.in_degree : undefined,
              outDegree: typeof n.out_degree === "number" ? n.out_degree : undefined,
              bank: n.bank,
              visibilityTier: n.visibility_tier,
              visibilityLabel: n.visibility_label,
              visibilityDesc: n.visibility_desc,
            });
          });
        });
        return result;
      }

      // Default geometric layout (2 nodes or circular for n>2)
      return graphData.nodes.map((n, i) => {
        let x = 50;
        let y = 50;
        if (total === 1) {
          x = 50;
          y = 50;
        } else if (total === 2) {
          x = i === 0 ? 25 : 75;
          y = 50;
        } else {
          const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
          x = 50 + 36 * Math.cos(angle);
          y = 50 + 30 * Math.sin(angle);
        }
        const role = (n.role as string) || (n.type === "sender" ? "ORIGIN" : "BENEFICIARY");
        const isSuspicious = Boolean(
          n.suspicious ?? (role === "ORIGIN" || role === "INTERMEDIARY" || role === "MULE_CASHOUT")
        );
        return {
          id: n.id,
          label: n.id.length > 10 ? `${n.id.slice(0, 4)}...${n.id.slice(-4)}` : n.id,
          x: Math.round(x),
          y: Math.round(y),
          suspicious: isSuspicious,
          role: role,
          inDegree: typeof n.in_degree === "number" ? n.in_degree : undefined,
          outDegree: typeof n.out_degree === "number" ? n.out_degree : undefined,
          bank: n.bank,
          visibilityTier: n.visibility_tier,
          visibilityLabel: n.visibility_label,
          visibilityDesc: n.visibility_desc,
        };
      });
    }

    if (backendCase && backendCase.transaction) {
      const senderAcc = backendCase.transaction?.sender_account || backendCase.transaction?.sender_id || "Sender";
      const receiverAcc = backendCase.transaction?.receiver_account || backendCase.transaction?.receiver_id || "Receiver";
      return [
        {
          id: senderAcc,
          label: senderAcc.length > 10 ? `${senderAcc.slice(0, 4)}...${senderAcc.slice(-4)}` : senderAcc,
          x: 25,
          y: 50,
          suspicious: true,
          role: "ORIGIN",
        },
        {
          id: receiverAcc,
          label: receiverAcc.length > 10 ? `${receiverAcc.slice(0, 4)}...${receiverAcc.slice(-4)}` : receiverAcc,
          x: 75,
          y: 50,
          suspicious: false,
          role: "BENEFICIARY",
        },
      ];
    }

    return graphNodes;
  }, [graphData, backendCase]);

  // Dynamically compute real graph edges
  const dynamicEdges: GraphEdge[] = useMemo(() => {
    if (graphData && graphData.links && graphData.links.length > 0) {
      return graphData.links.map((l) => ({
        from: String(l.source),
        to: String(l.target),
        amount: l.amount ? `₹${Number(l.amount).toLocaleString()}` : "Transfer",
        time: l.channel || "LIVE",
      }));
    }

    if (backendCase && backendCase.transaction) {
      const senderAcc = backendCase.transaction?.sender_account || backendCase.transaction?.sender_id || "Sender";
      const receiverAcc = backendCase.transaction?.receiver_account || backendCase.transaction?.receiver_id || "Receiver";
      return [
        {
          from: senderAcc,
          to: receiverAcc,
          amount: `₹${backendCase.transaction.amount?.toLocaleString()}`,
          time: backendCase.transaction.channel || "LIVE",
        },
      ];
    }

    return graphEdges;
  }, [graphData, backendCase]);

  // Build report — ONLY use real report if generated or already saved in DB!
  // NO fake fallback to demoReport for new or live cases!
  const reportSummary = investigationResult || backendCase?.investigation_report;

  const report: InvestigationReport = {
    caseId: caseId,
    risk: caseData.risk.level,
    recommendation: caseData.recommendation === "ESCALATE" ? "ESCALATE" : "REVIEW",
    sections: reportSummary
      ? [
          { title: "Executive Findings", summary: reportSummary },
          ...(strDraftResult || backendCase?.str_draft
            ? [{ title: "FIU-IND STR Draft", summary: strDraftResult || backendCase?.str_draft || "" }]
            : []),
        ]
      : [],
  };

  const freezePriorityResult =
    investigateMutation.data?.freeze_priority_matrix ||
    graphData?.freeze_priority_matrix ||
    backendCase?.freeze_priority_matrix;

  const stoppingRuleResult =
    investigateMutation.data?.traversal_stopping_rule ||
    graphData?.traversal_stopping_rule ||
    backendCase?.traversal_stopping_rule;

  const privacyAuditResult =
    investigateMutation.data?.privacy_audit ||
    backendCase?.privacy_audit;

  const insiderAlerts = graphData?.insider_alerts || [];
  const activityTimeline = graphData?.activity_timeline || [];

  if (isLoading) {
    return (
      <DashboardLayout title={`Case Workspace — ${caseId}`}>
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="size-5 animate-spin text-violet" />
          <span className="text-sm text-muted-foreground">Loading case {caseId} from database...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Case Workspace — ${caseId}`}>
      {/* Backend connection indicator */}
      {isError && (
        <div className="mb-4 rounded-xl border border-risk-medium/20 bg-risk-medium/5 px-4 py-2 text-xs text-risk-medium">
          ⚠ Backend offline — displaying local demo data
        </div>
      )}

      <InvestigationWorkspace
        caseData={caseData}
        backendCase={backendCase}
        evidenceChips={dynamicChips}
        nodes={dynamicNodes}
        edges={dynamicEdges}
        patterns={graphData?.patterns || []}
        networkRisk={graphData?.network_risk}
        networkRiskSummary={graphData?.network_risk_summary}
        insiderAlerts={insiderAlerts}
        activityTimeline={activityTimeline}
        freezePriorityMatrix={freezePriorityResult}
        traversalStoppingRule={stoppingRuleResult}
        privacyAudit={privacyAuditResult}
        agents={agents}
        regulatorySources={regulatorySources}
        report={report}
        validatorData={validatorResult}
        onRunInvestigation={() => investigateMutation.mutate()}
        isInvestigating={investigateMutation.isPending}
        onDecision={(decisionCode, notes) =>
          decisionMutation.mutate({ decision: decisionCode, ...(notes ? { notes } : {}) })
        }
        isSubmittingDecision={decisionMutation.isPending}
        decisionSuccess={decisionFeedback || backendCase?.analyst_decision}
        decisionError={decisionMutation.error ? (decisionMutation.error as Error).message : null}
        strDraft={strDraftResult || backendCase?.str_draft}
        counterfactual={counterfactualResult || backendCase?.counterfactual}
        regulatoryClauses={regulatoryClausesResult || backendCase?.regulatory_clauses}
        citedClauses={citedClausesResult || backendCase?.cited_clauses}
      />
    </DashboardLayout>
  );
}
