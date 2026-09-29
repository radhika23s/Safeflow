"""
Horizon — Synthetic UPI Transaction Data Generator
===================================================
Generates realistic fake UPI transaction data with:
- Legitimate transactions (normal behaviour)
- Fraud patterns: mule accounts, geo-velocity, SIM swap, card testing, fan-out

Run: python generate_data.py
Output: synthetic_data.json + horizon.db (SQLite)
"""

import json
import random
import uuid
import sqlite3
import os
from datetime import datetime, timedelta

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
TOTAL_CUSTOMERS     = 80
TOTAL_TRANSACTIONS  = 1000
FRAUD_RATIO         = 0.18      # 18% fraud (higher than real life for demo variety)
OUTPUT_JSON         = "synthetic_data.json"
DB_PATH             = "horizon.db"

random.seed(42)

# ─────────────────────────────────────────────
# INDIAN NAME + DATA GENERATORS
# ─────────────────────────────────────────────
FIRST_NAMES = [
    "Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Arnav","Ishaan","Shaurya",
    "Ananya","Pari","Aadhya","Aaradhya","Saanvi","Diya","Pihu","Myra","Riya","Sneha",
    "Rajesh","Suresh","Mahesh","Ramesh","Dinesh","Ganesh","Priya","Deepa","Meera","Kavya",
    "Kiran","Rohan","Mohan","Sohan","Harsh","Yash","Dev","Raj","Amit","Sumit",
    "Neha","Pooja","Anjali","Priyanka","Divya","Shweta","Rekha","Sunita","Usha","Radha"
]
LAST_NAMES = [
    "Sharma","Verma","Singh","Patel","Kumar","Gupta","Joshi","Mishra","Yadav","Pandey",
    "Reddy","Nair","Menon","Pillai","Iyer","Agarwal","Bansal","Garg","Mittal","Goyal",
    "Shah","Modi","Desai","Mehta","Jain","Patil","Kulkarni","Shukla","Tiwari","Dubey"
]
BANKS = ["SBI","HDFC","ICICI","Axis","PNB","Kotak","BOB","Canara","Union","IndusInd"]
CITIES = [
    ("Mumbai","19.0760","72.8777"),("Delhi","28.6139","77.2090"),
    ("Bangalore","12.9716","77.5946"),("Hyderabad","17.3850","78.4867"),
    ("Chennai","13.0827","80.2707"),("Kolkata","22.5726","88.3639"),
    ("Pune","18.5204","73.8567"),("Ahmedabad","23.0225","72.5714"),
    ("Jaipur","26.9124","75.7873"),("Lucknow","26.8467","80.9462"),
    ("Patna","25.5941","85.1376"),("Bhopal","23.2599","77.4126"),
    ("Indore","22.7196","75.8577"),("Nagpur","21.1458","79.0882"),
    ("Surat","21.1702","72.8311"),("Vadodara","22.3072","73.1812"),
    ("Coimbatore","11.0168","76.9558"),("Visakhapatnam","17.6868","83.2185"),
    ("Kanpur","26.4499","80.3319"),("Nashik","19.9975","73.7898")
]
VPN_IPS = [
    "185.220.101.1","45.14.48.100","193.239.147.22","5.255.98.64","77.111.244.1"
]
CHANNELS = ["UPI","UPI","UPI","IMPS","NEFT","RTGS","UPI","UPI"]


def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

def random_vpa(name, bank):
    handle = name.lower().replace(" ",".")[:12]
    suffix = random.choice(["ybl","okicici","okhdfcbank","oksbi","paytm","ibl"])
    return f"{handle}@{suffix}"

def random_account_id(bank):
    return f"{bank}-{random.randint(10000000, 99999999)}"

def random_device():
    devices = [
        "Samsung Galaxy S24","iPhone 15 Pro","Redmi Note 13","OnePlus 12",
        "Realme GT5","Vivo V29","Oppo Reno 11","Pixel 8","Moto G64"
    ]
    return f"{random.choice(devices)}-{uuid.uuid4().hex[:8].upper()}"

