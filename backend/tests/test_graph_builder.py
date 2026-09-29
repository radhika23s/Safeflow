from agents.graph_agent.service import analyze_transactions


def test_one_normal_transaction():
    transactions = [
        {
            "transaction_id": "tx-1",
            "from_account_id": "A-100",
            "to_account_id": "A-200",
            "amount": 2500.00,
            "timestamp": "2026-08-21T10:00:00Z",
        }
    ]

    result = analyze_transactions(transactions)

    assert result["node_count"] == 2
    assert result["edge_count"] == 1
    assert set(result["nodes"]) == {"A-100", "A-200"}
    assert result["connections"][0]["transaction_id"] == "tx-1"
    assert result["connections"][0]["from"] == "A-100"
    assert result["connections"][0]["to"] == "A-200"


def test_multiple_transactions_builds_graph():
    transactions = [
        {
            "transaction_id": "tx-1",
            "from_account_id": "A-100",
            "to_account_id": "A-200",
            "amount": 2500.00,
            "timestamp": "2026-08-21T10:00:00Z",
        },
        {
            "transaction_id": "tx-2",
            "from_account_id": "A-200",
            "to_account_id": "A-300",
            "amount": 1500.00,
            "timestamp": "2026-08-21T10:05:00Z",
            "currency": "INR",
            "channel": "UPI",
            "customer_id": "C-42",
        },
    ]

    result = analyze_transactions(transactions)

    assert result["node_count"] == 3
    assert result["edge_count"] == 2
    assert set(result["nodes"]) == {"A-100", "A-200", "A-300"}
    assert len(result["connections"]) == 2
    assert result["connections"][1]["currency"] == "INR"
    assert result["connections"][1]["channel"] == "UPI"
    assert result["connections"][1]["customer_id"] == "C-42"


def test_node_creation_for_multiple_accounts():
    transactions = [
        {
            "transaction_id": "tx-1",
            "from_account_id": "A-100",
            "to_account_id": "A-200",
            "amount": 3000.00,
            "timestamp": "2026-08-21T10:00:00Z",
        },
        {
            "transaction_id": "tx-2",
            "from_account_id": "A-200",
            "to_account_id": "A-100",
            "amount": 500.00,
            "timestamp": "2026-08-21T10:10:00Z",
        },
    ]

    result = analyze_transactions(transactions)

    assert result["nodes"] == ["A-100", "A-200"] or set(result["nodes"]) == {"A-100", "A-200"}


def test_edge_creation_for_multiple_transactions():
    transactions = [
        {
            "transaction_id": "tx-1",
            "from_account_id": "A-100",
            "to_account_id": "A-200",
            "amount": 3000.00,
            "timestamp": "2026-08-21T10:00:00Z",
        },
        {
            "transaction_id": "tx-2",
            "from_account_id": "A-200",
            "to_account_id": "A-300",
            "amount": 1000.00,
            "timestamp": "2026-08-21T10:05:00Z",
        },
    ]

    result = analyze_transactions(transactions)

    assert len(result["connections"]) == 2
    assert all("transaction_id" in edge for edge in result["connections"])
    assert all("amount" in edge for edge in result["connections"])
    assert all("timestamp" in edge for edge in result["connections"])


def test_empty_transaction_list_returns_empty_graph():
    result = analyze_transactions([])

    assert result["node_count"] == 0
    assert result["edge_count"] == 0
    assert result["nodes"] == []
    assert result["connections"] == []
