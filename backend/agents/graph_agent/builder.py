"""Graph-building utilities for the Horizon transaction graph agent.

The builder is intentionally limited to graph construction and validation. It is
kept independent from databases, frontend contracts, and orchestrator logic.
"""

from __future__ import annotations

from typing import Any

import networkx as nx

from agents.graph_agent.schemas import TransactionRecord


def build_transaction_graph(transactions: list[dict[str, Any] | TransactionRecord]) -> nx.DiGraph:
    """Build a directed transaction graph from account-to-account transactions.

    Args:
        transactions: Raw dictionaries or validated TransactionRecord values.

    Returns:
        A directed NetworkX graph whose nodes are account IDs and whose edges are
        transactions with edge attributes preserving transaction metadata.
    """
    graph = nx.DiGraph()

    for transaction in transactions:
        record = (
            transaction if isinstance(transaction, TransactionRecord) else TransactionRecord.model_validate(transaction)
        )

        source = record.from_account_id
        target = record.to_account_id

        graph.add_node(source)
        graph.add_node(target)
        graph.add_edge(
            source,
            target,
            transaction_id=record.transaction_id,
            amount=record.amount,
            timestamp=record.timestamp,
            currency=record.currency,
            channel=record.channel,
            customer_id=record.customer_id,
        )

    return graph


def graph_to_connections(graph: nx.DiGraph) -> list[dict[str, Any]]:
    """Convert the graph edges into a JSON-serializable list of connections."""
    connections: list[dict[str, Any]] = []

    for source, target, attributes in graph.edges(data=True):
        connection = {
            "from": source,
            "to": target,
            "transaction_id": attributes.get("transaction_id"),
            "amount": attributes.get("amount"),
            "timestamp": attributes.get("timestamp"),
            "currency": attributes.get("currency"),
            "channel": attributes.get("channel"),
            "customer_id": attributes.get("customer_id"),
        }
        connections.append(connection)

    return connections
