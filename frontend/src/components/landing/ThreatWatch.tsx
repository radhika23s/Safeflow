import { ArrowUpRight } from "lucide-react";
import { threatItems } from "@/data/mock-investigation";
import { Mono, Reveal, SectionHeading } from "./shared";

export function ThreatWatch() {
  return (
    <section id="threat-watch" className="bg-offwhite py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="THREAT WATCH"
            title="Financial crime intelligence."
            description="A concise view of the patterns, regulatory signals and intelligence themes shaping active investigations."
          />
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <div className="grid gap-5 lg:grid-cols-3">
            {threatItems.map((item) => (
              <article
                key={item.id}
                className="flex h-full flex-col rounded-[28px] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors duration-300 hover:border-violet/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <Mono className="text-muted-foreground">{item.category}</Mono>
                  <span className="rounded-full border border-border bg-offwhite px-2 py-1 text-[0.62rem] text-gov">
                    {item.date}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{item.headline}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>

                <button
                  type="button"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gov transition-colors hover:text-violet"
                >
                  Read more
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </button>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
