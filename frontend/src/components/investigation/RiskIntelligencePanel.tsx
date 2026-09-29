import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskScore } from "@/types/investigation";
import type { CounterfactualInsight } from "@/lib/api";

const levelStyle = {
  LOW: "text-risk-low bg-risk-low/10",
  MEDIUM: "text-risk-medium bg-risk-medium/10",
  HIGH: "text-risk-high bg-risk-high/10",
  CRITICAL: "text-risk-critical bg-risk-critical/10",
};

export function RiskIntelligencePanel({
  risk,
  networkRisk,
  networkRiskSummary,
  counterfactual,
  mlRiskValue,
  mlRiskLevel,
}: {
  risk: RiskScore;
  networkRisk?: string | undefined;
  networkRiskSummary?: string | undefined;
  counterfactual?: CounterfactualInsight | null | undefined;
  mlRiskValue?: number | undefined;
  mlRiskLevel?: string | undefined;
}) {
  const maxContribution = Math.max(...risk.factors.map((factor) => factor.contribution));
  const majorFactors = risk.factors.slice(0, 4);

  const displayMlValue = mlRiskValue != null ? mlRiskValue : risk.value;
  const displayMlLevel = (mlRiskLevel || risk.level).toUpperCase() as keyof typeof levelStyle;

  const netRiskLevel = (networkRisk || "LOW").toUpperCase();
  const netStyle =
    netRiskLevel === "CRITICAL"
      ? "text-risk-high bg-risk-high/15 border-risk-high/40"
      : netRiskLevel === "HIGH"
      ? "text-amber-400 bg-amber-500/15 border-amber-500/40"
      : netRiskLevel === "MEDIUM"
      ? "text-yellow-400 bg-yellow-500/15 border-yellow-500/40"
      : "text-teal bg-teal/15 border-teal/40";

  return (
    <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="risk-intelligence-title">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase font-mono">
            Dual Risk Intelligence
          </p>
          <h2 id="risk-intelligence-title" className="mt-1 text-lg font-semibold text-foreground">
            Risk Assessment
          </h2>
        </div>
        <AlertTriangle className="size-5 text-risk-high" aria-hidden="true" />
      </div>

      {/* Dual Risk Cards: ML Transaction Risk + NetworkX Graph Risk */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {/* ML Transaction Risk */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 transition-colors hover:border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              ML Transaction Risk
            </span>
            <span className={cn("rounded-md border px-2 py-0.5 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider font-mono shrink-0", levelStyle[displayMlLevel] || levelStyle.LOW)}>
              {displayMlLevel}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{displayMlValue}</span>
            <span className="text-xs font-semibold text-muted-foreground">/ {risk.max}</span>
          </div>
          <span className="mt-1.5 block text-[10px] text-muted-foreground font-mono">XGBoost Feature Attribution</span>
        </div>

        {/* NetworkX Relational Risk */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 transition-colors hover:border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Network Topology Risk
            </span>
            <span className={cn("rounded-md border px-2 py-0.5 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider font-mono shrink-0", netStyle)}>
              NetworkX
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground">{netRiskLevel}</span>
          </div>
          <span className="mt-1.5 block text-[10px] text-muted-foreground truncate" title={networkRiskSummary || "Multi-hop Graph Analysis"}>
            {networkRiskSummary || "Multi-hop Relational Analysis"}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground font-mono">
          Key Factors
        </h3>
        <div className="mt-3 space-y-2.5">
          {majorFactors.map((factor) => (
            <div key={factor.label} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-foreground truncate">{factor.label}</span>
              <span className="font-mono text-[11px] font-semibold text-risk-high tabular-nums shrink-0">+{factor.contribution}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground font-mono">
          Contribution profile
        </h3>
        <ul className="mt-4 space-y-3">
          {risk.factors.map((factor) => (
            <li key={factor.label}>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-foreground">{factor.label}</span>
                <span className="font-mono text-muted-foreground">+{factor.contribution}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet" style={{ width: `${(factor.contribution / maxContribution) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Phase 4: SHAP Counterfactual Explanation */}
      {counterfactual && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-violet">
              <Sparkles className="size-3.5 text-violet" aria-hidden="true" />
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] font-mono text-violet">
                Counterfactual Explanation
              </h3>
            </div>
            <span className="rounded-md border border-violet/30 bg-violet/10 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-violet">
              {counterfactual.current_band} ➔ {counterfactual.target_band}
            </span>
          </div>

          <div className="rounded-xl border border-violet/25 bg-gradient-to-br from-violet/10 via-violet/5 to-transparent p-3.5 shadow-xs">
            <p className="text-xs font-medium leading-relaxed text-foreground">
              &ldquo;{counterfactual.explanation}&rdquo;
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-violet/15 pt-2">
              <span>Driver: <strong className="text-foreground">{counterfactual.feature_label}</strong></span>
              {counterfactual.projected_score !== undefined && (
                <span>Projected Risk: <strong className="text-teal font-semibold">{counterfactual.projected_score}/100</strong></span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