def random_ip(city_name, use_vpn=False):
    if use_vpn:
        return random.choice(VPN_IPS)
    # Fake ISP IPs per city region
    base = {
        "Mumbai": "103.21","Delhi": "103.94","Bangalore": "49.37",
        "Chennai": "115.114","Kolkata": "203.123","Hyderabad": "103.75",
    }.get(city_name, "117.96")
    return f"{base}.{random.randint(1,254)}.{random.randint(1,254)}"

def ts(base: datetime, delta_minutes: int = 0):
    return (base + timedelta(minutes=delta_minutes)).isoformat()


# ─────────────────────────────────────────────
# CUSTOMER GENERATOR
# ─────────────────────────────────────────────
def generate_customers():
    customers = []
    for i in range(TOTAL_CUSTOMERS):
        name = random_name()
        city, lat, lon = random.choice(CITIES)
        bank = random.choice(BANKS)
        acc_id = random_account_id(bank)
        is_mule = (i < int(TOTAL_CUSTOMERS * 0.12))   # 12% mule accounts
        is_pep  = (i < int(TOTAL_CUSTOMERS * 0.03))    # 3% PEP

        customers.append({
            "customer_id":   f"CUST-{str(i+1).zfill(4)}",
            "name":          name,
            "account_id":    acc_id,
            "bank":          bank,
            "vpa":           random_vpa(name, bank),
            "kyc_status":    random.choice(["FULL_KYC","FULL_KYC","FULL_KYC","E_KYC","SIMPLIFIED"]),
            "risk_category": "HIGH" if is_mule or is_pep else random.choice(["LOW","LOW","MEDIUM"]),
            "city":          city,
            "lat":           lat,
            "lon":           lon,
            "phone":         f"+91-{random.randint(7000000000,9999999999)}",
            "email":         f"{name.lower().replace(' ','.')}{random.randint(10,99)}@gmail.com",
            "account_age_days": random.randint(30, 1800),
            "is_mule_suspected": is_mule,
            "is_pep":        is_pep,
            "primary_device": random_device(),
            "created_at":    (datetime.now() - timedelta(days=random.randint(30, 1800))).isoformat(),
        })
    return customers


# ─────────────────────────────────────────────
# TRANSACTION PATTERN GENERATORS
# ─────────────────────────────────────────────
def gen_legit_transaction(customers, base_time):
    sender   = random.choice(customers)
    receiver = random.choice([c for c in customers if c != sender])
    amount   = round(random.uniform(50, 50000), 2)
    city, lat, lon = sender["city"], sender["lat"], sender["lon"]

    return {
        "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
        "case_id":         None,
        "sender_id":       sender["customer_id"],
        "sender_account":  sender["account_id"],
        "sender_vpa":      sender["vpa"],
        "receiver_id":     receiver["customer_id"],
        "receiver_account":receiver["account_id"],
        "receiver_vpa":    receiver["vpa"],
        "amount":          amount,
        "channel":         random.choice(CHANNELS),
        "timestamp":       ts(base_time, random.randint(-120, 120)),
        "device_id":       sender["primary_device"],
        "ip_address":      random_ip(city),
        "location_city":   city,
        "location_lat":    lat,
        "location_lon":    lon,
        "is_new_payee":    random.random() < 0.15,
        "is_vpn":          False,
        "fraud_type":      None,
        "is_fraud":        False,
        "alert_triggered": False,
    }


