import { Link } from "@tanstack/react-router";
import { ArrowRight, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, SectionHeading } from "./shared";

export function FinalCTA() {
  return (
    <section id="launch" className="relative overflow-hidden bg-section-emphasis py-20 md:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--violet) 22%, transparent), transparent 34%), radial-gradient(circle at 80% 30%, color-mix(in oklab, var(--teal) 18%, transparent), transparent 36%), linear-gradient(135deg, color-mix(in oklab, var(--section-emphasis-foreground) 2%, transparent), transparent)",
        }}
      />

      <div className="container-hz relative">
        <Reveal>
          <div className="mx-auto max-w-3xl rounded-[30px] border border-section-emphasis-border bg-section-emphasis-surface px-6 py-10 text-center shadow-[var(--shadow-float)] md:px-10 md:py-14">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-section-emphasis-border bg-section-emphasis-surface text-section-emphasis-accent">
              <Network className="size-5" aria-hidden />
            </div>

            <SectionHeading
              tone="dark"
              eyebrow="LAUNCH"
              title="Turn alerts into investigations."
              description="Give investigators the evidence, intelligence and explanations they need to make informed decisions."
            />

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-xl bg-background text-foreground hover:bg-muted">
                <Link to="/sign-in">
                  Launch Investigator
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-section-emphasis-border bg-transparent text-section-emphasis-foreground hover:bg-section-emphasis-surface"
              >
                <a href="#intelligence">View Architecture</a>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
