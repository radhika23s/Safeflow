import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, Mono, Reveal } from "./shared";

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-background py-16 md:py-20">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="absolute right-[-12%] top-[-8%] h-[440px] w-[440px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute left-[-18%] bottom-[-25%] h-[340px] w-[340px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container-hz relative">
        <div className="grid items-center gap-8 lg:grid-cols-[0.88fr_1.12fr] xl:gap-4">
          <div className="relative z-10 max-w-2xl lg:pr-6">
            <Reveal><Eyebrow>Safe Flow</Eyebrow></Reveal>
            <Reveal delay={80}>
              <h1 className="mt-4 text-left text-4xl leading-[1.04] font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl">
                Detect. Investigate. Explain. Decide.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-xl text-left text-sm leading-relaxed text-muted-foreground md:text-base">
                Safe Flow helps financial institutions convert suspicious activity into a disciplined,
                auditable investigation workflow with clear risk assessment and regulatory context.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-md">
                  <Link to="/sign-in">Launch Investigator <ArrowRight className="size-4" aria-hidden /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-md border-border bg-background">
                  <a href="#platform">Explore the Platform</a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-6 grid max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-3">
                {["RISK REVIEW", "REGULATORY CONTEXT", "AUDIT TRAIL"].map((item) => (
                  <div key={item} className="border-l border-primary pl-3"><Mono className="text-muted-foreground">{item}</Mono></div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={180}>
            <div className="relative mx-auto flex min-h-[340px] w-full max-w-[620px] items-center justify-center overflow-hidden">
              <img
                src="/pay-safe-stay-secure.png"
                alt="Pay Safe Stay Secure"
                className="max-h-[500px] w-auto max-w-none object-contain"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
