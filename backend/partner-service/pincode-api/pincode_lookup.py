
import pandas as pd

# Load pre-merged data (assumes you already ran the merging script)
DATA_FILE = "merged_pincode_data.csv"

# Load only once
df = pd.read_csv(DATA_FILE)
df["pincode"] = df["pincode"].astype(str).str.strip()

def get_pincode_info(pincode):
    pincode = str(pincode).strip()
    result = df[df["pincode"] == pincode]

    if result.empty:
        return {"error": "Pincode not found"}

    row = result.iloc[0]
    return {
        "pincode": int(row["pincode"]),
        "area": row["area"],
        "lat": float(row["lat"]) if not pd.isna(row["lat"]) else None,
        "lng": float(row["lng"]) if not pd.isna(row["lng"]) else None,
        "district": row["district"],
        "state": row["state"],
        "type": row["type"]
    }

# Example usage
if __name__ == "__main__":
    while True:
        pin = input("Enter Pincode (or 'exit'): ").strip()
        if pin.lower() == 'exit':
            break
        print(get_pincode_info(pin))
