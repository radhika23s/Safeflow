import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: {
    direction: "up" | "down";
    value: number;
  };
  className?: string;
}

export function StatCard({ label, value, unit, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all duration-200 shadow-xs hover:border-violet/25 hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
          </div>
          {trend && (
            <div className="mt-2.5 flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                  trend.direction === "up"
                    ? "bg-teal/10 text-teal border-teal/20"
                    : "bg-risk-high/10 text-risk-high border-risk-high/20",
                )}
              >
                {trend.direction === "up" ? "↑" : "↓"} {trend.value}%
              </span>
              <span className="text-[11px] text-muted-foreground">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet/8 text-violet border border-violet/15 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
