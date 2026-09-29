import certifi
from pymongo import MongoClient
from bson import ObjectId

URI = "mongodb+srv://digvijayb044:dbmongo@cluster0.iwjg1gh.mongodb.net/banking_system?retryWrites=true&w=majority"
client = MongoClient(URI, tlsCAFile=certifi.where())
db = client["banking_system"]

accounts = list(db.accounts.find({}))
print(f"Found {len(accounts)} accounts in MongoDB:")
for a in accounts:
    uid = a.get("user")
    user = db.users.find_one({"_id": uid})
    uname = user.get("name") if user else "Unknown"
    email = user.get("email") if user else "Unknown"
    ledgers = list(db.ledgers.find({"account": a["_id"]}))
    credits = sum(float(l["amount"]) for l in ledgers if l.get("type") == "credit")
    debits = sum(float(l["amount"]) for l in ledgers if l.get("type") == "debit")
    balance = credits - debits
    print(f"  Account ID: {a['_id']} | User: {uname} ({email}) | Balance: INR {balance:,.2f}")
