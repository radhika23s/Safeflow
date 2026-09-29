import { demoCase } from "@/data/mock-investigation";
import { Mono, Reveal, RiskBadge, SectionHeading, useCountUp, useInView } from "./shared";

export function RiskIntelligence() {
  const { ref, visible } = useInView<HTMLDivElement>(0.25);
  const score = useCountUp(demoCase.risk.value, visible);
  const maxFactor = Math.max(...demoCase.risk.factors.map((f) => f.contribution));

  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="Risk intelligence"
            title="Risk you can see."
            description="Each score decomposes into the signals that produced it, so analysts can challenge the model rather than trust it blindly."
          />
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <div
            ref={ref}
            className="mx-auto grid max-w-5xl gap-8 rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:grid-cols-[300px_1fr] md:p-10"
          >
            <div className="flex flex-col justify-center gap-4 rounded-3xl bg-offwhite p-6">
              <Mono className="text-muted-foreground">RISK SCORE</Mono>
              <div className="flex items-end gap-2">
                <span className="text-6xl font-semibold tracking-tight tabular-nums">{score}</span>
                <span className="pb-2 text-lg text-muted-foreground">/ 100</span>
              </div>
              <RiskBadge level={demoCase.risk.level} className="self-start" />
              <Mono className="text-muted-foreground">CASE {demoCase.id}</Mono>
            </div>

            <div>
              <Mono className="text-muted-foreground">FEATURE CONTRIBUTION</Mono>
              <ul className="mt-5 grid gap-4">
                {demoCase.risk.factors.map((factor, i) => (
                  <li key={factor.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{factor.label}</span>
                      <Mono className="text-gov">+{String(factor.contribution).padStart(2, "0")}</Mono>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-violet transition-[width] duration-[900ms] ease-out"
                        style={{
                          width: visible ? `${(factor.contribution / maxFactor) * 100}%` : "0%",
                          transitionDelay: `${i * 90}ms`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-base text-muted-foreground">
            Every risk score comes with an explanation.
          </p>
        </Reveal>
      </div>
    </section>
  );
}