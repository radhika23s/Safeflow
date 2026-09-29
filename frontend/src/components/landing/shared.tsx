import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types/investigation";

export function useInView<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={cn("hz-reveal", visible && "is-visible", className)}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        tone === "light"
          ? "border-border bg-muted text-accent-foreground"
          : "border-section-emphasis-border bg-section-emphasis-surface text-section-emphasis-accent",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  tone = "light",
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  tone?: "light" | "dark";
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "text-3xl leading-tight font-semibold tracking-tight text-balance md:text-[2.6rem]",
          tone === "dark" ? "text-section-emphasis-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("text-base leading-relaxed", tone === "dark" ? "text-section-emphasis-muted" : "text-muted-foreground")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

const riskStyles: Record<RiskLevel, string> = {
  LOW: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  MEDIUM: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  HIGH: "border-risk-high/30 bg-risk-high/10 text-risk-high",
  CRITICAL: "border-risk-critical/30 bg-risk-critical/10 text-risk-critical",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
        riskStyles[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {level}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs tracking-tight", className)}>{children}</span>;
}

export function useCountUp(target: number, active: boolean, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
}