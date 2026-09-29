import React from "react";
import { ShieldCheck, Scale, Clock, ExternalLink } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { RegulatoryClause } from "@/lib/api";

export const DEFAULT_REGULATORY_CLAUSES: Record<string, RegulatoryClause> = {
  PMLA_S12: {
    code: "PMLA_S12",
    act: "Prevention of Money Laundering Act, 2002",
    title: "Section 12 — Statutory Obligation to Maintain Records & Report Suspicious Activity",
    summary:
      "Mandates banking companies, financial institutions, and intermediaries to maintain records of all transactions and furnish reports of suspicious transactions (STR) to FIU-IND within statutory timelines.",
    authority: "FIU-IND / Enforcement Directorate",
    filing_window: "Within 7 working days of establishing suspicion",
  },
  PMLA_S3: {
    code: "PMLA_S3",
    act: "Prevention of Money Laundering Act, 2002",
    title: "Section 3 — Offence of Money Laundering & Structuring",
    summary:
      "Defines money laundering as directly or indirectly attempting to indulge, knowingly assisting, or being involved in concealment, possession, acquisition, or use of proceeds of crime, including structuring transfers to evade detection.",
    authority: "Enforcement Directorate",
    filing_window: "Mandatory reporting upon establishing prima facie nexus",
  },
  RBI_MD_KYC_2016_PARA_23: {
    code: "RBI_MD_KYC_2016_PARA_23",
    act: "RBI Master Direction — Know Your Customer (KYC) Directions, 2016",
    title: "Para 23 — Enhanced Due Diligence (EDD) for High-Risk Accounts",
    summary:
      "Mandates Enhanced Due Diligence for customers assessed as high-risk, including close scrutiny of transaction patterns, velocity monitoring, and verification of fund source consistency with stated economic activity.",
    authority: "Reserve Bank of India",
    filing_window: "Immediate EDD trigger upon alert generation",
  },
  RBI_MD_KYC_2016_PARA_37: {
    code: "RBI_MD_KYC_2016_PARA_37",
    act: "RBI Master Direction — Know Your Customer (KYC) Directions, 2016",
    title: "Para 37 — Reporting of Suspicious Transactions (STR) to FIU-IND",
    summary:
      "Requires reporting entities to file Suspicious Transaction Reports (STRs) with the Director, FIU-IND within 7 working days of arriving at a conclusion of suspicion on cash, wire, or digital transfers.",
    authority: "RBI / FIU-IND",
    filing_window: "Strict 7-day statutory deadline",
  },
  RBI_FRM_2024_CIRCULAR: {
    code: "RBI_FRM_2024_CIRCULAR",
    act: "RBI Master Direction — Fraud Risk Management in Commercial Banks (2024)",
    title: "FRM Master Direction 2024 — Real-time Containment & Mule Ring Neutralization",
    summary:
      "Directs Scheduled Commercial Banks to institute automated real-time nodal debit freezes, multi-branch counterparty scrutiny, and inter-bank liaison upon algorithmic identification of coordinated syndicate laundering.",
    authority: "Reserve Bank of India",
    filing_window: "Immediate containment; nodal debit-freeze within 15 minutes",
  },
  NPCI_UPI_2023_PARA_5: {
    code: "NPCI_UPI_2023_PARA_5",
    act: "NPCI Unified Payments Interface (UPI) Procedural Guidelines (2023)",
    title: "Para 5 — Algorithmic Velocity Limits & High-Frequency Dispersion Anomaly",
    summary:
      "Prescribes automated behavioral velocity limits and real-time triggers on accounts receiving rapid aggregate credits followed by immediate multi-party outward dispersal via UPI VPAs.",
    authority: "NPCI / Member Banks",
    filing_window: "Real-time automated transaction hold / velocity breach alert",
  },
  NPCI_OC_138_MULE: {
    code: "NPCI_OC_138_MULE",
    act: "NPCI Operating Circular 138",
    title: "Operating Circular 138 — Digital Payment Mule Account Mitigation Directives",
    summary:
      "Mandates real-time beneficiary holds and synchronized lien placement on identified digital mule handles, with automated alert dissemination via the National Cyber Crime Reporting Portal (NCRP).",
    authority: "NPCI / I4C (MHA)",
    filing_window: "Immediate beneficiary hold & NCRP integration",
  },
};

