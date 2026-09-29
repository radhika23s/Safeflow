"""Service layer for the initial Horizon graph agent foundation.

This service is intentionally lightweight: it validates the input transaction
payload, builds the NetworkX graph, and returns JSON-serializable graph
summary data. Complex detection logic such as fan-in/fan-out and circular flow
is intentionally deferred.
"""

from __future__ import annotations

from typing import Any

from agents.graph_agent.builder import build_transaction_graph, graph_to_connections
from agents.graph_agent.schemas import GraphAnalysisResult, TransactionRecord


def _validate_transactions(transactions: list[dict[str, Any]]) -> list[TransactionRecord]:
    """Validate a list of transaction dictionaries and return typed records."""
    if transactions is None:
        raise ValueError("transactions must not be None")

    if not isinstance(transactions, list):
        raise TypeError("transactions must be a list of transaction objects")

    if len(transactions) == 0:
        return []

    validated: list[TransactionRecord] = []
    for index, transaction in enumerate(transactions):
        if not isinstance(transaction, dict):
            raise TypeError(f"transaction at index {index} must be a dictionary")
        validated.append(TransactionRecord.model_validate(transaction))

    return validated


def analyze_transactions(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    """Analyze a list of transactions and return basic graph information.

    Args:
        transactions: A list of transaction objects with the required fields:
            transaction_id, from_account_id, to_account_id, amount, timestamp.

    Returns:
        A JSON-serializable dictionary containing the graph nodes, edge list,
        and basic summary counts.
    """
    validated_transactions = _validate_transactions(transactions)
    graph = build_transaction_graph(validated_transactions)

    connections = graph_to_connections(graph)
    nodes = sorted(graph.nodes())

    result = GraphAnalysisResult(
        nodes=nodes,
        connections=connections,
        node_count=graph.number_of_nodes(),
        edge_count=graph.number_of_edges(),
    )

    return result.model_dump(mode="json")
