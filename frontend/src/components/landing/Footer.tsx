import { Mono } from "./shared";

const platformLinks = [
  { label: "Investigator", href: "#investigation" },
  { label: "Risk Intelligence", href: "#intelligence" },
  { label: "Graph Analysis", href: "#platform" },
  { label: "Compliance", href: "#compliance" },
  { label: "Reports", href: "#reports" },
];
const resourcesLinks = [
  { label: "Documentation", href: "#faq" },
  { label: "Architecture", href: "#intelligence" },
  { label: "Research", href: "#compliance" },
  { label: "FAQ", href: "#faq" },
];
const companyLinks = [
  { label: "About", href: "#human-decision" },
  { label: "Contact", href: "#launch" },
];
const legalLinks = [
  { label: "Privacy", href: "#faq" },
  { label: "Security", href: "#launch" },
  { label: "Terms", href: "#launch" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="container-hz py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div><img src="/main_logo.png" alt="Safe Flow" className="h-10 w-auto object-contain" /><p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Digital Investigator for Financial Crime Intelligence</p></div>
          {[["PLATFORM", platformLinks], ["RESOURCES", resourcesLinks], ["COMPANY", companyLinks], ["LEGAL", legalLinks]].map(([heading, links]) => <div key={heading as string}><Mono className="text-muted-foreground">{heading as string}</Mono><ul className="mt-4 space-y-2 text-sm text-foreground/80">{(links as { label: string; href: string }[]).map((item) => <li key={item.label}><a href={item.href} className="transition-colors hover:text-foreground">{item.label}</a></li>)}</ul></div>)}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">© 2026 Safe Flow</div>
      </div>
    </footer>
  );
}