def gen_mule_fanout(customers, base_time):
    """Classic mule: large receive → immediate disperse to 3-5 accounts"""
    mules = [c for c in customers if c["is_mule_suspected"]]
    if not mules:
        return []
    mule = random.choice(mules)
    sender = random.choice([c for c in customers if not c["is_mule_suspected"]])

    # Inflow
    inflow_amount = round(random.uniform(100000, 500000), 2)
    txns = []
    inflow_time = base_time

    txns.append({
        "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
        "case_id":         None,
        "sender_id":       sender["customer_id"],
        "sender_account":  sender["account_id"],
        "sender_vpa":      sender["vpa"],
        "receiver_id":     mule["customer_id"],
        "receiver_account":mule["account_id"],
        "receiver_vpa":    mule["vpa"],
        "amount":          inflow_amount,
        "channel":         "IMPS",
        "timestamp":       ts(inflow_time),
        "device_id":       f"UNKNOWN-{uuid.uuid4().hex[:8].upper()}",
        "ip_address":      random.choice(VPN_IPS),
        "location_city":   mule["city"],
        "location_lat":    mule["lat"],
        "location_lon":    mule["lon"],
        "is_new_payee":    True,
        "is_vpn":          True,
        "fraud_type":      "MULE_INFLOW",
        "is_fraud":        True,
        "alert_triggered": True,
    })

    # Rapid fan-out within 5-10 minutes
    targets = random.sample([c for c in customers if c != mule and not c["is_mule_suspected"]], k=random.randint(3,5))
    each = round(inflow_amount / len(targets) * 0.95, 2)
    for i, target in enumerate(targets):
        txns.append({
            "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
            "case_id":         None,
            "sender_id":       mule["customer_id"],
            "sender_account":  mule["account_id"],
            "sender_vpa":      mule["vpa"],
            "receiver_id":     target["customer_id"],
            "receiver_account":target["account_id"],
            "receiver_vpa":    target["vpa"],
            "amount":          each,
            "channel":         "UPI",
            "timestamp":       ts(inflow_time, i*2 + 3),   # 3-15 minutes after inflow
            "device_id":       f"UNKNOWN-{uuid.uuid4().hex[:8].upper()}",
            "ip_address":      random.choice(VPN_IPS),
            "location_city":   mule["city"],
            "location_lat":    mule["lat"],
            "location_lon":    mule["lon"],
            "is_new_payee":    True,
            "is_vpn":          True,
            "fraud_type":      "MULE_FANOUT",
            "is_fraud":        True,
            "alert_triggered": True,
        })
    return txns


def gen_geo_velocity(customers, base_time):
    """Impossible travel: Mumbai → London in 20 minutes"""
    victim = random.choice(customers)
    return [{
        "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
        "case_id":         None,
        "sender_id":       victim["customer_id"],
        "sender_account":  victim["account_id"],
        "sender_vpa":      victim["vpa"],
        "receiver_id":     random.choice(customers)["customer_id"],
        "receiver_account":random.choice(customers)["account_id"],
        "receiver_vpa":    random.choice(customers)["vpa"],
        "amount":          round(random.uniform(50000, 200000), 2),
        "channel":         "UPI",
        "timestamp":       ts(base_time, 20),   # 20 min after legit txn in India
        "device_id":       f"UNKNOWN-{uuid.uuid4().hex[:8].upper()}",
        "ip_address":      "185.220.101.1",     # UK VPN
        "location_city":   "London",
        "location_lat":    "51.5074",
        "location_lon":    "-0.1278",
        "is_new_payee":    True,
        "is_vpn":          True,
        "fraud_type":      "GEO_VELOCITY",
        "is_fraud":        True,
        "alert_triggered": True,
    }]


def gen_sim_swap(customers, base_time):
    """SIM swap: new device suddenly used with victim account"""
    victim = random.choice(customers)
    return [{
        "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
        "case_id":         None,
        "sender_id":       victim["customer_id"],
        "sender_account":  victim["account_id"],
        "sender_vpa":      victim["vpa"],
        "receiver_id":     random.choice(customers)["customer_id"],
        "receiver_account":random.choice(customers)["account_id"],
        "receiver_vpa":    random.choice(customers)["vpa"],
        "amount":          round(random.uniform(80000, 300000), 2),
        "channel":         "UPI",
        "timestamp":       ts(base_time),
        "device_id":       f"NEW-DEVICE-{uuid.uuid4().hex[:8].upper()}",   # New device!
        "ip_address":      random_ip(victim["city"]),
        "location_city":   victim["city"],
        "location_lat":    victim["lat"],
        "location_lon":    victim["lon"],
        "is_new_payee":    True,
        "is_vpn":          False,
        "fraud_type":      "SIM_SWAP",
        "is_fraud":        True,
        "alert_triggered": True,
    }]


