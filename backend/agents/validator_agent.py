"""
validator_agent.py — Agent 5: Investigation Validator
======================================================
Fact-checks the outputs of reasonAgent and decisionAgent before a case
reaches a human analyst.  Three checks are performed:

  1. citation_exists    — each regulatory citation extracted from the
                          reason report must have a row in the regulations
                          table (matched on act + section).
  2. citation_relevant  — for every found citation, the citation's
                          summary_text must share enough keywords with the
                          surrounding claim context in the report.
  3. decision_consistent— the recommended action must be internally
                          coherent with the risk score (no "Dismiss" on a
                          high-risk case, no "Block" on a clearly low-risk one).

Returns:
    {
        "validated":           bool,
        "failed_checks":       list[str],
        "forced_review_level": "manager" | None,
    }

Constraints:
  - Does NOT modify or call reasonAgent, contextAgent, or scoreAgent internals.
  - All tunable constants are named at the top of this file.
  - Citation extraction uses regex over the free-text reasonAgent output
    (no structured citation objects are produced by the current reasonAgent).
"""

from __future__ import annotations

import re
import sqlite3
from typing import Any


# ─── Tunable constants ──────────────────────────────────────────────────────────
# Minimum fraction of significant claim-context words that must also appear in
# a citation's summary_text for the citation to be considered relevant.
# Formula: |intersection(claim_words, summary_words)| / |claim_words|
# Raise to make the relevance check stricter; lower to relax it.
CITATION_RELEVANCE_THRESHOLD: float = 0.15

# Default thresholds calibrated against PaySim validation distribution:
# LOW: 0-20, MEDIUM: 20-50, HIGH: 50-80, CRITICAL: 80-100
DEFAULT_HIGH_RISK_SCORE_THRESHOLD: float = 50.0
DEFAULT_LOW_MEDIUM_SCORE_BOUNDARY: float = 20.0

def _load_thresholds_from_metadata() -> tuple[float, float]:
    """Dynamically load HIGH and LOW risk band boundaries from model_metadata.json."""
    import json
    import os
    try:
        meta_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                meta = json.load(f)
            bands = meta.get("risk_bands", {})
            high_min = float(bands.get("HIGH", [0.5, 0.8])[0]) * 100.0
            low_max = float(bands.get("LOW", [0.0, 0.2])[1]) * 100.0
            return high_min, low_max
    except Exception:
        pass
    return DEFAULT_HIGH_RISK_SCORE_THRESHOLD, DEFAULT_LOW_MEDIUM_SCORE_BOUNDARY

_dyn_high, _dyn_low = _load_thresholds_from_metadata()

# risk_score at or above this value is treated as "high risk".
HIGH_RISK_SCORE_THRESHOLD: float = _dyn_high

# risk_score strictly below this value is treated as "definitively low risk".
LOW_MEDIUM_SCORE_BOUNDARY: float = _dyn_low

# Characters on each side of a matched citation to use as claim context for
# the keyword-overlap check.
CLAIM_CONTEXT_WINDOW: int = 300


# ─── Stop words excluded from keyword overlap ──────────────────────────────────
_STOP_WORDS: frozenset[str] = frozenset({
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
    "for", "from", "has", "have", "had", "in", "is", "it", "its", "may",
    "must", "not", "of", "on", "or", "shall", "should", "that", "the",
    "their", "this", "those", "to", "was", "were", "which", "will", "with",
})


# ─── Citation extraction patterns ──────────────────────────────────────────────
# Each tuple: (compiled_regex, act_string, section_capture_group_index)
# section_capture_group_index = None means section is always "GENERAL".
#
# Patterns must cover every variant produced by the reasonAgent's prompt
# template AND its fallback report generator:
#
#   Prompt template variants:
#     "PMLA 2002 Section 12 (...)"
#     "RBI Master Direction - Fraud Risk Management in Commercial Banks 2024"
#     "NPCI UPI Circular No. 138 (...)"
#
#   Fallback report variants:
#     "PMLA 2002 (Sec 12): ..."
#     "RBI Master Direction (Fraud Risk Management 2024): ..."
#     "NPCI OC 138: ..."
#
_CITATION_PATTERNS: list[tuple] = [
    # PMLA YYYY Section N  /  PMLA YYYY (Sec N)  /  PMLA YYYY, Section N
    (
        re.compile(
            r"PMLA\s+\d{4}\s*[,\s]*\(?\s*(?:Section|Sec\.?)\s*([\w\(\)/]+)\)?",
            re.IGNORECASE,
        ),
        "PMLA",
        1,   # capture group index for the section number
    ),
    # RBI Master Direction (any trailing text)
    (
        re.compile(r"RBI\s+Master\s+Direction", re.IGNORECASE),
        "RBI_MASTER_DIRECTION_FRM_2024",
        None,  # section is always "GENERAL" for this regulation
    ),
    # NPCI UPI Circular No. N  /  NPCI OC N
    (
        re.compile(
            r"NPCI\s+(?:UPI\s+)?(?:Circular\s+No\.?\s*|OC\s*)(\d+)",
            re.IGNORECASE,
        ),
        "NPCI_OC",
        1,
    ),
]


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _extract_citations(text: str) -> list[dict[str, str]]:
    """Extract structured citations from a free-text investigation report.

    Returns a list of dicts with keys: act, section, claim_context.
    Each unique (act, section) pair is returned at most once; the context
    window of the first match is preserved.

    Bug #1 fix — sub-section normalization:
      The PMLA regex captures the full match including sub-section notation,
      e.g. ``12(1)(a)``.  We strip everything from the first ``(`` onward so
      the lookup always matches the base section (``12``) stored in the DB.
      Choose this approach (a) over approach (b) because it requires no schema
      change — the DB already stores base sections only.
    """
    seen: set[tuple[str, str]] = set()
    citations: list[dict[str, str]] = []

    for pattern, act, group_index in _CITATION_PATTERNS:
        for match in pattern.finditer(text):
            if group_index is not None:
                raw_section = match.group(group_index).strip("()").strip()
                # Normalize sub-section notation: "12(1)(a)" → "12".
                # The regulations table stores base sections only.
                if "(" in raw_section:
                    raw_section = raw_section[: raw_section.index("(")].strip()
                section = raw_section
            else:
                section = "GENERAL"

            key = (act, section)
            if key in seen:
                continue
            seen.add(key)

            start = max(0, match.start() - CLAIM_CONTEXT_WINDOW)
            end = min(len(text), match.end() + CLAIM_CONTEXT_WINDOW)
            claim_context = text[start:end]

            citations.append(
                {"act": act, "section": section, "claim_context": claim_context}
            )

    return citations


