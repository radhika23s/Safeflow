import { Database, FileSearch, Gavel, ShieldCheck, UserCog, Waves } from "lucide-react";
import { Reveal, SectionHeading } from "./shared";

const capabilities = [
  {
    num: "01",
    title: "Data Intelligence",
    icon: Database,
    items: ["Transaction history", "Customer profile", "Device / IP", "Geo signals"],
  },
  {
    num: "02",
    title: "Risk Intelligence",
    icon: Waves,
    items: ["Risk scoring", "Anomaly detection", "Velocity analysis", "Graph patterns"],
  },
  {
    num: "03",
    title: "Compliance Intelligence",
    icon: Gavel,
    items: ["KYC / CDD / EDD", "PEP & sanctions", "RBI / NPCI", "PMLA / FATF"],
  },
  {
    num: "04",
    title: "Insider-Risk Intelligence",
    icon: UserCog,
    items: [
      "Employee access rights",
      "Undeclared account links",
      "Insider-assisted structuring",
      "Profile mismatch detection",
    ],
  },
  {
    num: "05",
    title: "Investigation Intelligence",
    icon: FileSearch,
    items: ["AI findings", "Evidence linking", "Case reasoning", "Recommended actions"],
  },
];

export function InvestigatorSection() {
  return (
    <section id="investigation" className="bg-background py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="Digital Investigator"
            title="One investigation. Every signal."
            description="A single case surface that unifies data, risk, regulation and reasoning around each suspicious alert."
          />
        </Reveal>

        <div className="mt-16 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-6">
            {[capabilities[0], capabilities[4]]
              .filter((c): c is (typeof capabilities)[number] => Boolean(c))
              .map((cap, i) => (
              <Reveal key={cap.num} delay={i * 100}>
                <CapabilityCard {...cap} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={80} className="order-first lg:order-none">
            <div className="relative mx-auto flex size-56 items-center justify-center md:size-72">
              <span
                className="absolute inset-0 rounded-full border border-border"
                aria-hidden
              />
              <span
                className="absolute inset-6 rounded-full border border-violet/25 hz-pulse"
                aria-hidden
              />
              <div
                className="relative flex size-32 flex-col items-center justify-center gap-1 rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-sm md:size-40 dark:border-white/10 dark:bg-slate-900"
              >
                <ShieldCheck className="size-8 text-teal" aria-hidden />
                <span className="eyebrow text-center text-primary-foreground/80 dark:text-white/80">
                  Digital
                  <br />
                  Investigator
                </span>
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col gap-6">
            {capabilities.slice(1, 4).map((cap, i) => (
              <Reveal key={cap.num} delay={i * 100}>
                <CapabilityCard {...cap} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityCard({
  num,
  title,
  items,
  icon: Icon,
}: {
  num: string;
  title: string;
  items: string[];
  icon: typeof Database;
}) {
  return (
    <article className="h-full rounded-[26px] border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors duration-300 hover:border-violet/40">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-lavender text-gov">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground">{num}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="size-1 rounded-full bg-violet/60" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}