/**
 * API Service Layer
 * =================
 * Centralizes all communication between the React frontend and the
 * FastAPI backend at http://localhost:8000/api.
 *
 * Every function returns typed data matching our investigation types.
 * All requests include the JWT bearer token from the auth context.
 */

export const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) || "http://localhost:8000";

// ── Auth token management ──────────────────────────────────────────────────

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
  if (token) {
    sessionStorage.setItem("horizon-auth-token", token);
  } else {
    sessionStorage.removeItem("horizon-auth-token");
  }
}

export function getAuthToken(): string | null {
  if (_authToken) return _authToken;
  if (typeof window !== "undefined") {
    _authToken = sessionStorage.getItem("horizon-auth-token");
  }
  return _authToken;
}

// ── Generic fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired or invalid — clear it
    setAuthToken(null);
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Types matching backend response shapes ───────────────────────────────────

export interface BackendCase {
  case_id: string;
  transaction_id: string;
  status: string;
  risk_score: number;
  risk_band: string;
  recommended_action: string;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  analyst_id: string | null;
  analyst_decision: string | null;
  analyst_notes: string | null;
  investigation_report: string | null;
  str_draft: string | null;
  validated?: boolean | number | null;
  failed_checks?: string | string[] | null;
  forced_review_level?: string | null;
  transaction?: BackendTransaction | null;
  sender?: BackendCustomer | null;
  receiver?: BackendCustomer | null;
  regulatory_clauses?: Record<string, RegulatoryClause> | null | undefined;
  cited_clauses?: string[] | null | undefined;
  counterfactual?: CounterfactualInsight | null | undefined;
  ml_risk_score?: number | null | undefined;
  ml_risk_band?: string | null | undefined;
  freeze_priority_matrix?: import("@/types/investigation").FreezePriorityItem[] | null | undefined;
  traversal_stopping_rule?: string | null | undefined;
  privacy_audit?: import("@/types/investigation").PrivacyAuditInfo | null | undefined;
}

export interface CounterfactualInsight {
  feature: string;
  feature_label: string;
  current_value: number | string;
  counterfactual_value: number | string;
  current_band: string;
  target_band: string;
  explanation: string;
  projected_score?: number;
}

export interface RegulatoryClause {
  code: string;
  act: string;
  title: string;
  summary: string;
  authority?: string;
  filing_window?: string;
}

export interface BackendTransaction {
  transaction_id: string;
  sender_id?: string | undefined;
  receiver_id?: string | undefined;
  sender_account?: string | undefined;
  receiver_account?: string | undefined;
  amount: number;
  currency?: string | undefined;
  type?: string | undefined;
  channel?: string | undefined;
  timestamp?: string | undefined;
  old_balance_orig?: number | undefined;
  new_balance_orig?: number | undefined;
  old_balance_dest?: number | undefined;
  new_balance_dest?: number | undefined;
  sender_balance_before?: number | undefined;
  sender_balance_after?: number | undefined;
  receiver_balance_before?: number | undefined;
  receiver_balance_after?: number | undefined;
  is_flagged?: number | undefined;
  flag_reason?: string | null | undefined;
  is_vpn?: number | boolean | undefined;
  [key: string]: unknown;
}

export interface BackendCustomer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  account_type: string;
  kyc_status: string;
  risk_rating: string;
  created_at: string;
  pep_status: number;
  sanctions_hit: number;
}

export interface CaseListResponse {
  cases: BackendCase[];
  total: number;
  limit: number;
  offset: number;
}

export interface CaseStatsResponse {
  total: number;
  by_status: Array<{ status: string; count: number }>;
  by_band: Array<{ risk_band: string; count: number }>;
}

export interface ScoreResponse {
  transaction_id: string;
  risk_score: number;
  risk_band: string;
  model_probability: number;
  probability: number;
  recommended_action: string;
  top_factors: Array<{
    feature: string;
    shap_value: number;
    impact: string;
    description: string;
  }>;
  shap_values: Record<string, number>;
  rule_adjustments: string[];
  model_version: string;
  counterfactual?: CounterfactualInsight | null;
}

export interface InvestigationResponse {
  case_id: string;
  transaction_id: string;
  risk_score: number;
  model_probability: number;
  risk_band: string;
  recommended_action: string;
  investigation_report: string;
  str_draft: string;
  ai_generated: boolean;
  reasoning_source: string;
  rule_adjustments: string[];
  counterfactual?: CounterfactualInsight | null | undefined;
  regulatory_clauses?: Record<string, RegulatoryClause> | null | undefined;
  cited_clauses?: string[] | null | undefined;
  freeze_priority_matrix?: import("@/types/investigation").FreezePriorityItem[] | null | undefined;
  traversal_stopping_rule?: string | null | undefined;
  privacy_audit?: import("@/types/investigation").PrivacyAuditInfo | null | undefined;
  validated?: boolean | undefined;
  failed_checks?: string[] | undefined;
  forced_review_level?: string | null | undefined;
  validator?: {
    validated: boolean;
    failed_checks: string[];
    forced_review_level: string | null;
    details?: any;
  } | undefined;
  graph_context: {
    nodes: Array<{ id: string; type?: string }>;
    links: Array<{
      source: string;
      target: string;
      amount: number;
      transaction_id: string;
    }>;
    patterns: Array<{ type: string; description?: string }>;
    node_count: number;
    edge_count: number;
  };
}

