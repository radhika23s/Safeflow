import type {
  Agent,
  Case,
  GraphEdge,
  GraphNode,
  InvestigationReport,
  RegulatorySource,
  ThreatItem,
} from "@/types/investigation";

/** Synthetic prototype data. No real customer or transaction data is used. */

export const demoCase: Case = {
  id: "FC-2026-00421",
  alert: "Unusual transaction velocity",
  openedAt: "2026-03-11T09:24:17Z",
  recommendation: "ESCALATE",
  risk: {
    value: 86,
    max: 100,
    level: "HIGH",
    factors: [
      { label: "Transaction Pattern", contribution: 24 },
      { label: "Graph Context", contribution: 18 },
      { label: "Device / IP", contribution: 12 },
      { label: "Location", contribution: 9 },
      { label: "Account Profile", contribution: 7 },
      { label: "Regulatory Signals", contribution: 4 },
    ],
  },
  evidence: [
    { label: "7 transactions in 4 minutes", kind: "supporting" },
    { label: "3 connected accounts", kind: "supporting" },
    { label: "New device detected", kind: "supporting" },
    { label: "Previous legitimate high-value activity", kind: "counter" },
  ],
};

export const evidenceChips = [
  "7 transactions / 4 min",
  "3 connected accounts",
  "New device",
  "Geo anomaly",
];

export const agents: Agent[] = [
  {
    id: "score",
    name: "Score Agent",
    role: "XGBoost ML risk scoring engine with SHAP feature attribution.",
    tier: "collection",
  },
  {
    id: "context",
    name: "Context Agent",
    role: "Multi-hop relational graph topology and money mule detection.",
    tier: "collection",
  },
  {
    id: "reason",
    name: "Reason Agent",
    role: "Gemini LLM regulatory reasoning with PMLA & RBI circular grounding.",
    tier: "reasoning",
  },
  {
    id: "decision",
    name: "Decision Agent",
    role: "Action recommendation (Block, Monitor, Dismiss, Escalate).",
    tier: "reasoning",
  },
  {
    id: "validator",
    name: "Validator Agent",
    role: "Audits regulatory citations and cross-checks decision consistency.",
    tier: "reasoning",
  },
  {
    id: "human",
    name: "Human Analyst",
    role: "Reviews findings and owns the final decision (Maker-Checker).",
    tier: "human",
  },
];

export const regulatorySources: RegulatorySource[] = [
  { code: "RBI", name: "Reserve Bank circulars" },
  { code: "NPCI", name: "Payment network guidelines" },
  { code: "PMLA", name: "Anti-money-laundering statute" },
  { code: "FATF", name: "International AML/CFT standards" },
  { code: "FIU-IND", name: "Reporting obligations" },
  { code: "DPDP", name: "Data protection duties" },
];

export const investigationSteps = [
  { step: "01", title: "Alert Received", detail: "Suspicious activity signal enters the queue." },
  { step: "02", title: "Case Created", detail: "A case record with an audit trail is opened." },
  { step: "03", title: "Evidence Collected", detail: "Transactions, device, geo and profile data." },
  { step: "04", title: "Risk Analyzed", detail: "Scoring, anomaly and velocity analysis." },
  { step: "05", title: "Regulatory Context", detail: "Grounded retrieval over regulatory documents." },
  { step: "06", title: "AI Investigation", detail: "Reasoning, evidence linking, draft findings." },
  { step: "07", title: "Human Review", detail: "Analyst validates, edits or rejects findings." },
  { step: "08", title: "Case Resolution", detail: "Decision, report and full documentation." },
];

export const demoReport: InvestigationReport = {
  caseId: "FC-2026-00421",
  risk: "HIGH",
  recommendation: "ESCALATE",
  sections: [
    {
      title: "Executive Findings",
      summary: "Rapid outbound activity across newly connected accounts within a four-minute window.",
    },
    { title: "Evidence", summary: "7 transactions, 3 connected accounts, unrecognised device." },
    { title: "Counter-Evidence", summary: "Account has a 14-month history of legitimate high-value use." },
    { title: "Risk Analysis", summary: "Score 86/100 driven mainly by pattern and graph context." },
    { title: "Regulatory Implications", summary: "Potential enhanced due diligence and STR consideration." },
    { title: "Recommended Actions", summary: "Escalate to senior analyst; request customer verification." },
  ],
};

export const threatItems: ThreatItem[] = [
  {
    id: "t1",
    category: "Fraud Pattern",
    headline: "Fan-out layering across newly onboarded accounts",
    date: "Sample data",
    description:
      "Illustrative pattern card. Connect a live intelligence feed to replace this placeholder content.",
  },
  {
    id: "t2",
    category: "Regulatory Update",
    headline: "Refreshing the regulatory knowledge base",
    date: "Sample data",
    description:
      "Placeholder entry showing how regulatory document updates surface to investigation teams.",
  },
  {
    id: "t3",
    category: "Threat Intelligence",
    headline: "Device reuse signals across unrelated customer profiles",
    date: "Sample data",
    description:
      "Mock intelligence summary. Structured so a real feed can populate the same card contract.",
  },
];

export const graphNodes: GraphNode[] = [
  { id: "A001", label: "A001", x: 18, y: 50, suspicious: true },
  { id: "A004", label: "A004", x: 55, y: 20 },
  { id: "A008", label: "A008", x: 58, y: 78, suspicious: true },
  { id: "A012", label: "A012", x: 88, y: 48 },
];

export const graphEdges: GraphEdge[] = [
  { from: "A001", to: "A004", amount: "₹4,80,000", time: "09:21" },
  { from: "A001", to: "A008", amount: "₹3,15,000", time: "09:22" },
  { from: "A008", to: "A012", amount: "₹2,90,000", time: "09:24" },
  { from: "A004", to: "A012", amount: "₹1,10,000", time: "09:25" },
];