const CLAUSE_TAG_REGEX = /\[(PMLA_S12|PMLA_S3|RBI_MD_KYC_2016_PARA_23|RBI_MD_KYC_2016_PARA_37|RBI_FRM_2024_CIRCULAR|NPCI_UPI_2023_PARA_5|NPCI_OC_138_MULE)\]/g;

export function ClauseBadge({
  code,
  clauses,
}: {
  code: string;
  clauses?: Record<string, RegulatoryClause> | null | undefined;
}) {
  const clause = clauses?.[code] || DEFAULT_REGULATORY_CLAUSES[code] || {
    code,
    act: "Statutory Banking Regulation",
    title: code,
    summary: "Mandatory compliance clause referenced in investigation audit trail.",
  };

  return (
    <HoverCard openDelay={150} closeDelay={150}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tracking-tight text-violet bg-violet/10 border border-violet/30 hover:bg-violet/20 hover:border-violet/50 transition-colors cursor-pointer select-none align-baseline shadow-2xs"
          role="button"
          tabIndex={0}
        >
          <Scale className="size-3 text-violet" />
          [{code}]
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-80 sm:w-96 rounded-xl border border-violet/30 bg-card/95 p-4 shadow-xl backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-1.5 text-violet">
            <ShieldCheck className="size-4 shrink-0 text-teal" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {clause.act}
            </span>
          </div>
          <span className="rounded bg-violet/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-violet">
            Statutory Clause
          </span>
        </div>

        <h4 className="mt-2 text-xs font-bold text-foreground leading-snug">
          {clause.title}
        </h4>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {clause.summary}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[10px] font-mono text-muted-foreground">
          {clause.authority && (
            <span>Authority: <strong className="text-foreground">{clause.authority}</strong></span>
          )}
          {clause.filing_window && (
            <span className="flex items-center gap-1 text-teal font-semibold">
              <Clock className="size-3" />
              {clause.filing_window}
            </span>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function TraceableText({
  text,
  clauses,
  className,
}: {
  text: string;
  clauses?: Record<string, RegulatoryClause> | null | undefined;
  className?: string | undefined;
}) {
  if (!text) return null;

  // Split text by clause citation tags while preserving delimiters
  const parts = text.split(/(\[(?:PMLA_S12|PMLA_S3|RBI_MD_KYC_2016_PARA_23|RBI_MD_KYC_2016_PARA_37|RBI_FRM_2024_CIRCULAR|NPCI_UPI_2023_PARA_5|NPCI_OC_138_MULE)\])/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        const match = part.match(/^\[(.*)\]$/);
        if (match && match[1] && (DEFAULT_REGULATORY_CLAUSES[match[1]] || clauses?.[match[1]])) {
          return <ClauseBadge key={idx} code={match[1]} clauses={clauses} />;
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}

export function CitedClausesList({
  citedCodes,
  clauses,
}: {
  citedCodes: string[];
  clauses?: Record<string, RegulatoryClause> | null | undefined;
}) {
  const catalog = clauses || DEFAULT_REGULATORY_CLAUSES;
  const uniqueCodes = Array.from(new Set(citedCodes)).filter(
    (code) => catalog[code] || DEFAULT_REGULATORY_CLAUSES[code]
  );

  if (uniqueCodes.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No specific regulatory clauses cited yet. Run AI investigation to cross-reference PMLA and RBI statutes.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {uniqueCodes.map((code) => {
        const item = catalog[code] || DEFAULT_REGULATORY_CLAUSES[code];
        if (!item) return null;
        return (
          <li key={code} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-violet">
                [{item.code}]
              </span>
              {item.filing_window && (
                <span className="flex items-center gap-1 rounded bg-teal/10 px-2 py-0.5 text-[9px] font-mono font-semibold text-teal">
                  <Clock className="size-2.5" />
                  {item.filing_window}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground">{item.title}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{item.summary}</p>
          </li>
        );
      })}
    </ul>
  );
}