def gen_velocity_burst(customers, base_time):
    """Card testing: many small txns in short window"""
    attacker = random.choice(customers)
    txns = []
    for i in range(random.randint(8, 15)):
        txns.append({
            "transaction_id":  f"TXN-{uuid.uuid4().hex[:12].upper()}",
            "case_id":         None,
            "sender_id":       attacker["customer_id"],
            "sender_account":  attacker["account_id"],
            "sender_vpa":      attacker["vpa"],
            "receiver_id":     random.choice(customers)["customer_id"],
            "receiver_account":random.choice(customers)["account_id"],
            "receiver_vpa":    random.choice(customers)["vpa"],
            "amount":          round(random.uniform(1, 99), 2),  # tiny amounts = card testing
            "channel":         "UPI",
            "timestamp":       ts(base_time, i * 2),
            "device_id":       attacker["primary_device"],
            "ip_address":      random.choice(VPN_IPS),
            "location_city":   attacker["city"],
            "location_lat":    attacker["lat"],
            "location_lon":    attacker["lon"],
            "is_new_payee":    True,
            "is_vpn":          True,
            "fraud_type":      "VELOCITY_BURST",
            "is_fraud":        True,
            "alert_triggered": True,
        })
    return txns


# ─────────────────────────────────────────────
# MAIN GENERATOR
# ─────────────────────────────────────────────
def generate_all():
    print("[GEN] Generating customers...")
    customers = generate_customers(N_CUSTOMERS)
    print(f"      Created {len(customers)} customers")

    print("[GEN] Generating transactions...")
    all_txns = []
    base_date = datetime.now() - timedelta(days=90)

    # How many fraud vs legit
    n_fraud = int(TOTAL_TRANSACTIONS * FRAUD_RATIO)
    n_legit = TOTAL_TRANSACTIONS - n_fraud

    # Legit transactions
    for i in range(n_legit):
        t = base_date + timedelta(minutes=random.randint(0, 90*24*60))
        all_txns.append(gen_legit_transaction(customers, t))

    # Fraud patterns
    fraud_generated = 0
    while fraud_generated < n_fraud:
        t = base_date + timedelta(minutes=random.randint(0, 90*24*60))
        pattern = random.choice(["mule","geo","sim","velocity"])
        if pattern == "mule":
            batch = gen_mule_fanout(customers, t)
        elif pattern == "geo":
            batch = gen_geo_velocity(customers, t)
        elif pattern == "sim":
            batch = gen_sim_swap(customers, t)
        else:
            batch = gen_velocity_burst(customers, t)

        all_txns.extend(batch)
        fraud_generated += len(batch)
        if fraud_generated >= n_fraud:
            break

    # Trim to exactly TOTAL_TRANSACTIONS
    random.shuffle(all_txns)
    all_txns = all_txns[:TOTAL_TRANSACTIONS]

    print(f"   Total transactions: {len(all_txns)}")
    print(f"   Fraud: {sum(1 for t in all_txns if t['is_fraud'])}")
    print(f"   Legit: {sum(1 for t in all_txns if not t['is_fraud'])}")

    return customers, all_txns


# ─────────────────────────────────────────────
# SAVE TO JSON
# ─────────────────────────────────────────────
def save_json(customers, transactions):
    data = {"customers": customers, "transactions": transactions}
    with open(OUTPUT_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"[SAVED] Saved {OUTPUT_JSON}")


