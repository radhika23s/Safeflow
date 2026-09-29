export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskFactor {
  label: string;
  contribution: number;
}

export interface RiskScore {
  value: number;
  max: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface Evidence {
  label: string;
  kind: "supporting" | "counter";
}

export interface Case {
  id: string;
  alert: string;
  openedAt: string;
  risk: RiskScore;
  evidence: Evidence[];
  recommendation: "ALLOW" | "VERIFY" | "ESCALATE";
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  tier: "orchestrator" | "collection" | "reasoning" | "human";
}

export interface RegulatorySource {
  code: string;
  name: string;
}

export interface InvestigationReportSection {
  title: string;
  summary: string;
}

export interface InvestigationReport {
  caseId: string;
  risk: RiskLevel;
  recommendation: string;
  sections: InvestigationReportSection[];
}

export interface ThreatItem {
  id: string;
  category: "Fraud Pattern" | "Regulatory Update" | "Threat Intelligence";
  headline: string;
  date: string;
  description: string;
}

export interface FreezePriorityItem {
  account_id: string;
  bank: string;
  visibility_tier: string;
  role: string;
  total_inflow: number;
  inflow_pct: number;
  retained_amount: number;
  retained_pct: number;
  dwell_minutes: number;
  recovery_status: string;
  freeze_priority: string;
  recommended_action: string;
}

export interface PrivacyAuditInfo {
  pii_masked: boolean;
  policy: string;
  masked_tokens_count: number;
  sanitized_types: string[];
  token_sample?: Record<string, string>;
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  suspicious?: boolean | undefined;
  role?: "ORIGIN" | "INTERMEDIARY" | "MULE_CASHOUT" | "FEEDER" | "BENEFICIARY" | "COUNTERPARTY" | string | undefined;
  inDegree?: number | undefined;
  outDegree?: number | undefined;
  bank?: string | undefined;
  visibilityTier?: string | undefined;
  visibilityLabel?: string | undefined;
  visibilityDesc?: string | undefined;
}

export interface GraphEdge {
  from: string;
  to: string;
  amount: string;
  time: string;
}