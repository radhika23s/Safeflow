import { Mono } from "./shared";

const audiences = [
  "Financial Crime Analysts",
  "Compliance Teams",
  "Risk Operations",
  "Investigation Workflows",
];

export function TrustBar() {
  return (
    <section aria-label="Built for" className="bg-muted">
      <div className="container-hz">
        <div className="flex flex-col items-center gap-5 py-10 md:flex-row md:justify-center md:gap-10">
          <Mono className="eyebrow text-muted-foreground">Built for</Mono>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {audiences.map((item) => (
              <li key={item} className="text-sm font-medium text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="h-px w-full bg-border" />
      </div>
    </section>
  );
}