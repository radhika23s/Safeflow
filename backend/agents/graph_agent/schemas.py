"""Validation schemas for the Horizon graph agent.

This module intentionally stays independent from the database, frontend, and
API layers. It defines the core transaction payload that the graph agent can
process.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionRecord(BaseModel):
    """A single financial transaction used to build the transaction graph.

    The graph agent consumes a transaction stream and converts account IDs into
    graph nodes and directed edges.
    """

    model_config = ConfigDict(extra="forbid")

    transaction_id: str = Field(..., min_length=1, description="Unique transaction identifier")
    from_account_id: str = Field(..., min_length=1, description="Source account identifier")
    to_account_id: str = Field(..., min_length=1, description="Destination account identifier")
    amount: float = Field(..., gt=0, description="Transaction amount; must be positive")
    timestamp: str = Field(..., description="ISO 8601 timestamp for the transaction")
    currency: str | None = Field(default=None, description="Transaction currency, e.g. INR")
    channel: str | None = Field(default=None, description="Payment channel, e.g. UPI, IMPS")
    customer_id: str | None = Field(default=None, description="Associated customer identifier")

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: str) -> str:
        """Ensure the timestamp is an ISO-8601 value that can be parsed."""
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:  # pragma: no cover - validation branch
            raise ValueError("timestamp must be a valid ISO 8601 string") from exc
        return value


class GraphAnalysisResult(BaseModel):
    """Serializable response returned by the graph analysis service."""

    nodes: list[str]
    connections: list[dict[str, Any]]
    node_count: int
    edge_count: int


class GraphBuildSummary(BaseModel):
    """High-level summary of the graph built from a transaction collection."""

    node_count: int
    edge_count: int
    directed: Literal[True] = True
