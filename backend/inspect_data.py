import csv

files = [
    "drivematerial/drive_material/Data/paysim_base_128k.csv",
    "drivematerial/drive_material/Data/account.csv",
    "drivematerial/drive_material/Data/synthetic_S01_rapid_transfers.csv",
    "drivematerial/drive_material/Data/synthetic_S06_transfer_cashout.csv",
    "drivematerial/drive_material/Data/synthetic_L01_legitimate_high_value.csv",
    "drivematerial/drive_material/Data/paysim_account_customer_mapping.csv",
]

for f in files:
    fname = f.split("/")[-1]
    print("=== " + fname + " ===")
    try:
        with open(f, encoding="utf-8", errors="ignore") as fh:
            r = csv.reader(fh)
            cols = next(r)
            print("COLUMNS:", cols)
            row1 = next(r, None)
            if row1:
                print("ROW 1:", dict(zip(cols, row1)))
    except Exception as e:
        print("ERROR:", e)
    print()
