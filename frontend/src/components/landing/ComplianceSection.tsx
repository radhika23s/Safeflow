import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { regulatorySources } from "@/data/mock-investigation";
import { Mono, Reveal, SectionHeading } from "./shared";

const regulatoryTypes = ["Banking Regulation", "Payments Guidance", "AML / KYC", "International Standards", "Reporting Rules", "Data Protection"];

export function ComplianceSection() {
  return (
    <section id="compliance" className="bg-background py-20 md:py-28">
      <div className="container-hz">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal><div className="flex flex-col gap-6"><SectionHeading eyebrow="REGULATORY INTELLIGENCE" title="Grounded in regulatory intelligence." description="Regulatory findings are retrieved from verified sources before being presented to the investigator." align="left" />
            <div className="rounded-[28px] border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3"><Mono className="text-muted-foreground">REGULATORY FINDING</Mono><span className="rounded-full border border-border bg-muted px-2 py-1 text-[0.62rem] font-medium text-violet">Applicable context identified</span></div>
              <div className="mt-6 rounded-2xl border border-violet/30 bg-violet/5 p-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-violet/10 text-violet"><CheckCircle2 className="size-4" /></span><div><Mono className="text-violet">KYC / AML</Mono><p className="mt-1 text-lg font-semibold tracking-tight text-foreground">Enhanced due diligence context is supported by relevant guidance.</p></div></div></div>
              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4"><div><Mono className="text-muted-foreground">SOURCE</Mono><p className="mt-2 text-xl font-semibold tracking-tight text-foreground">RBI</p></div><div className="text-right"><p className="text-sm text-muted-foreground">Citation available</p><button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-violet hover:text-foreground">View source<ArrowUpRight className="size-3.5" /></button></div></div>
            </div>
          </div></Reveal>
          <Reveal delay={120}><div className="grid gap-4">{regulatorySources.map((source, index) => <div key={source.code} className="rounded-[24px] border border-border bg-card p-4 transition-colors hover:border-violet/40"><div className="flex items-center justify-between gap-3"><div><Mono className="text-muted-foreground">{source.code}</Mono><h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{source.name}</h3></div><span className="rounded-full border border-border bg-muted px-2 py-1 text-[0.62rem] font-medium text-violet">{regulatoryTypes[index]}</span></div><div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3"><span className="text-sm text-muted-foreground">Citation available</span><span className="text-sm font-medium text-violet">Source</span></div></div>)}</div></Reveal>
        </div>
      </div>
    </section>
  );
}
