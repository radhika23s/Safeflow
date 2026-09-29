import { graphEdges as defaultEdges, graphNodes as defaultNodes } from "@/data/mock-investigation";
import type { GraphEdge, GraphNode } from "@/types/investigation";
import { cn } from "@/lib/utils";

export function TransactionGraph({ compact = false, className, nodes = defaultNodes, edges = defaultEdges }: { compact?: boolean; className?: string; nodes?: GraphNode[]; edges?: GraphEdge[] }) {
  const pos = (id: string) => nodes.find((n) => n.id === id);
  const safeNodes = nodes.filter((node) => typeof node.x === "number" && typeof node.y === "number");
  const safeEdges = edges.filter((edge) => pos(edge.from) && pos(edge.to));

  return (
    <div className={cn("relative w-full", compact ? "aspect-4/3" : "aspect-16/10", className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" role="img" aria-label={`Transaction relationship graph between ${safeNodes.length} accounts`}>
        {safeEdges.map((edge) => {
          const a = pos(edge.from)!; const b = pos(edge.to)!;
          return <line key={`${edge.from}-${edge.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--violet)" strokeOpacity="0.45" strokeWidth="0.5" className="hz-dash" />;
        })}
      </svg>
      {safeNodes.map((node, i) => (
        <div key={node.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
          <span className={cn("absolute inset-0 rounded-full hz-pulse", node.suspicious ? "bg-risk-high/35" : "bg-teal/35")} style={{ animationDelay: `${i * 400}ms` }} aria-hidden />
          <span className={cn("relative flex items-center justify-center rounded-full border font-mono tracking-tight", compact ? "size-9 text-[0.55rem]" : "size-14 text-[0.7rem]", node.suspicious ? "border-risk-high/40 bg-risk-high/10 text-risk-high" : "border-border bg-card text-foreground")}>
            {node.label}
          </span>
        </div>
      ))}
      {!compact && <div className="pointer-events-none absolute inset-0">{safeEdges.slice(0, 3).map((edge) => { const a = pos(edge.from)!; const b = pos(edge.to)!; return <span key={`label-${edge.from}-${edge.to}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card/90 px-2 py-1 font-mono text-[0.6rem] text-muted-foreground" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}>{edge.amount} · {edge.time}</span>; })}</div>}
    </div>
  );
}
