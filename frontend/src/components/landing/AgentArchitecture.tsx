import { agents } from "@/data/mock-investigation";
import { Reveal, SectionHeading } from "./shared";

const serviceLabels = [
  "Transaction Analysis",
  "Risk Assessment",
  "Compliance Analysis",
  "Report Generation",
];

export function AgentArchitecture() {
  const services = agents.filter((agent) => ["orchestrator", "data", "risk", "reason"].includes(agent.id));

  return (
    <section id="intelligence" className="bg-muted py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="Investigation services"
            title="Operating support behind the investigator."
            description="The workflow is structured around case review, evidence analysis and risk evaluation, with specialist services supporting the analyst rather than replacing them."
          />
        </Reveal>

        <div className="mx-auto mt-12 max-w-5xl">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="grid gap-3 md:grid-cols-4">
              {services.map((service, index) => (
                <Reveal key={service.id} delay={index * 80} className="h-full">
                  <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-7 items-center justify-center rounded-md bg-violet/8 font-mono text-[11px] font-bold text-violet">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                        Live
                      </span>
                    </div>
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">
                        {serviceLabels[index] ?? service.name}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">{service.role}</p>
                    </div>
                    <div className="mt-5 space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Status</span>
                        <span className="font-mono text-foreground">Ready</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Last activity</span>
                        <span className="font-mono text-foreground">02:14</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Findings</span>
                        <span className="font-mono text-foreground">{index + 2}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}