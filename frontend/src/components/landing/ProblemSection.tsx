import { Reveal, SectionHeading } from "./shared";

const journey = [
  "Alert",
  "Evidence",
  "Analysis",
  "Compliance",
  "Investigation",
  "Decision",
];

export function ProblemSection() {
  return (
    <section id="platform" className="bg-muted py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="The gap"
            title="Detection is only the beginning."
            description="Modern financial-crime systems can generate alerts. The difficult part begins after the alert — collecting evidence, understanding relationships, checking regulatory context, explaining risk and documenting the investigation."
          />
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {journey.map((step, i) => (
              <li key={step}>
                <div className="group flex h-full flex-col gap-2 rounded-3xl border border-border bg-card p-5 transition-colors duration-300 hover:border-violet/40 hover:bg-violet/10">
                  <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="text-sm font-semibold tracking-wide uppercase">
                    {step}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={200}>
          <p className="mt-12 text-center text-xl font-medium tracking-tight text-gov md:text-2xl">
            SafeFlow connects the investigation.
          </p>
        </Reveal>
      </div>
    </section>
  );
}