import { useState, useMemo } from "react";
import {
  Check,
  CircleDot,
  ClipboardCheck,
  FileText,
  Gavel,
  ShieldCheck,
  ShieldAlert,
  X,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertTriangle,
  Download,
  Copy,
  FileCheck,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { AgentStatus, type InvestigationAgentProgress } from "@/components/dashboard/AgentStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";
import type { Agent, Case, GraphEdge, GraphNode, InvestigationReport, RegulatorySource, FreezePriorityItem, PrivacyAuditInfo } from "@/types/investigation";
import type { BackendCase } from "@/lib/api";
import { useRole } from "@/context/RoleContext";
import { InvestigationGraph } from "./InvestigationGraph";
import { RiskIntelligencePanel } from "./RiskIntelligencePanel";
import { InsiderRiskPanel, type InsiderAlert, type TimelineEvent } from "./InsiderRiskPanel";
import { TraceableText, CitedClausesList } from "./ClauseTraceability";
import type { CounterfactualInsight, RegulatoryClause } from "@/lib/api";

export interface InvestigationWorkspaceProps {
  caseData: Case;
  evidenceChips: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  patterns?: Array<{
    type: string;
    description: string;
    severity?: string | undefined;
    count?: number | undefined;
    total_amount?: number | undefined;
  }> | undefined;
  networkRisk?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string | undefined;
  networkRiskSummary?: string | undefined;
  insiderAlerts?: InsiderAlert[] | null | undefined;
  activityTimeline?: TimelineEvent[] | null | undefined;
  freezePriorityMatrix?: FreezePriorityItem[] | null | undefined;
  traversalStoppingRule?: string | null | undefined;
  privacyAudit?: PrivacyAuditInfo | null | undefined;
  agents: Agent[];
  regulatorySources: RegulatorySource[];
  report: InvestigationReport;
  backendCase?: BackendCase | null | undefined;
  validatorData?: {
    validated?: boolean | undefined;
    failed_checks?: string[] | undefined;
    forced_review_level?: string | null | undefined;
    details?: any;
  } | null | undefined;
  onRunInvestigation?: (() => void) | undefined;
  isInvestigating?: boolean | undefined;
  onDecision?: ((decision: string, notes?: string | undefined) => void) | undefined;
  isSubmittingDecision?: boolean | undefined;
  decisionSuccess?: string | null | undefined;
  decisionError?: string | null | undefined;
  strDraft?: string | null | undefined;
  counterfactual?: CounterfactualInsight | null | undefined;
  regulatoryClauses?: Record<string, RegulatoryClause> | null | undefined;
  citedClauses?: string[] | null | undefined;
}

const agentIds = ["score", "context", "reason", "decision", "validator"];

export function InvestigationWorkspace({
  caseData,
  evidenceChips,
  nodes,
  edges,
  patterns = [],
  networkRisk,
  networkRiskSummary,
  insiderAlerts = [],
  activityTimeline = [],
  freezePriorityMatrix = null,
  traversalStoppingRule = null,
  privacyAudit = null,
  agents,
  regulatorySources,
  report,
  backendCase,
  validatorData,
  onRunInvestigation,
  isInvestigating = false,
  onDecision,
  isSubmittingDecision = false,
  decisionSuccess = null,
  decisionError = null,
  strDraft = null,
  counterfactual = null,
  regulatoryClauses = null,
  citedClauses = null,
}: InvestigationWorkspaceProps) {
  const { role, loginWithRole } = useRole();
  const [localDecision, setLocalDecision] = useState<string | null>(null);
  const [copiedStr, setCopiedStr] = useState(false);

  // RBAC: which decision buttons does this role hold? (matrix in lib/permissions.ts,
  // enforced server-side in backend/routers/cases.py — UI only hides what's forbidden)
  const canBlock = can(role, "case.decide_block");
  const canFlag = can(role, "case.decide_flag");
  const canDismiss = can(role, "case.decide_dismiss");
  const canEscalate = can(role, "case.decide_escalate");
  const hasAnyDecisionPower = canBlock || canFlag || canDismiss || canEscalate;

  const supporting = caseData.evidence.filter((item) => item.kind === "supporting");
  const counter = caseData.evidence.filter((item) => item.kind === "counter");
  const investigationAgents = agents.filter((agent) => agentIds.includes(agent.id));
  const recommendationReasoning =
    report.sections.find((section) => section.title.includes("Findings") || section.title.includes("Report"))?.summary ||
    backendCase?.investigation_report;

  const failedChecks: string[] = useMemo(() => {
    if (validatorData?.failed_checks && Array.isArray(validatorData.failed_checks)) {
      return validatorData.failed_checks;
    }
    if (backendCase?.failed_checks) {
      if (Array.isArray(backendCase.failed_checks)) return backendCase.failed_checks;
      try {
        const parsed = JSON.parse(backendCase.failed_checks);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [String(backendCase.failed_checks)];
      }
    }
    return [];
  }, [validatorData, backendCase]);

  const isValidated = useMemo(() => {
    if (validatorData?.validated !== undefined) {
      return Boolean(validatorData.validated);
    }
    if (backendCase?.validated !== undefined && backendCase?.validated !== null) {
      return backendCase.validated === 1 || backendCase.validated === true;
    }
    return null;
  }, [validatorData, backendCase]);

  const forcedReviewLevel = validatorData?.forced_review_level || backendCase?.forced_review_level;
  const hasValidationRun = Boolean(recommendationReasoning && (isValidated !== null || failedChecks.length > 0 || forcedReviewLevel));

  const handleDecisionClick = (action: string, backendCode: string) => {
    setLocalDecision(action);
    if (onDecision) {
      onDecision(backendCode);
    }
  };

  const copyStrDraft = () => {
    const textToCopy = strDraft || backendCase?.str_draft || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedStr(true);
      setTimeout(() => setCopiedStr(false), 2500);
    }
  };

  // Dynamic agent progress based on 5-agent pipeline state
  const progressByAgent: Record<string, InvestigationAgentProgress> = isInvestigating
    ? {
        score: { status: "Running", activity: "Evaluating XGBoost model + SHAP attribution signals...", progress: 95, findingCount: 3 },
        context: { status: "Running", activity: "Analyzing multi-hop graph topology & mule accounts...", progress: 80, findingCount: 4 },
        reason: { status: "Running", activity: "Synthesizing regulatory findings with Gemini...", progress: 60, findingCount: 2 },
        decision: { status: "Waiting", activity: "Awaiting reasoning synthesis...", progress: 0, findingCount: 0 },
        validator: { status: "Waiting", activity: "Awaiting decision output for citation verification...", progress: 0, findingCount: 0 },
      }
    : recommendationReasoning
      ? {
          score: { status: "Completed", activity: "XGBoost score & SHAP explainability drivers computed", progress: 100, findingCount: 3 },
          context: { status: "Completed", activity: "Multi-hop relational topology evaluated", progress: 100, findingCount: 4 },
          reason: { status: "Completed", activity: "Gemini regulatory reasoning report generated", progress: 100, findingCount: 2 },
          decision: { status: "Completed", activity: `Action recommended: ${backendCase?.recommended_action || caseData.recommendation}`, progress: 100, findingCount: 1 },
          validator: {
            status: isValidated === true ? "Completed" : isValidated === false ? "Needs Review" : "Completed",
            activity: isValidated === false
              ? `Validation flags: ${failedChecks.join(", ") || "Audit warnings raised"}`
              : "All regulatory citations & decision rules grounded & verified",
            progress: 100,
            findingCount: failedChecks.length,
          },
        }
      : {
          score: { status: "Waiting", activity: "Awaiting trigger", progress: 0, findingCount: 0 },
          context: { status: "Waiting", activity: "Awaiting trigger", progress: 0, findingCount: 0 },
          reason: { status: "Waiting", activity: "Awaiting trigger", progress: 0, findingCount: 0 },
          decision: { status: "Waiting", activity: "Awaiting trigger", progress: 0, findingCount: 0 },
          validator: { status: "Waiting", activity: "Awaiting trigger", progress: 0, findingCount: 0 },
        };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      {/* Header */}
      <header className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">
                Investigation workspace
              </span>
              <span className="inline-flex items-center rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-semibold text-violet">
                AI + Human-in-the-Loop
              </span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight text-foreground">
              Case {caseData.id}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{caseData.alert}</p>
          </div>

          {/* Action button & metadata */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onRunInvestigation && (
              <Button
                onClick={onRunInvestigation}
                disabled={isInvestigating}
                size="lg"
                className="gap-2 rounded-xl bg-violet text-white shadow-sm hover:bg-violet/90 transition-all font-semibold"
              >
                {isInvestigating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running AI Agents...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-teal" />
                    Run AI Investigation
                  </>
                )}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Risk Level</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-bold",
                    caseData.risk.level === "CRITICAL" || caseData.risk.level === "HIGH"
                      ? "text-risk-high"
                      : caseData.risk.level === "MEDIUM"
                        ? "text-risk-medium"
                        : "text-risk-low",
                  )}
                >
                  {caseData.risk.level} · {caseData.risk.value}/100
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Status</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {backendCase?.status || "OPEN"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Action</p>
                <p className="mt-0.5 text-xs font-semibold text-violet">
                  {caseData.recommendation}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Opened</p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-foreground">
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "short" }).format(
                    new Date(caseData.openedAt || Date.now()),
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Graph and Risk Panels */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <InvestigationGraph
          nodes={nodes}
          edges={edges}
          patterns={patterns}
          networkRisk={networkRisk}
          networkRiskSummary={networkRiskSummary}
          freezePriorityMatrix={freezePriorityMatrix || backendCase?.freeze_priority_matrix || []}
          traversalStoppingRule={traversalStoppingRule || backendCase?.traversal_stopping_rule || undefined}
        />
        <RiskIntelligencePanel
          risk={caseData.risk}
          networkRisk={networkRisk}
          networkRiskSummary={networkRiskSummary}
          counterfactual={counterfactual || backendCase?.counterfactual || null}
          mlRiskValue={backendCase?.ml_risk_score != null ? backendCase.ml_risk_score : undefined}
          mlRiskLevel={backendCase?.ml_risk_band || undefined}
        />
      </div>

      {/* Insider Risk: employee × money-flow evidence & activity timeline */}
      <InsiderRiskPanel alerts={insiderAlerts} timeline={activityTimeline} />

      {/* AI Agents Pipeline Status */}
      <AgentStatus agents={investigationAgents} progressByAgent={progressByAgent} />

      {/* AI Investigation Report Section */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs" aria-labelledby="recommendation-title">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 text-violet" aria-hidden="true" />
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">
                AI Investigation & Reason Agent Report
              </p>
              <h2 id="recommendation-title" className="mt-1 text-lg font-bold text-foreground">
                Executive Synthesis · {caseData.recommendation}
              </h2>
            </div>
          </div>
          {onRunInvestigation && !recommendationReasoning && (
            <Button
              onClick={onRunInvestigation}
              disabled={isInvestigating}
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
            >
              <Sparkles className="size-3.5 text-violet" />
              Generate Report
            </Button>
          )}
        </div>

        {recommendationReasoning ? (
          <div className="mt-4 space-y-4">
            {/* Banking Privacy & Zero-Knowledge Tokenization Shield */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">Banking Privacy Shield: Active</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase">
                      Zero Customer PII Sent to LLM
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Account & transaction identifiers tokenized via client perimeter masking (DPDP Act 2023 & RBI IT Outsourcing Framework).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px] text-emerald-400 bg-background/80 px-2 py-1 rounded border border-emerald-500/30 font-semibold">
                  {privacyAudit?.masked_tokens_count ? `${privacyAudit.masked_tokens_count} Tokens Masked` : "Perimeter Sanitized"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-violet/20 bg-violet/5 p-4 text-sm leading-relaxed text-foreground font-sans">
              <TraceableText
                text={recommendationReasoning}
                clauses={regulatoryClauses || backendCase?.regulatory_clauses}
                className="whitespace-pre-wrap leading-relaxed"
              />
            </div>

            {/* If STR draft exists */}
            {(strDraft || backendCase?.str_draft) && (
              <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileCheck className="size-4 text-teal" />
                    <span className="text-xs font-bold text-teal uppercase tracking-wider">
                      FIU-IND Suspicious Transaction Report (STR) Draft
                    </span>
                    <span className="hidden sm:inline-flex rounded bg-teal/15 px-1.5 py-0.5 text-[9px] font-mono text-teal font-semibold">
                      Hover clause citations [PMLA_S12] for statutory grounding
                    </span>
                  </div>
                  <Button
                    onClick={copyStrDraft}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 shrink-0"
                  >
                    {copiedStr ? <Check className="size-3 text-teal" /> : <Copy className="size-3" />}
                    {copiedStr ? "Copied" : "Copy STR"}
                  </Button>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg bg-background/80 p-3.5 text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap border border-border">
                  <TraceableText
                    text={strDraft || backendCase?.str_draft || ""}
                    clauses={regulatoryClauses || backendCase?.regulatory_clauses}
                  />
                </div>
              </div>
            )}

            {/* Agent 5: Validator Agent Audit & Regulatory Fact-Check Panel */}
            {hasValidationRun && (
              <div
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  isValidated
                    ? "border-teal/30 bg-teal/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-border/60">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border shrink-0",
                        isValidated
                          ? "border-teal/30 bg-teal/10 text-teal"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      )}
                    >
                      {isValidated ? (
                        <CheckCircle2 className="size-4.5" />
                      ) : (
                        <ShieldAlert className="size-4.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Validator Agent (Agent 5) Audit
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            isValidated
                              ? "border-teal/30 bg-teal/10 text-teal"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          )}
                        >
                          {isValidated ? "VERIFIED & GROUNDED" : "AUDIT FLAGS DETECTED"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Autonomous fact-checking of cited regulations and decision consistency
                      </p>
                    </div>
                  </div>

                  {forcedReviewLevel && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono">Review Mandate:</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border uppercase tracking-wider",
                          forcedReviewLevel === "manager"
                            ? "border-risk-high/40 bg-risk-high/15 text-risk-high animate-pulse"
                            : "border-violet/30 bg-violet/10 text-violet"
                        )}
                      >
                        <Lock className="size-3" />
                        {forcedReviewLevel} Review Enforced
                      </span>
                    </div>
                  )}
                </div>

                {/* 3-Point Validation Matrix */}
                <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3 text-xs">
                  <div
                    className={cn(
                      "rounded-lg border p-2.5",
                      failedChecks.includes("citation_exists") || failedChecks.includes("no_citations_extracted")
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-teal/20 bg-teal/5 text-teal"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase">1. Citation Existence</span>
                      {failedChecks.includes("citation_exists") || failedChecks.includes("no_citations_extracted") ? (
                        <span className="text-[10px] text-amber-400 font-bold">FLAGGED</span>
                      ) : (
                        <span className="text-[10px] text-teal font-bold">PASSED</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                      {failedChecks.includes("no_citations_extracted")
                        ? "Zero statutory citations extracted from report"
                        : failedChecks.includes("citation_exists")
                        ? "Cited section not recognized in statutory registry"
                        : "All cited statutes confirmed in regulatory DB"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-2.5",
                      failedChecks.includes("citation_relevant")
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-teal/20 bg-teal/5 text-teal"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase">2. Statutory Relevance</span>
                      {failedChecks.includes("citation_relevant") ? (
                        <span className="text-[10px] text-amber-400 font-bold">LOW OVERLAP</span>
                      ) : (
                        <span className="text-[10px] text-teal font-bold">PASSED</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                      {failedChecks.includes("citation_relevant")
                        ? "Citation context lacks sufficient keyword overlap with statutory mandate"
                        : "Claim context closely matches statutory provisions"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-2.5",
                      failedChecks.includes("decision_consistent")
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-teal/20 bg-teal/5 text-teal"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase">3. Decision Consistency</span>
                      {failedChecks.includes("decision_consistent") ? (
                        <span className="text-[10px] text-amber-400 font-bold">CONFLICT</span>
                      ) : (
                        <span className="text-[10px] text-teal font-bold">PASSED</span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                      {failedChecks.includes("decision_consistent")
                        ? "Recommended action conflicts with risk score band"
                        : "Action mathematically aligns with risk band thresholds"}
                    </p>
                  </div>
                </div>

                {failedChecks.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400 font-medium">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      Audit Notice: Discrepancies detected ({failedChecks.join(", ")}).
                      Elevated review protocol enforced by Validator Agent.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
            <Sparkles className="size-8 text-violet/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">AI Investigation Report Not Yet Generated</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Click &quot;Run AI Investigation&quot; to execute the multi-agent pipeline (scoreAgent, contextAgent, reasonAgent, decisionAgent) powered by Gemini.
            </p>
            {onRunInvestigation && (
              <Button
                onClick={onRunInvestigation}
                disabled={isInvestigating}
                size="sm"
                className="mt-4 gap-1.5 bg-violet text-white text-xs"
              >
                <Sparkles className="size-3.5" />
                Run AI Investigation Now
              </Button>
            )}
          </div>
        )}

        <div className="mt-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Supporting signals</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {supporting.map((item) => (
              <span key={item.label} className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence and Regulatory Registers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs" aria-labelledby="evidence-title">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">Evidence</p>
          <h2 id="evidence-title" className="mt-1 text-lg font-bold tracking-tight text-foreground">Evidence register</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-semibold text-teal">
                <Check className="size-4" />Supporting evidence
              </h3>
              <ul className="mt-3 space-y-2">
                {supporting.map((item) => (
                  <li key={item.label} className="text-xs text-muted-foreground">{item.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-xs font-semibold text-risk-medium">
                <X className="size-4" />Counter evidence
              </h3>
              <ul className="mt-3 space-y-2">
                {counter.length > 0 ? (
                  counter.map((item) => (
                    <li key={item.label} className="text-xs text-muted-foreground">{item.label}</li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground italic">No mitigating signals observed</li>
                )}
              </ul>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            {evidenceChips.map((chip) => (
              <span key={chip} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground font-mono">
                {chip}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs" aria-labelledby="regulatory-title">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">Regulatory context</p>
          <h2 id="regulatory-title" className="mt-1 text-lg font-bold tracking-tight text-foreground">Sources consulted</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">Grounding statutory clauses & directives cited for FIU-IND compliance.</p>
          {recommendationReasoning ? (
            <div className="mt-4">
              <CitedClausesList
                citedCodes={
                  citedClauses ||
                  backendCase?.cited_clauses || [
                    "PMLA_S12",
                    "PMLA_S3",
                    "RBI_MD_KYC_2016_PARA_23",
                    "RBI_MD_KYC_2016_PARA_37",
                    "RBI_FRM_2024_CIRCULAR",
                    "NPCI_OC_138_MULE",
                    "NPCI_UPI_2023_PARA_5",
                  ]
                }
                clauses={regulatoryClauses || backendCase?.regulatory_clauses}
              />
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
              <FileCheck className="size-6 text-muted-foreground/40 mb-1.5" />
              <p className="text-xs font-semibold text-muted-foreground">No Regulatory Sources Consulted Yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
                Regulatory statutes (RBI circulars, PMLA rules, NPCI guidelines) will be cross-referenced during the AI investigation.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Decision Owner (Human-in-the-Loop) */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs" aria-labelledby="human-decision-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="size-5 text-foreground" aria-hidden="true" />
              <h2 id="human-decision-title" className="text-lg font-bold tracking-tight text-foreground">
                Analyst Decision & Maker-Checker
              </h2>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs text-muted-foreground">
              AI recommends, human decides. Submit your final verdict to commit to the immutable audit trail.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CircleDot className="size-3.5 text-teal" />
              Backed by live SQLite audit logging and FIU-IND compliance rules.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {!recommendationReasoning && (
              <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400 font-medium">
                <Lock className="size-3 shrink-0" />
                <span>Run AI Investigation above to unlock decision controls</span>
              </div>
            )}
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={localDecision === "Block" ? "destructive" : "outline"}
                  disabled={isSubmittingDecision || !recommendationReasoning || !canBlock}
                  onClick={() => handleDecisionClick("Block", "APPROVE_BLOCK")}
                  className={cn(
                    "gap-1.5 text-xs border-risk-high/30 text-risk-high",
                    recommendationReasoning && canBlock
                      ? "hover:bg-risk-high/10"
                      : "opacity-40 cursor-not-allowed"
                  )}
                  title={
                    !canBlock
                      ? role === "administrator"
                        ? "Administrator is view-only (3rd Line) — no case decisions"
                        : "Requires manager sign-off (2nd Line)"
                      : undefined
                  }
                >
                  <ShieldAlert className="size-4" />
                  Block & Report
                  {!canBlock && <Lock className="size-3 ml-1" />}
                </Button>
                <Button
                  type="button"
                  variant={localDecision === "Flag" ? "secondary" : "outline"}
                  disabled={isSubmittingDecision || !recommendationReasoning || !canFlag}
                  onClick={() => handleDecisionClick("Flag", "APPROVE_FLAG")}
                  className={cn(
                    "gap-1.5 text-xs border-amber-500/30 text-amber-400",
                    recommendationReasoning && canFlag ? "hover:bg-amber-500/10" : "opacity-50 cursor-not-allowed"
                  )}
                  title={!canFlag ? "Administrator is view-only (3rd Line) — no case decisions" : undefined}
                >
                  <ClipboardCheck className="size-4" />
                  Flag for Monitoring
                  {!canFlag && <Lock className="size-3 ml-1" />}
                </Button>
                <Button
                  type="button"
                  variant={localDecision === "Dismiss" ? "default" : "outline"}
                  disabled={isSubmittingDecision || !recommendationReasoning || !canDismiss}
                  onClick={() => handleDecisionClick("Dismiss", "DISMISS")}
                  className={cn(
                    "gap-1.5 text-xs border-risk-low/30 text-risk-low",
                    recommendationReasoning && canDismiss
                      ? "hover:bg-risk-low/10"
                      : "opacity-40 cursor-not-allowed"
                  )}
                  title={
                    !canDismiss
                      ? "Administrator is view-only (3rd Line) — no case decisions"
                      : "Dismiss case if verified benign or false positive"
                  }
                >
                  <ShieldCheck className="size-4" />
                  Dismiss Case
                  {!canDismiss && <Lock className="size-3 ml-1" />}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={isSubmittingDecision || !recommendationReasoning || !canEscalate}
                  onClick={() => handleDecisionClick("Escalate", "ESCALATE")}
                  className={cn(
                    "gap-1.5 text-xs bg-violet text-white hover:bg-violet/90 ring-1 ring-violet/50 font-bold",
                    (!recommendationReasoning || !canEscalate) && "opacity-50 cursor-not-allowed"
                  )}
                  title={!canEscalate ? "Administrator is view-only (3rd Line) — no case decisions" : undefined}
                >
                  <ArrowUpRight className="size-4" />
                  {role === "manager" ? "Escalate to Committee" : "Escalate to Manager"}
                  {!canEscalate && <Lock className="size-3 ml-1" />}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <span>
                  {role === "investigator"
                    ? "• Mode: Investigator (1st Line) — Can Flag, Dismiss false positives, or Escalate. Account Blocking requires Manager sign-off."
                    : role === "manager"
                    ? "• Mode: Manager (2nd Line Checker) — Signatory authority & Account Blocking active."
                    : "• Mode: Administrator (3rd Line) — View & audit only. Zero case-decision authority by design."}
                </span>
                {role === "investigator" && (
                  <button
                    type="button"
                    onClick={() => loginWithRole("manager")}
                    className="text-violet hover:text-violet/80 underline font-semibold transition-colors cursor-pointer"
                  >
                    Switch to Manager (Sarah Chen) →
                  </button>
                )}
                {role === "manager" && (
                  <button
                    type="button"
                    onClick={() => loginWithRole("investigator")}
                    className="text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
                  >
                    Switch back to Investigator
                  </button>
                )}
                {role === "administrator" && (
                  <button
                    type="button"
                    onClick={() => loginWithRole("manager")}
                    className="text-violet hover:text-violet/80 underline font-semibold transition-colors cursor-pointer"
                  >
                    Switch to Manager (Sarah Chen) to decide →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {decisionSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 p-3 text-xs font-semibold text-teal">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              {decisionSuccess === "APPROVE_BLOCK"
                ? "Account Blocked & FIU-IND STR Filed. Case status marked CLOSED. Immutable audit trail entry committed."
                : decisionSuccess === "APPROVE_FLAG"
                ? "Account Flagged for Enhanced Due Diligence (EDD). Case status marked MONITORING. Audit trail entry committed."
                : decisionSuccess === "DISMISS"
                ? "Case Dismissed as False Positive. Case status marked CLOSED. Audit trail entry committed."
                : decisionSuccess === "ESCALATE"
                ? "Case Escalated to Senior Compliance Manager (Sarah Chen). Case status updated to ESCALATED. Audit trail entry committed."
                : `Decision recorded: ${decisionSuccess} (Audit trail entry committed).`}
            </span>
          </div>
        )}

        {decisionError && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              <span>{decisionError}</span>
            </div>
            {role === "investigator" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => loginWithRole("manager")}
                className="gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs h-7 shrink-0"
              >
                <span>Switch to Manager View & Sign Off</span>
                <ArrowRight className="size-3" />
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
