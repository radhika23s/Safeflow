"""
regulatory.py — Statutory and Compliance Grounding Catalog
===========================================================
Defines the authoritative regulatory clause catalog for banking fraud,
anti-money laundering (AML), and suspicious transaction reporting in India.

Used by the reasoning agent (Gemini) and the regulatory fallback engine
for inline clause citation and traceability in STR drafts.
"""

import re
import json

REGULATORY_CLAUSES = {
    "PMLA_S12": {
        "code": "PMLA_S12",
        "act": "Prevention of Money Laundering Act, 2002",
        "title": "Section 12 — Statutory Obligation to Maintain Records & Report Suspicious Activity",
        "summary": "Mandates banking companies, financial institutions, and intermediaries to maintain records of all transactions and furnish reports of suspicious transactions (STR) to FIU-IND within statutory timelines.",
        "authority": "FIU-IND / Enforcement Directorate",
        "filing_window": "Within 7 working days of establishing suspicion",
    },
    "PMLA_S3": {
        "code": "PMLA_S3",
        "act": "Prevention of Money Laundering Act, 2002",
        "title": "Section 3 — Offence of Money Laundering & Structuring",
        "summary": "Defines money laundering as directly or indirectly attempting to indulge, knowingly assisting, or being involved in concealment, possession, acquisition, or use of proceeds of crime, including structuring transfers to evade detection.",
        "authority": "Enforcement Directorate",
        "filing_window": "Mandatory reporting upon establishing prima facie nexus",
    },
    "RBI_MD_KYC_2016_PARA_23": {
        "code": "RBI_MD_KYC_2016_PARA_23",
        "act": "RBI Master Direction — Know Your Customer (KYC) Directions, 2016",
        "title": "Para 23 — Enhanced Due Diligence (EDD) for High-Risk Accounts",
        "summary": "Mandates Enhanced Due Diligence for customers assessed as high-risk, including close scrutiny of transaction patterns, velocity monitoring, and verification of fund source consistency with stated economic activity.",
        "authority": "Reserve Bank of India",
        "filing_window": "Immediate EDD trigger upon alert generation",
    },
    "RBI_MD_KYC_2016_PARA_37": {
        "code": "RBI_MD_KYC_2016_PARA_37",
        "act": "RBI Master Direction — Know Your Customer (KYC) Directions, 2016",
        "title": "Para 37 — Reporting of Suspicious Transactions (STR) to FIU-IND",
        "summary": "Requires reporting entities to file Suspicious Transaction Reports (STRs) with the Director, FIU-IND within 7 working days of arriving at a conclusion of suspicion on cash, wire, or digital transfers.",
        "authority": "RBI / FIU-IND",
        "filing_window": "Strict 7-day statutory deadline",
    },
    "RBI_FRM_2024_CIRCULAR": {
        "code": "RBI_FRM_2024_CIRCULAR",
        "act": "RBI Master Direction — Fraud Risk Management in Commercial Banks (2024)",
        "title": "FRM Master Direction 2024 — Real-time Containment & Mule Ring Neutralization",
        "summary": "Directs Scheduled Commercial Banks to institute automated real-time nodal debit freezes, multi-branch counterparty scrutiny, and inter-bank liaison upon algorithmic identification of coordinated syndicate laundering.",
        "authority": "Reserve Bank of India",
        "filing_window": "Immediate containment; nodal debit-freeze within 15 minutes",
    },
    "NPCI_UPI_2023_PARA_5": {
        "code": "NPCI_UPI_2023_PARA_5",
        "act": "NPCI Unified Payments Interface (UPI) Procedural Guidelines (2023)",
        "title": "Para 5 — Algorithmic Velocity Limits & High-Frequency Dispersion Anomaly",
        "summary": "Prescribes automated behavioral velocity limits and real-time triggers on accounts receiving rapid aggregate credits followed by immediate multi-party outward dispersal via UPI VPAs.",
        "authority": "NPCI / Member Banks",
        "filing_window": "Real-time automated transaction hold / velocity breach alert",
    },
    "NPCI_OC_138_MULE": {
        "code": "NPCI_OC_138_MULE",
        "act": "NPCI Operating Circular 138",
        "title": "Operating Circular 138 — Digital Payment Mule Account Mitigation Directives",
        "summary": "Mandates real-time beneficiary holds and synchronized lien placement on identified digital mule handles, with automated alert dissemination via the National Cyber Crime Reporting Portal (NCRP).",
        "authority": "NPCI / I4C (MHA)",
        "filing_window": "Immediate beneficiary hold & NCRP integration",
    },
}

CLAUSE_REGEX = re.compile(r"\[(PMLA_S12|PMLA_S3|RBI_MD_KYC_2016_PARA_23|RBI_MD_KYC_2016_PARA_37|RBI_FRM_2024_CIRCULAR|NPCI_UPI_2023_PARA_5|NPCI_OC_138_MULE)\]")


def get_regulatory_clauses() -> dict:
    """Return full dictionary of regulatory grounding clauses."""
    return REGULATORY_CLAUSES


def extract_cited_clauses(text: str) -> list[str]:
    """Find all unique clause tags cited in a text (e.g. [PMLA_S12])."""
    if not text:
        return []
    matches = CLAUSE_REGEX.findall(text)
    # preserve order while making unique
    seen = set()
    result = []
    for m in matches:
        if m not in seen and m in REGULATORY_CLAUSES:
            seen.add(m)
            result.append(m)
    return result


def format_clauses_for_prompt() -> str:
    """Format regulatory clauses as structured JSON string for Gemini context."""
    summary_map = {
        code: f"{data['act']} — {data['title']}: {data['summary']}"
        for code, data in REGULATORY_CLAUSES.items()
    }
    return json.dumps(summary_map, indent=2)
