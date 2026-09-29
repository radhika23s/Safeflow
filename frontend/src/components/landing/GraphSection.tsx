import { Mono, Reveal, SectionHeading } from "./shared";
import { TransactionGraph } from "./TransactionGraph";

const insights = [
  {
    title: "FAN-OUT DETECTED",
    description: "Funds move from one account to multiple connected accounts.",
  },
  {
    title: "CONNECTED ENTITY",
    description: "Multiple suspicious accounts share transaction relationships.",
  },
  {
    title: "RAPID TURNOVER",
    description: "Funds move through connected accounts within a short time window.",
  },
];

export function GraphSection() {
  return (
    <section id="graph" className="bg-offwhite py-20 md:py-28">
      <div className="container-hz">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow="FOLLOW THE MONEY"
                title="Follow the money."
                description="Transaction relationships reveal patterns that isolated transactions cannot."
                align="left"
              />

              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                Safe Flow traces the flow of funds across linked accounts, shared devices and time-based
                movement patterns — exposing suspicious behaviour before it becomes a larger financial risk.
              </p>

              <div className="mt-2 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
                {insights.map((insight) => (
                  <div
                    key={insight.title}
                    className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                  >
                    <Mono className="text-muted-foreground">{insight.title}</Mono>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative mx-auto w-full max-w-2xl">
              <span className="eyebrow pointer-events-none absolute -left-2 top-6 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-muted-foreground shadow-[var(--shadow-card)] md:-left-8">
                NETWORK SIGNAL
              </span>
              <span className="eyebrow pointer-events-none absolute -right-2 bottom-8 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-muted-foreground shadow-[var(--shadow-card)] md:-right-6">
                SUSPICIOUS RELATIONSHIP
              </span>

              <div className="overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-[var(--shadow-float)] md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Mono className="text-muted-foreground">TRANSACTION GRAPH</Mono>
                  <Mono className="text-muted-foreground">CASE FC-2026-00421</Mono>
                </div>
                <TransactionGraph className="mt-2" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
