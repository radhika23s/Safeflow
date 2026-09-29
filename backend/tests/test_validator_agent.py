"""
test_validator_agent.py — pytest suite for validatorAgent (Phase 3)
====================================================================
All six test cases run entirely in-memory; no filesystem side-effects.
Each test builds its own fresh in-memory SQLite DB so tests are fully
independent.

Test matrix
-----------
1. test_all_checks_pass             — happy path; all three checks green.
2. test_missing_citation_fails      — extracted citation not in regulations table.
3. test_irrelevant_citation_fails   — citation found but keyword overlap below threshold.
4. test_dismiss_on_high_risk_fails  — ALLOW action while risk_score >= HIGH threshold.
5. test_block_on_low_risk_fails     — BLOCK action while risk_score < LOW boundary.
6. test_multiple_simultaneous_failures — citation_exists + decision_consistent both fail.
"""

import sqlite3
import sys
import os

import pytest

# Ensure the backend root is on sys.path so the import resolves without
# needing the package to be installed (mirrors the existing conftest.py).
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.validator_agent import (
    validate_investigation,
    CITATION_RELEVANCE_THRESHOLD,
    HIGH_RISK_SCORE_THRESHOLD,
    LOW_MEDIUM_SCORE_BOUNDARY,
)


# ─── Shared fixtures ──────────────────────────────────────────────────────────

def _make_db(extra_rows: list[tuple] | None = None) -> sqlite3.Connection:
    """Return a fresh in-memory SQLite connection seeded with baseline regulations.

    Pass extra_rows as (act, section, page_ref, summary_text) tuples to
    insert additional regulations for a specific test case.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE regulations (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            act          TEXT NOT NULL,
            section      TEXT NOT NULL,
            page_ref     TEXT,
            summary_text TEXT NOT NULL,
            UNIQUE(act, section)
        )
    """)
    baseline = [
        (
            "PMLA", "12", "8",
            (
                "Obligation of banking companies, financial institutions, and "
                "intermediaries to maintain records of all transactions above "
                "prescribed thresholds and to furnish information to the Financial "
                "Intelligence Unit India FIU-IND. Requires filing of Suspicious "
                "Transaction Reports STR within seven days of forming a suspicion of "
                "money laundering. Failure to comply constitutes a criminal offence "
                "under the Prevention of Money Laundering Act."
            ),
        ),
        (
            "RBI_MASTER_DIRECTION_FRM_2024", "GENERAL", "N/A",
            (
                "Banks must maintain a Board approved Fraud Risk Management Policy with "
                "an Early Warning Signal system for proactive detection of fraud "
                "indicators. Mandates immediate containment measures, customer "
                "verification, freezing of suspect accounts, and reporting of fraud "
                "incidents to the Reserve Bank of India within prescribed timelines. "
                "Requires dedicated fraud risk governance, root cause analysis, and "
                "periodic reviews of fraud prevention controls."
            ),
        ),
        (
            "NPCI_OC", "138", "N/A",
            "PLACEHOLDER — needs real regulatory text for NPCI UPI Circular No. 138.",
        ),
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO regulations (act, section, page_ref, summary_text) VALUES (?,?,?,?)",
        baseline,
    )
    if extra_rows:
        conn.executemany(
            "INSERT OR IGNORE INTO regulations (act, section, page_ref, summary_text) VALUES (?,?,?,?)",
            extra_rows,
        )
    conn.commit()
    return conn


# A realistic investigation report that deliberately uses the vocabulary that
# appears in the corresponding summary_text rows so the keyword-overlap check
# can pass at CITATION_RELEVANCE_THRESHOLD = 0.15.
_VALID_REPORT = """
### 3. REGULATORY COMPLIANCE ASSESSMENT

- PMLA 2002 Section 12: Reporting obligations mandate filing of Suspicious Transaction
  Reports (STR) with FIU-IND. Banking companies must maintain transaction records and
  report suspicious transactions within seven days to Financial Intelligence Unit India.

- RBI Master Direction - Fraud Risk Management in Commercial Banks 2024: Banks must
  implement Early Warning Signal systems and Board approved Fraud Risk Management
  policies. Mandates immediate containment and customer verification for flagged accounts.
"""

_VALID_DECISION = {"action": "BLOCK", "confidence": 0.92}
_HIGH_RISK_SCORE = 85.0   # CRITICAL band — consistent with BLOCK


# ─── Test 1: all checks pass ─────────────────────────────────────────────────

