import { investigationSteps } from "@/data/mock-investigation";
import { Mono, Reveal, SectionHeading } from "./shared";

export function InvestigationFlow() {
  return (
    <section id="workflow" className="bg-muted py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="INVESTIGATION WORKFLOW"
            title="From alert to investigation-ready case."
            description="Each step in the investigation is tracked, grounded and ready for human review."
          />
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-border lg:block" aria-hidden />
            <ol className="grid gap-4 lg:grid-cols-8">
              {investigationSteps.map((step, index) => (
                <li key={step.step} className="relative">
                  <div className="relative flex h-full flex-col gap-3 rounded-[24px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between">
                      <Mono className="text-muted-foreground">{step.step}</Mono>
                      {index < investigationSteps.length - 1 ? (
                        <span className="hidden h-px w-8 bg-border lg:block" aria-hidden />
                      ) : null}
                    </div>

                    <div className="mt-2">
                      <h3 className="text-base font-semibold tracking-tight text-foreground">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
