import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { demoCase, demoReport } from "@/data/mock-investigation";
import { Mono, Reveal, SectionHeading } from "./shared";

export function ReportSection() {
  return (
    <section id="reports" className="bg-section-emphasis py-20 md:py-28">
      <div className="container-hz">
        <Reveal><SectionHeading tone="dark" eyebrow="INVESTIGATION REPORTING" title="From evidence to an investigation-ready report." description="Every finding is assembled into a case record that is structured, explainable and ready for analyst review." /></Reveal>
        <Reveal delay={120} className="mt-12"><div className="grid items-start gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[28px] border border-section-emphasis-border bg-section-emphasis-surface p-6 shadow-[var(--shadow-card)]">
            <Mono className="text-section-emphasis-muted">CASE FILE</Mono>
            <div className="mt-6 space-y-4"><div className="rounded-2xl border border-section-emphasis-border bg-section-emphasis-surface p-4"><Mono className="text-section-emphasis-muted">CASE</Mono><p className="mt-2 text-xl font-semibold tracking-tight text-section-emphasis-foreground">{demoCase.id}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><div className="rounded-2xl border border-section-emphasis-border bg-section-emphasis-surface p-4"><Mono className="text-section-emphasis-muted">RISK</Mono><p className="mt-2 text-lg font-semibold tracking-tight text-risk-high">{demoCase.risk.level} · {demoCase.risk.value}/100</p></div><div className="rounded-2xl border border-section-emphasis-border bg-section-emphasis-surface p-4"><Mono className="text-section-emphasis-muted">RECOMMENDATION</Mono><p className="mt-2 text-lg font-semibold tracking-tight text-section-emphasis-foreground">{demoCase.recommendation}</p></div></div></div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row"><Button asChild size="lg" className="rounded-xl bg-background text-foreground hover:bg-muted"><Link to="/sign-in">Open Investigator Workspace</Link></Button><Button asChild variant="outline" size="lg" className="rounded-xl border-section-emphasis-border bg-transparent text-section-emphasis-foreground hover:bg-section-emphasis-surface"><Link to="/sign-in">Review STR Flow</Link></Button></div>
          </div>
          <div className="rounded-[30px] border border-section-emphasis-border bg-section-emphasis-surface p-4 shadow-[var(--shadow-float)] md:p-6"><div className="flex items-center justify-between border-b border-section-emphasis-border pb-4"><div><Mono className="text-section-emphasis-muted">INVESTIGATION REPORT</Mono><p className="mt-2 text-lg font-semibold text-section-emphasis-foreground">Case {demoReport.caseId}</p></div><div className="text-right"><Mono className="text-section-emphasis-muted">RISK</Mono><p className="mt-2 text-sm font-medium text-risk-high">{demoReport.risk}</p></div></div><div className="mt-5 space-y-4">{demoReport.sections.map((section) => <div key={section.title} className="rounded-2xl border border-section-emphasis-border bg-section-emphasis-surface p-4"><h3 className="text-base font-semibold text-section-emphasis-foreground">{section.title}</h3><p className="mt-2 text-sm leading-relaxed text-section-emphasis-muted">{section.summary}</p></div>)}</div></div>
        </div></Reveal>
      </div>
    </section>
  );
}