def test_all_checks_pass():
    """Happy path: valid citations, relevant contexts, decision consistent with score."""
    db = _make_db()
    result = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output=_VALID_DECISION,
        risk_score=_HIGH_RISK_SCORE,
        regulations_db=db,
    )
    assert result["validated"] is True, f"Expected validated=True, got: {result}"
    assert result["failed_checks"] == [], f"Expected no failed checks, got: {result['failed_checks']}"
    assert result["forced_review_level"] is None


# ─── Test 2: citation not found in DB ────────────────────────────────────────

def test_missing_citation_fails():
    """A PMLA section not in the regulations table triggers citation_exists."""
    db = _make_db()
    # PMLA Section 47 matches the PMLA regex but has no row in the DB.
    report_with_unknown = """
### REGULATORY COMPLIANCE ASSESSMENT

- PMLA 2002 Section 47: Offences and penalties provisions invoked for
  non-compliance with reporting obligations.
- PMLA 2002 Section 12: STR filing required within seven days to FIU-IND.
  Banking companies must maintain transaction records and report suspicious
  transactions and money laundering activity.
"""
    result = validate_investigation(
        reason_output=report_with_unknown,
        decision_output={"action": "BLOCK", "confidence": 0.88},
        risk_score=82.0,
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "citation_exists" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"


# ─── Test 3: citation found but irrelevant ────────────────────────────────────

def test_irrelevant_citation_fails():
    """A citation that exists in the DB but has negligible keyword overlap fails."""
    # Insert PMLA Section 99 with a summary about definitions — completely
    # unrelated vocabulary to the mule/velocity claim in the report below.
    db = _make_db(extra_rows=[(
        "PMLA", "99", "N/A",
        "Definitions and interpretations of terms used in the act.",
    )])
    report = """
### 3. REGULATORY COMPLIANCE ASSESSMENT

- PMLA 2002 Section 99: The customer exhibited rapid fan-out velocity dispersal
  across mule accounts with circular transaction patterns occurring at extremely
  high frequency within a short time window.
"""
    result = validate_investigation(
        reason_output=report,
        decision_output={"action": "BLOCK", "confidence": 0.80},
        risk_score=75.0,    # HIGH band — BLOCK is consistent
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "citation_relevant" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"
    # citation_exists should NOT be in failed_checks (section 99 IS in the DB)
    assert "citation_exists" not in result["failed_checks"]


# ─── Test 4: Dismiss action on high-risk score ───────────────────────────────

def test_dismiss_on_high_risk_fails():
    """ALLOW (≈ Dismiss) action on a HIGH risk score triggers decision_consistent."""
    db = _make_db()
    result = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output={"action": "ALLOW", "confidence": 0.25},
        risk_score=75.0,   # HIGH band: 61 ≤ score < 81 — should NOT be dismissed
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "decision_consistent" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"
    # Confirm the boundary: exactly at threshold should still fail
    result_at_boundary = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output={"action": "ALLOW", "confidence": 0.20},
        risk_score=HIGH_RISK_SCORE_THRESHOLD,   # exactly 61.0
        regulations_db=_make_db(),
    )
    assert "decision_consistent" in result_at_boundary["failed_checks"]


# ─── Test 5: Block action on low-risk score ──────────────────────────────────

def test_block_on_low_risk_fails():
    """BLOCK action on a LOW risk score (<20) triggers decision_consistent."""
    db = _make_db()
    result = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output={"action": "BLOCK", "confidence": 0.95},
        risk_score=15.0,   # LOW band: clearly below 20
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "decision_consistent" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"
    # Confirm the boundary: score at exactly the boundary should still fail
    result_at_boundary = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output={"action": "BLOCK", "confidence": 0.95},
        risk_score=LOW_MEDIUM_SCORE_BOUNDARY - 0.1,  # 29.9 — just below
        regulations_db=_make_db(),
    )
    assert "decision_consistent" in result_at_boundary["failed_checks"]
    # And score at exactly LOW_MEDIUM_SCORE_BOUNDARY should NOT fail (it's MEDIUM)
    result_medium = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output={"action": "BLOCK", "confidence": 0.95},
        risk_score=LOW_MEDIUM_SCORE_BOUNDARY,  # 30.0 — MEDIUM, BLOCK allowed
        regulations_db=_make_db(),
    )
    assert "decision_consistent" not in result_medium["failed_checks"]


# ─── Test 6: Multiple simultaneous failures ───────────────────────────────────