export interface AuditLogEntry {
  log_id: number;
  id?: string | number | undefined;
  case_id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

export interface DecisionResponse {
  case_id: string;
  decision: string;
  status: string;
  decided_at: string;
}

// ── API Functions ────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user: { id?: string; email: string; name: string; role: string };
}

/** Login and get auth token */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data;
}

/** List cases with optional filters */
export function listCases(params?: {
  status?: string | undefined;
  risk_band?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
} | undefined): Promise<CaseListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.risk_band) qs.set("risk_band", params.risk_band);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch(`/api/cases${query ? `?${query}` : ""}`);
}

/** Get single case by ID (includes transaction + customer data) */
export function getCase(caseId: string): Promise<BackendCase> {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}`);
}

/** Dashboard stats */
export function getCaseStats(): Promise<CaseStatsResponse> {
  return apiFetch("/api/cases/stats/summary");
}

/** Submit analyst decision (analyst_id derived from server token) */
export function submitDecision(
  caseId: string,
  decision: string,
  notes?: string | undefined,
): Promise<DecisionResponse> {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, notes: notes ?? "" }),
  });
}

/** Score a transaction */
export function scoreTransaction(
  transactionId: string,
  amount: number,
): Promise<ScoreResponse> {
  return apiFetch("/api/score/analyze", {
    method: "POST",
    body: JSON.stringify({
      transaction_id: transactionId,
      amount,
    }),
  });
}

/** Run full investigation on a case */
export function runInvestigation(caseId: string): Promise<InvestigationResponse> {
  return apiFetch(`/api/investigate/${encodeURIComponent(caseId)}`, {
    method: "POST",
  });
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  count: number;
}

/** Get audit log for a case */
export async function getAuditLog(caseId?: string): Promise<AuditLogEntry[]> {
  const path = caseId
    ? `/api/audit/?case_id=${encodeURIComponent(caseId)}`
    : "/api/audit/";
  const data = await apiFetch<AuditLogResponse | AuditLogEntry[]>(path);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as AuditLogResponse).entries))
    return (data as AuditLogResponse).entries;
  return [];
}

/** Get STR draft for a case */
export function getStrDraft(caseId: string): Promise<{ case_id: string; str_draft: string }> {
  return apiFetch(`/api/reports/str-draft/${encodeURIComponent(caseId)}`);
}

export interface CaseGraphNode {
  id: string;
  type?: string | undefined;
  role?: string | undefined;
  suspicious?: boolean | undefined;
  in_degree?: number | undefined;
  out_degree?: number | undefined;
  bank?: string | undefined;
  visibility_tier?: string | undefined;
  visibility_label?: string | undefined;
  visibility_desc?: string | undefined;
  [key: string]: unknown;
}

export interface CaseGraphLink {
  source: string;
  target: string;
  amount?: number;
  transaction_id?: string;
  channel?: string;
  [key: string]: unknown;
}

export interface CaseGraphResponse {
  case_id: string;
  nodes: CaseGraphNode[];
  links: CaseGraphLink[];
  patterns: Array<{
    type: string;
    description: string;
    severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
    node?: string;
    nodes?: string[];
    degree?: number;
    count?: number;
    total_amount?: number;
  }>;
  network_risk?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  network_risk_summary?: string;
  insider_alerts?: Array<{
    alert_id: string;
    employee_id: string;
    pattern_type: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | string;
    evidence: Array<{ type: string; ref: string; detail: string }>;
    explanation: string;
  }>;
  activity_timeline?: Array<{
    ts: string | null;
    kind: string;
    ref: string;
    actor?: string | null;
    actor_name?: string;
    action?: string;
    detail: string;
  }>;
  freeze_priority_matrix?: import("@/types/investigation").FreezePriorityItem[] | null | undefined;
  traversal_stopping_rule?: string | null | undefined;
  transaction_count: number;
  node_count: number;
  edge_count: number;
  primary_sender?: string;
  primary_receiver?: string;
}

/** Get transaction network graph for a case from backend */
export function getCaseGraph(caseId: string): Promise<CaseGraphResponse> {
  return apiFetch(`/api/graph/${encodeURIComponent(caseId)}`);
}

export interface HealthResponse {
  status: string;
  model: string;
  version: string;
  ledger?: {
    status: string;
    url: string;
    latency_ms: number | null;
  };
}

/** Health check */
export function healthCheck(): Promise<HealthResponse> {
  return apiFetch("/health");
}

// ── User Management ──────────────────────────────────────────────────────────

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  lastActive?: string;
}

export interface UsersResponse {
  users: PlatformUser[];
  count: number;
}

export async function getUsers(): Promise<PlatformUser[]> {
  const data = await apiFetch<UsersResponse>("/api/users/");
  return data.users || [];
}

export async function createUser(payload: {
  name: string;
  email: string;
  role: string;
  password?: string;
}): Promise<PlatformUser> {
  const data = await apiFetch<{ message: string; user: PlatformUser }>("/api/users/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function updateUserStatus(userId: string, status: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Fetch authoritative regulatory compliance clauses catalog */
export function getRegulatoryClauses(): Promise<Record<string, RegulatoryClause>> {
  return apiFetch<Record<string, RegulatoryClause>>("/api/investigate/regulatory-clauses");
}

// ── Insider Risk API ─────────────────────────────────────────────────────────

export interface InsiderEvidenceItem {
  type: string;
  ref: string;
  detail: string;
}

export interface InsiderAlertRecord {
  alert_id: string;
  employee_id: string;
  employee_name?: string | null;
  case_id?: string | null;
  pattern_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | string;
  evidence: InsiderEvidenceItem[] | string | null;
  explanation: string;
  status: string;
  opened_at?: string | null;
  designation?: string | null;
  branch_city?: string | null;
}

export interface InsiderEmployee {
  employee_id: string;
  name: string;
  designation: string | null;
  department: string | null;
  branch_id: string | null;
  branch_city: string | null;
  access_tier: string | null;
  access_rights: string | null;
  employee_status: string | null;
  account_links: Array<{
    account_id: string;
    customer_id: string | null;
    relationship: string;
    declared: number;
  }>;
  open_alert_count: number;
  alert_types: string[];
  max_severity: string;
}

export interface InsiderTimelineEvent {
  action: string | null;
  entity_ref: string | null;
  details: string | null;
  timestamp: string | null;
  kind: string;
  amount?: number;
  channel?: string | null;
  sender_account?: string | null;
  receiver_account?: string | null;
}

export async function getInsiderEmployees(): Promise<InsiderEmployee[]> {
  const data = await apiFetch<{ employees: InsiderEmployee[]; total: number }>("/api/insider/employees");
  return data.employees || [];
}

export async function getInsiderAlerts(status?: string): Promise<InsiderAlertRecord[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiFetch<{ alerts: InsiderAlertRecord[]; total: number }>(`/api/insider/alerts${q}`);
  return data.alerts || [];
}

export function getEmployeeTimeline(employeeId: string): Promise<{
  employee: InsiderEmployee;
  linked_accounts: string[];
  events: InsiderTimelineEvent[];
  total_events: number;
}> {
  return apiFetch(`/api/insider/employees/${encodeURIComponent(employeeId)}/timeline`);
}

export interface AlertLifecycleResponse {
  alert_id: string;
  previous_status: string;
  status: string;
  action: string;
  actor: string;
  role: string;
  case_id: string | null;
  audited: boolean;
}

export function insiderAlertAction(
  alertId: string,
  action: "CLAIM" | "ESCALATE" | "DISMISS" | "RESOLVE" | "REOPEN",
  notes?: string,
): Promise<AlertLifecycleResponse> {
  return apiFetch(`/api/insider/alerts/${encodeURIComponent(alertId)}/action`, {
    method: "POST",
    body: JSON.stringify({ action, notes: notes || "" }),
  });
}

export interface AlertHistoryEvent {
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}

export function getInsiderAlertHistory(alertId: string): Promise<{
  alert_id: string;
  events: AlertHistoryEvent[];
  total: number;
}> {
  return apiFetch(`/api/insider/alerts/${encodeURIComponent(alertId)}/history`);
}

export interface InsiderAuditEvent {
  log_id: number;
  case_id: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}

export async function getInsiderAuditTrail(): Promise<InsiderAuditEvent[]> {
  const data = await apiFetch<{ events: InsiderAuditEvent[]; total: number }>("/api/insider/audit");
  return data.events || [];
}

export function getCaseInsiderSummary(caseId: string): Promise<{
  case_id: string;
  insider_alert_count: number;
  max_severity: string;
  alerts: InsiderAlertRecord[];
  attributed_transactions: Array<{
    transaction_id: string;
    amount: number;
    channel: string | null;
    timestamp: string | null;
    processed_by: string | null;
    employee_name: string | null;
    designation: string | null;
  }>;
}> {
  return apiFetch(`/api/insider/case/${encodeURIComponent(caseId)}/summary`);
}

