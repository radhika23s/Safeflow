import { ArrowDown, ShieldCheck } from "lucide-react";
import { Mono, Reveal, SectionHeading } from "./shared";

const decisionFlow = [
  "AI DETECTS",
  "RISK + EVIDENCE",
  "AI RECOMMENDATION",
  "HUMAN ANALYST",
  "ALLOW / VERIFY / ESCALATE",
];

const statusCards = [
  { label: "MANUAL OVERRIDE", value: "AVAILABLE" },
  { label: "KILL SWITCH", value: "ENABLED" },
  { label: "AUDIT TRAIL", value: "ACTIVE" },
];

export function HumanDecisionSection() {
  return (
    <section id="human-decision" className="bg-navy py-20 md:py-28">
      <div className="container-hz">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className="flex flex-col gap-6">
              <SectionHeading
                tone="dark"
                eyebrow="HUMAN-IN-THE-LOOP"
                title="AI investigates. Humans decide."
                description="Safe Flow supports authorized investigators with evidence and recommendations. Final decisions remain under human control."
                align="left"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                {statusCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Mono className="text-lavender/80">{card.label}</Mono>
                    <p className="mt-2 text-sm font-semibold tracking-[0.08em] text-white uppercase">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[var(--shadow-float)] md:p-8">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
                {decisionFlow.map((step, index) => (
                  <div key={step} className="w-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center shadow-[var(--shadow-card)] w-full">
                        <Mono className="text-lavender/80">{index + 1}</Mono>
                        <p className="mt-2 text-sm font-semibold tracking-[0.12em] text-white uppercase">{step}</p>
                      </div>

                      {index < decisionFlow.length - 1 ? (
                        <ArrowDown className="size-4 text-teal" aria-hidden />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-teal/30 bg-gradient-to-r from-white/5 to-teal/5 p-4 text-center">
                <ShieldCheck className="size-5 text-teal" aria-hidden />
                <p className="text-sm text-lavender/80">
                  Human approval remains the final decision point in each investigation.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