def test_multiple_simultaneous_failures():
    """citation_exists and decision_consistent both fail independently."""
    db = _make_db()
    # Report cites PMLA Sec 47 (not in DB) — triggers citation_exists.
    # Decision is ALLOW on score 80 (HIGH) — triggers decision_consistent.
    report = """
### REGULATORY COMPLIANCE ASSESSMENT

- PMLA 2002 Section 47: Penalty provisions apply to non-compliant reporting entities.
"""
    result = validate_investigation(
        reason_output=report,
        decision_output={"action": "ALLOW", "confidence": 0.15},
        risk_score=80.0,   # HIGH (61–80): ALLOW is inconsistent
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "citation_exists" in result["failed_checks"], result
    assert "decision_consistent" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"
    assert len(result["failed_checks"]) >= 2


# ─── Test 7: sub-section notation normalization (Bug #1 fix) ─────────────────

def test_subsection_notation_normalizes_to_base_section():
    """'PMLA 2002 Section 12(1)(a)' must normalize to section='12' for DB lookup.

    Before the fix, the regex captured '12(1)(a)' and strip('()') left '12(1)(a'
    — mismatched parens that never matched the DB row, causing a false
    citation_exists failure.
    """
    db = _make_db()
    report = """
### REGULATORY COMPLIANCE ASSESSMENT

- PMLA 2002 Section 12(1)(a): Banking companies must furnish information to
  FIU-IND about suspicious transactions. Maintain records of all transactions
  above prescribed thresholds and report suspicious money laundering activity
  within seven days under the Prevention of Money Laundering Act.
"""
    result = validate_investigation(
        reason_output=report,
        decision_output={"action": "BLOCK", "confidence": 0.85},
        risk_score=82.0,
        regulations_db=db,
    )
    assert "citation_exists" not in result["failed_checks"], (
        f"'PMLA 2002 Section 12(1)(a)' should normalize to section='12' and "
        f"find the DB row, but got failed_checks={result['failed_checks']}"
    )


# ─── Test 8: reason_output=None does not crash (Bug #5 fix) ─────────────────

def test_none_reason_output_does_not_crash():
    """reason_output=None should be coerced to '' rather than raising TypeError."""
    db = _make_db()
    result = validate_investigation(
        reason_output=None,          # would previously crash re.finditer(None)
        decision_output={"action": "MONITOR", "confidence": 0.5},
        risk_score=50.0,
        regulations_db=db,
    )
    assert isinstance(result, dict), "Must return a dict, not raise an exception"
    assert "validated" in result
    # None coerced to "" → zero citations → no_citations_extracted is added
    assert "no_citations_extracted" in result["failed_checks"]
    assert result["forced_review_level"] == "manager"


# ─── Test 9: decision_output=None does not crash (Bug #5 fix) ────────────────

def test_none_decision_output_does_not_crash():
    """decision_output=None should be coerced to {} rather than raising AttributeError."""
    db = _make_db()
    result = validate_investigation(
        reason_output=_VALID_REPORT,
        decision_output=None,        # would previously crash on None.get('action')
        risk_score=50.0,
        regulations_db=db,
    )
    assert isinstance(result, dict), "Must return a dict, not raise an exception"
    assert "validated" in result
    # {} coerced from None → action='' → decision_consistent passes (empty string
    # is not ALLOW or BLOCK so the check doesn't fire)
    assert "decision_consistent" not in result["failed_checks"]


# ─── Test 10: zero citations forces failure (Bug #3 fix) ─────────────────────

def test_zero_citations_forces_failure():
    """A report with no extractable citations must fail, not silently pass.

    The reasonAgent is expected to cite at least one regulation.  If no
    citations are found (LLM ignored the prompt, or the report is empty),
    'no_citations_extracted' must appear in failed_checks.
    """
    db = _make_db()
    report_no_citations = (
        "The transaction shows unusual velocity. Recommend blocking the account "
        "pending further investigation based on behavioural anomalies."
    )
    result = validate_investigation(
        reason_output=report_no_citations,
        decision_output={"action": "MONITOR", "confidence": 0.5},
        risk_score=50.0,
        regulations_db=db,
    )
    assert result["validated"] is False
    assert "no_citations_extracted" in result["failed_checks"], result
    assert result["forced_review_level"] == "manager"
    # Also confirm an empty string behaves the same way
    result_empty = validate_investigation(
        reason_output="",
        decision_output={"action": "MONITOR", "confidence": 0.5},
        risk_score=50.0,
        regulations_db=_make_db(),
    )
    assert "no_citations_extracted" in result_empty["failed_checks"]

