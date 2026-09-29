import { useState } from "react";
import {
  Network,
  Route,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  Repeat,
  Share2,
  Layers,
  Info,
  X,
  Building2,
  Clock,
  ShieldCheck,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphEdge, GraphNode, FreezePriorityItem } from "@/types/investigation";

export interface InvestigationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  patterns?: Array<{
    type: string;
    description: string;
    severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string | undefined;
    count?: number | undefined;
    total_amount?: number | undefined;
  }> | undefined;
  networkRisk?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string | undefined;
  networkRiskSummary?: string | undefined;
  freezePriorityMatrix?: FreezePriorityItem[] | undefined;
  traversalStoppingRule?: string | undefined;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  ORIGIN: { label: "Origin Debitor", color: "text-risk-high bg-risk-high/10 border-risk-high/30" },
  INTERMEDIARY: { label: "Mule Intermediary", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  MULE_CASHOUT: { label: "Mule Cash-out", color: "text-risk-high bg-risk-high/10 border-risk-high/30" },
  FEEDER: { label: "Feeder Source", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" },
  BENEFICIARY: { label: "Beneficiary Payee", color: "text-teal bg-teal/10 border-teal/30" },
  COUNTERPARTY: { label: "Counterparty", color: "text-muted-foreground bg-muted/20 border-border" },
};

export function InvestigationGraph({
  nodes,
  edges,
  patterns = [],
  networkRisk = "LOW",
  networkRiskSummary,
  freezePriorityMatrix = [],
  traversalStoppingRule,
}: InvestigationGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const suspiciousNodes = nodes.filter((node) => node.suspicious).length;
  const getNode = (id: string) => nodes.find((n) => n.id === id);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

  const getRiskBadge = () => {
    switch (networkRisk?.toUpperCase()) {
      case "CRITICAL":
        return "border-risk-high/60 bg-risk-high/15 text-risk-high shadow-risk-high/20";
      case "HIGH":
        return "border-amber-500/60 bg-amber-500/15 text-amber-400 shadow-amber-500/20";
      case "MEDIUM":
        return "border-yellow-500/60 bg-yellow-500/15 text-yellow-400 shadow-yellow-500/20";
      default:
        return "border-teal/50 bg-teal/15 text-teal shadow-teal/10";
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case "STRUCTURING":
        return <Layers className="size-3.5 text-risk-high" />;
      case "CIRCULAR":
        return <Repeat className="size-3.5 text-risk-high" />;
      case "FAN_OUT":
        return <Share2 className="size-3.5 text-amber-400" />;
      case "LAYERED_MULE":
        return <ShieldAlert className="size-3.5 text-amber-400" />;
      default:
        return <AlertCircle className="size-3.5 text-risk-high" />;
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs" aria-labelledby="transaction-graph-title">
      {/* Header with Dual Risk Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">
              Network-Layer Intelligence
            </p>
            <span className="rounded bg-violet/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-violet border border-violet/20">
              NetworkX Depth-2
            </span>
          </div>
          <h2 id="transaction-graph-title" className="mt-0.5 text-lg font-bold tracking-tight text-foreground">
            Multi-Hop Transaction Topology
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {networkRisk && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono shadow-xs",
                getRiskBadge()
              )}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
              <span>Network Risk: {networkRisk}</span>
            </div>
          )}
          <Network className="size-5 text-violet" aria-hidden="true" />
        </div>
      </div>

      {networkRiskSummary && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 text-violet" />
          <span>{networkRiskSummary}</span>
        </div>
      )}

      {/* Dynamic Graph Canvas with generous vertical breathing room */}
      <div className="mt-4 relative w-full h-[460px] sm:h-[500px] rounded-xl border border-border bg-background/70 p-4 overflow-hidden shadow-inner">
        {nodes.length === 0 ? (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            No transaction nodes to display
          </div>
        ) : (
          <div className="relative size-full">
            {/* SVG Connecting Lines with directional flow */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full pointer-events-none"
            >
              <defs>
                <marker
                  id="graph-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="3"
                  markerHeight="3"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#8b5cf6" />
                </marker>
                <marker
                  id="graph-arrow-active"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerUnits="strokeWidth"
                  markerWidth="3.5"
                  markerHeight="3.5"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#ec4899" />
                </marker>
              </defs>

              {edges.map((edge, edgeIdx) => {
                const a = getNode(edge.from);
                const b = getNode(edge.to);
                if (!a || !b) return null;

                const isConnectedToSelected = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                // Offset start and end outside the node circles
                const x1 = a.x + (dx / dist) * 4.5;
                const y1 = a.y + (dy / dist) * 4.5;
                const x2 = b.x - (dx / dist) * 5.5;
                const y2 = b.y - (dy / dist) * 5.5;

                return (
                  <line
                    key={`edge-${edge.from}-${edge.to}-${edgeIdx}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isConnectedToSelected ? "#ec4899" : "#8b5cf6"}
                    strokeOpacity={isConnectedToSelected ? "1" : "0.7"}
                    strokeWidth={isConnectedToSelected ? "2" : "1"}
                    strokeDasharray={isConnectedToSelected ? "none" : "3 2"}
                    markerEnd={isConnectedToSelected ? "url(#graph-arrow-active)" : "url(#graph-arrow)"}
                  />
                );
              })}
            </svg>

            {/* Nodes: Interactive Clickable Tokens with compact sizes and clean spacing */}
            {nodes.map((node, i) => {
              const isSelected = selectedNodeId === node.id;
              const defaultRole = node.suspicious ? roleLabels["ORIGIN"]! : roleLabels["BENEFICIARY"]!;
              const roleMeta = (node.role && roleLabels[node.role]) ? roleLabels[node.role]! : defaultRole;

              return (
                <div
                  key={`node-${node.id}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group z-10 cursor-pointer"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                >
                  <div className="relative flex items-center justify-center">
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full animate-ping opacity-20",
                        node.suspicious ? "bg-risk-high" : "bg-teal",
                        isSelected && "opacity-50 scale-125"
                      )}
                      style={{ animationDuration: "3s", animationDelay: `${i * 200}ms` }}
                    />
                    <div
                      className={cn(
                        "relative flex size-9 items-center justify-center rounded-full border shadow-sm transition-all hover:scale-110",
                        isSelected
                          ? "border-pink-500 bg-pink-500/20 text-pink-400 ring-2 ring-pink-500/50 scale-110"
                          : node.suspicious
                          ? "border-risk-high/60 bg-risk-high/20 text-risk-high shadow-risk-high/10"
                          : "border-teal/50 bg-teal/20 text-teal shadow-teal/10",
                      )}
                      title={`Click to inspect Account ${node.id}`}
                    >
                      {node.suspicious ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownLeft className="size-4" />
                      )}
                    </div>
                  </div>

                  {/* Compact Account Badge & Role Tag */}
                  <div className="flex flex-col items-center max-w-[120px]">
                    <span
                      className={cn(
                        "rounded bg-background/95 px-2 py-0.5 font-mono text-[9px] font-semibold border shadow-xs tracking-tight truncate",
                        isSelected ? "border-pink-500 text-pink-400 font-bold" : "border-border text-foreground"
                      )}
                    >
                      {node.id.length > 12 ? `${node.id.slice(0, 5)}...${node.id.slice(-3)}` : node.id}
                    </span>
                    <span
                      className={cn(
                        "mt-1 rounded px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wider font-mono border whitespace-nowrap",
                        roleMeta.color
                      )}
                    >
                      {roleMeta.label}
                    </span>
                    {node.visibilityTier === "HOST_INTERNAL" && (
                      <span className="mt-0.5 rounded px-1 py-0.2 text-[6.5px] font-semibold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 whitespace-nowrap">
                        Host Ledger
                      </span>
                    )}
                    {node.visibilityTier === "EXTERNAL_LAST_CONFIRMED_HOP" && (
                      <span className="mt-0.5 rounded px-1 py-0.2 text-[6.5px] font-semibold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                        Rail Egress (Hop 1)
                      </span>
                    )}
                    {node.visibilityTier === "COLLABORATIVE_REGULATORY_LAYER" && (
                      <span className="mt-0.5 rounded px-1 py-0.2 text-[6.5px] font-semibold font-mono bg-violet/10 text-violet border border-violet/30 whitespace-nowrap">
                        NPCI / CPFIR
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Edge Badges (Amounts): Staggered along line to prevent collision */}
            {edges.map((edge, edgeIdx) => {
              const a = getNode(edge.from);
              const b = getNode(edge.to);
              if (!a || !b) return null;

              const isHighlighted = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);

              // Wave stagger offsets along the line (36% to 64%) so multiple transfers between columns don't collide
              const staggerPositions = [0.38, 0.58, 0.46, 0.66, 0.52];
              const t = staggerPositions[edgeIdx % staggerPositions.length] ?? 0.5;
              const labelX = a.x + (b.x - a.x) * t;
              const labelY = a.y + (b.y - a.y) * t;

              return (
                <div
                  key={`label-${edge.from}-${edge.to}-${edgeIdx}`}
                  className={cn(
                    "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold shadow-xs whitespace-nowrap z-20 transition-all",
                    isHighlighted
                      ? "border-pink-500/80 bg-card text-pink-400 scale-105 ring-1 ring-pink-500/40"
                      : "border-violet/30 bg-card/95 text-foreground/90 backdrop-blur-xs"
                  )}
                  style={{
                    left: `${labelX}%`,
                    top: `${labelY}%`,
                  }}
                >
                  <span className={isHighlighted ? "text-pink-400 font-extrabold" : "text-violet font-semibold"}>
                    {edge.amount}
                  </span>
                  {edge.time && <span className="ml-1 text-[8px] font-normal text-muted-foreground">· {edge.time}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-pink-500/30 bg-pink-500/10 p-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400 font-mono font-bold">
              ID
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-bold text-foreground">{selectedNode.id}</span>
                <span className="rounded bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-bold text-pink-400 font-mono uppercase">
                  {selectedNode.role || "NODE"}
                </span>
                {selectedNode.bank && (
                  <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border">
                    {selectedNode.bank}
                  </span>
                )}
                {selectedNode.visibilityLabel && (
                  <span className="rounded bg-violet/10 text-violet border border-violet/20 px-1.5 py-0.5 text-[9px] font-mono">
                    {selectedNode.visibilityLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                In-degree: <strong className="text-foreground">{selectedNode.inDegree ?? 0}</strong> · Out-degree:{" "}
                <strong className="text-foreground">{selectedNode.outDegree ?? 0}</strong> · Suspicious Flag:{" "}
                <strong className={selectedNode.suspicious ? "text-risk-high" : "text-teal"}>
                  {selectedNode.suspicious ? "YES" : "NO"}
                </strong>
              </p>
              {selectedNode.visibilityDesc && (
                <p className="text-[10px] text-muted-foreground italic mt-0.5">
                  {selectedNode.visibilityDesc}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="rounded p-1 text-muted-foreground hover:bg-pink-500/20 hover:text-foreground"
            title="Close inspector"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Pattern Alerts if detected by backend NetworkX */}
      {patterns.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Detected Relational Graph Patterns ({patterns.length})
          </p>
          <div className="flex flex-col gap-2">
            {patterns.map((p, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-xs",
                  p.severity === "CRITICAL"
                    ? "border-risk-high/40 bg-risk-high/10 text-foreground"
                    : "border-amber-500/40 bg-amber-500/10 text-foreground"
                )}
              >
                <div className="mt-0.5 shrink-0">{getPatternIcon(p.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold uppercase tracking-wider text-risk-high">
                      {p.type}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase",
                        p.severity === "CRITICAL" ? "bg-risk-high/20 text-risk-high" : "bg-amber-500/20 text-amber-400"
                      )}
                    >
                      {p.severity || "HIGH"}
                    </span>
                    {p.total_amount && (
                      <span className="font-mono text-[10px] font-bold text-violet">
                        ₹{p.total_amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-muted/30 text-center">
        <div className="p-3">
          <p className="text-xl font-bold font-mono text-foreground">{nodes.length}</p>
          <p className="text-[11px] text-muted-foreground uppercase font-mono">Accounts</p>
        </div>
        <div className="p-3">
          <p className="text-xl font-bold font-mono text-foreground">{edges.length}</p>
          <p className="text-[11px] text-muted-foreground uppercase font-mono">Transfers</p>
        </div>
        <div className="p-3">
          <p className="text-xl font-bold font-mono text-risk-high">{suspiciousNodes}</p>
          <p className="text-[11px] text-muted-foreground uppercase font-mono">Flagged</p>
        </div>
      </div>

      {/* ── Asset Recovery & Freeze Priority Matrix (Actionable Intervention) ── */}
      {freezePriorityMatrix && freezePriorityMatrix.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-risk-high" />
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Asset Recovery & Freeze Priority Matrix
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ranked by active recoverable balance and rapid mule dwell time per RBI FRM 2024 directives.
              </p>
            </div>
            <span className="rounded bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border">
              {freezePriorityMatrix.length} Downstream Account{freezePriorityMatrix.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {freezePriorityMatrix.map((item, idx) => {
              const isP1 = item.freeze_priority === "P1_IMMEDIATE_DEBIT_FREEZE";
              const isP2 = item.freeze_priority === "P2_PROVISIONAL_LIEN";

              return (
                <div
                  key={`freeze-${item.account_id}-${idx}`}
                  className={cn(
                    "flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-3 text-xs shadow-2xs transition-all",
                    isP1
                      ? "border-risk-high/40 bg-risk-high/5 hover:border-risk-high/60"
                      : isP2
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                      : "border-border bg-card/50 hover:border-border/80"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold border",
                        isP1
                          ? "border-risk-high/40 bg-risk-high/20 text-risk-high"
                          : isP2
                          ? "border-amber-500/40 bg-amber-500/20 text-amber-400"
                          : "border-border bg-muted/30 text-muted-foreground"
                      )}
                    >
                      #{idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">{item.account_id}</span>
                        <span className="rounded bg-background px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground border">
                          {item.bank}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 font-mono text-[8.5px] font-semibold border",
                            item.visibility_tier === "HOST_INTERNAL"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : item.visibility_tier === "EXTERNAL_LAST_CONFIRMED_HOP"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-violet/10 text-violet border-violet/30"
                          )}
                        >
                          {item.visibility_tier === "HOST_INTERNAL"
                            ? "Host Ledger"
                            : item.visibility_tier === "EXTERNAL_LAST_CONFIRMED_HOP"
                            ? "Rail Egress (Hop 1)"
                            : "NPCI / CPFIR"}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {item.recommended_action}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-border/50">
                    <div className="text-left md:text-right">
                      <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                        <span>₹{item.retained_amount.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({item.retained_pct}% retained)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>Dwell: {item.dwell_minutes}m</span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[10px] font-bold font-mono tracking-tight border uppercase whitespace-nowrap",
                        isP1
                          ? "border-risk-high/50 bg-risk-high/20 text-risk-high"
                          : isP2
                          ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                          : "border-purple-500/50 bg-purple-500/20 text-purple-400"
                      )}
                    >
                      {isP1 ? "Immediate Freeze" : isP2 ? "Provisional Lien" : "NCRP Referral"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bank Visibility & Traversal Stopping-Rule Notice ── */}
      <div className="mt-4 rounded-xl border border-violet/20 bg-violet/5 p-3.5 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-2">
          <Building2 className="size-3.5 text-violet shrink-0" />
          <strong className="text-foreground text-[11px] font-semibold">
            Bank Visibility Boundary & Traversal Stopping Rule
          </strong>
        </div>
        <p className="text-[11px] leading-relaxed">
          {traversalStoppingRule ||
            "Traversal dynamically halted upon reaching terminal cash-out endpoints (leaves) and inter-bank payment rail egress perimeters. Direct single-bank visibility terminates at Hop 1 (counterparty IFSC/UPI metadata). Multi-bank tracking beyond the host perimeter is coordinated via central switch federation (NPCI Switch & RBI CPFIR / DAKSH platform) upon STR transmission."}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Route className="size-3.5 text-violet" aria-hidden="true" />
        Multi-hop relational topology reconstructed via NetworkX from ledger database.
      </div>
    </section>
  );
}
