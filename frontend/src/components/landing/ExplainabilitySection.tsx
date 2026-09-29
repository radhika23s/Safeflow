import { Check, Minus } from "lucide-react";
import { demoCase } from "@/data/mock-investigation";
import { Mono, Reveal, SectionHeading } from "./shared";

const labels = ["SHAP", "EVIDENCE", "COUNTER-EVIDENCE", "CONFIDENCE"];

export function ExplainabilitySection() {
  const supporting = demoCase.evidence.filter((e) => e.kind === "supporting");
  const counter = demoCase.evidence.filter((e) => e.kind === "counter");

  return (
    <section className="bg-muted py-20 md:py-28">
      <div className="container-hz grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Explainable AI"
            title="Don't just flag it. Explain it."
            description="Findings are assembled from named signals, supporting evidence and the evidence that argues against escalation — so an analyst can audit the reasoning end to end."
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                key={label}
                className="eyebrow rounded-lg border border-border bg-card px-3 py-1.5 text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
            <div className="flex items-center justify-between">
              <Mono className="text-muted-foreground">WHY FLAGGED</Mono>
              <Mono className="text-muted-foreground">{demoCase.id}</Mono>
            </div>

            <div className="mt-6 grid gap-5">
              <div>
                <h3 className="text-sm font-semibold">Supporting Evidence</h3>
                <ul className="mt-2 grid gap-2">
                  {supporting.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-offwhite px-3 py-2.5 text-sm"
                    >
                      <Check className="size-4 text-risk-high" aria-hidden />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Counter Evidence</h3>
                <ul className="mt-2 grid gap-2">
                  {counter.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-offwhite px-3 py-2.5 text-sm"
                    >
                      <Minus className="size-4 text-risk-low" aria-hidden />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <Mono className="text-muted-foreground">MODEL SIGNAL</Mono>
                  <p className="mt-1 text-sm font-medium">High transaction velocity</p>
                </div>
                <div className="rounded-xl border border-violet/25 bg-lavender/50 p-3">
                  <Mono className="text-gov">AI ASSESSMENT</Mono>
                  <p className="mt-1 text-sm font-medium text-gov">
                    High-risk activity pattern requiring analyst review.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}