# ─────────────────────────────────────────────
# SAVE TO SQLITE
# ─────────────────────────────────────────────
def save_sqlite(customers, transactions):
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Customers table
    c.execute("""
        CREATE TABLE customers (
            customer_id TEXT PRIMARY KEY,
            name TEXT, account_id TEXT, bank TEXT, vpa TEXT,
            kyc_status TEXT, risk_category TEXT, city TEXT,
            lat TEXT, lon TEXT, phone TEXT, email TEXT,
            account_age_days INTEGER, is_mule_suspected INTEGER,
            is_pep INTEGER, primary_device TEXT, created_at TEXT
        )
    """)
    for cu in customers:
        c.execute("""
            INSERT INTO customers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            cu["customer_id"], cu["name"], cu["account_id"], cu["bank"],
            cu["vpa"], cu["kyc_status"], cu["risk_category"], cu["city"],
            cu["lat"], cu["lon"], cu["phone"], cu["email"],
            cu["account_age_days"], int(cu["is_mule_suspected"]),
            int(cu["is_pep"]), cu["primary_device"], cu["created_at"]
        ))

    # Transactions table
    c.execute("""
        CREATE TABLE transactions (
            transaction_id TEXT PRIMARY KEY,
            case_id TEXT,
            sender_id TEXT, sender_account TEXT, sender_vpa TEXT,
            receiver_id TEXT, receiver_account TEXT, receiver_vpa TEXT,
            amount REAL, channel TEXT, timestamp TEXT,
            device_id TEXT, ip_address TEXT,
            location_city TEXT, location_lat TEXT, location_lon TEXT,
            is_new_payee INTEGER, is_vpn INTEGER,
            fraud_type TEXT, is_fraud INTEGER, alert_triggered INTEGER
        )
    """)
    for tx in transactions:
        c.execute("""
            INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            tx["transaction_id"], tx["case_id"],
            tx["sender_id"], tx["sender_account"], tx["sender_vpa"],
            tx["receiver_id"], tx["receiver_account"], tx["receiver_vpa"],
            tx["amount"], tx["channel"], tx["timestamp"],
            tx["device_id"], tx["ip_address"],
            tx["location_city"], tx["location_lat"], tx["location_lon"],
            int(tx["is_new_payee"]), int(tx["is_vpn"]),
            tx["fraud_type"], int(tx["is_fraud"]), int(tx["alert_triggered"])
        ))

    # Cases table (empty to start — filled by the investigation system)
    c.execute("""
        CREATE TABLE cases (
            case_id TEXT PRIMARY KEY,
            transaction_id TEXT,
            status TEXT DEFAULT 'OPEN',
            risk_score REAL,
            recommended_action TEXT,
            analyst_id TEXT,
            analyst_decision TEXT,
            opened_at TEXT,
            closed_at TEXT,
            notes TEXT
        )
    """)

    # Audit log table
    c.execute("""
        CREATE TABLE audit_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            action TEXT,
            actor TEXT,
            details TEXT,
            timestamp TEXT
        )
    """)

    conn.commit()
    conn.close()
    print(f"[SAVED] Saved {DB_PATH} (SQLite database)")


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\n[START] Horizon - Synthetic Data Generator")
    print("=" * 45)
    customers, transactions = generate_all()
    save_json(customers, transactions)
    save_sqlite(customers, transactions)

    print("\n[SUMMARY] Summary:")
    fraud_types = {}
    for t in transactions:
        if t["fraud_type"]:
            fraud_types[t["fraud_type"]] = fraud_types.get(t["fraud_type"], 0) + 1
    for k, v in sorted(fraud_types.items()):
        print(f"   {k}: {v}")

    print("\n[DONE] Files created:")
    print(f"   -> {OUTPUT_JSON}")
    print(f"   -> {DB_PATH}")
    print("\nNext step: python -m uvicorn main:app --reload")