def _significant_words(text: str) -> set[str]:
    """Return lowercased tokens that are not stop-words and are longer than 2 chars."""
    tokens = re.findall(r"\b[a-zA-Z]\w+\b", text)
    return {t.lower() for t in tokens if t.lower() not in _STOP_WORDS and len(t) > 2}


def _keyword_overlap(claim_text: str, summary_text: str) -> float:
    """Fraction of significant claim words that also appear in summary_text.

    Formula: |intersection(claim_words, summary_words)| / |claim_words|
    Returns 0.0 if claim_words is empty.
    """
    claim_words = _significant_words(claim_text)
    summary_words = _significant_words(summary_text)
    if not claim_words:
        return 0.0
    return len(claim_words & summary_words) / len(claim_words)


# ─── Public API ───────────────────────────────────────────────────────────────

def validate_investigation(
    reason_output: str,
    decision_output: dict[str, Any],
    risk_score: float,
    regulations_db: sqlite3.Connection,
) -> dict[str, Any]:
    """Validate the outputs of reasonAgent and decisionAgent.

    Args:
        reason_output:   Free-text markdown string produced by reasonAgent
                         (the ``llm_report`` / ``investigation_report`` field).
        decision_output: Dict with at least ``{"action": str, "confidence": float}``.
                         ``action`` must be one of: ALLOW, MONITOR, FLAG, BLOCK.
        risk_score:      Float 0–100 from scoreAgent (``risk_score`` field).
        regulations_db:  Active ``sqlite3.Connection`` to the horizon DB with
                         ``row_factory = sqlite3.Row``.

    Returns:
        {
            "validated":           bool   — True only when all checks pass.
            "failed_checks":       list[str] — names of failed checks.
            "forced_review_level": "manager" | None.
        }
    """
    # ── Bug #5: input guards — coerce None to safe defaults ─────────────────────
    # Prevents AttributeError / TypeError if callers pass None (e.g. a failed
    # upstream agent that returned None instead of its normal output).
    if not isinstance(reason_output, str):
        reason_output = ""
    if not isinstance(decision_output, dict):
        decision_output = {}

    failed_checks: list[str] = []

    # ── Extract citations from free-text report ────────────────────────────────
    citations = _extract_citations(reason_output)

    # ── Bug #3: zero citations is a failure, not a free pass ───────────────────
    # The reasonAgent is expected to cite at least one regulation.  A report
    # with no extractable citations either means the LLM ignored the prompt or
    # the extraction patterns missed something — either way, force manager review.
    if not citations:
        failed_checks.append("no_citations_extracted")

    # ── Check 1: citation_exists ───────────────────────────────────────────────
    # Every extracted (act, section) pair must have a row in the regulations table.
    missing_any = False
    citation_rows: list[tuple[dict[str, str], Any]] = []

    for citation in citations:
        row = regulations_db.execute(
            "SELECT * FROM regulations WHERE act = ? AND section = ?",
            (citation["act"], citation["section"]),
        ).fetchone()
        citation_rows.append((citation, row))
        if row is None:
            missing_any = True

    if missing_any:
        failed_checks.append("citation_exists")

    # ── Check 2: citation_relevant ─────────────────────────────────────────────
    # For each citation that WAS found, its summary_text must share enough
    # keywords with the surrounding claim context.
    irrelevant_any = False
    for citation, row in citation_rows:
        if row is None:
            # Already flagged by citation_exists; skip relevance for missing rows.
            continue
        overlap = _keyword_overlap(citation["claim_context"], row["summary_text"])
        if overlap < CITATION_RELEVANCE_THRESHOLD:
            irrelevant_any = True
            break

    if irrelevant_any:
        failed_checks.append("citation_relevant")

    # ── Check 3: decision_consistent ──────────────────────────────────────────
    # ALLOW ≈ "Dismiss" intent — inappropriate if risk score is HIGH or above.
    # BLOCK ≈ "Block" intent  — inappropriate if risk score is clearly LOW.
    action = str(
        decision_output.get("action")
        or decision_output.get("recommended_action")
        or ""
    ).upper()

    dismiss_on_high_risk = action in ("ALLOW", "DISMISS") and risk_score >= HIGH_RISK_SCORE_THRESHOLD
    block_on_low_risk    = action == "BLOCK" and risk_score < LOW_MEDIUM_SCORE_BOUNDARY

    if dismiss_on_high_risk or block_on_low_risk:
        failed_checks.append("decision_consistent")

    # ── Assemble result ────────────────────────────────────────────────────────
    validated = len(failed_checks) == 0
    forced_review_level: str | None = "manager" if failed_checks else None

    return {
        "validated":           validated,
        "failed_checks":       failed_checks,
        "forced_review_level": forced_review_level,
    }
