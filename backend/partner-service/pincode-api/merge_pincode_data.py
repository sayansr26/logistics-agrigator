import pandas as pd
import csv

# STEP 1: Load India Post pincode data
india_post_df = pd.read_csv("All_India_Pincode_directory.csv", low_memory=False)
india_post_df.columns = [col.strip().lower().replace(" ", "_") for col in india_post_df.columns]

print("📌 India Post Columns:", india_post_df.columns.tolist())

# STEP 2: Load GeoNames IN.txt
geonames_data = []
with open("IN.txt", "r", encoding="utf-8") as f:
    reader = csv.reader(f, delimiter='\t')
    for row in reader:
        try:
            geonames_data.append({
                "pincode": int(row[1]),
                "geo_area": row[2],
                "lat": float(row[9]),
                "lng": float(row[10])
            })
        except (ValueError, IndexError):
            pass  # skip bad rows

geonames_df = pd.DataFrame(geonames_data)

# STEP 3: Merge on pincode
merged_df = pd.merge(india_post_df, geonames_df, how="left", on="pincode")

print("🧐 Unique officetype values:", india_post_df["officetype"].dropna().unique())

# STEP 4: Infer urban/rural from officetype (handles B.O, H.O, S.O)
def infer_type(office_type):
    if not isinstance(office_type, str):
        return "unknown"

    office_type = office_type.strip().lower()

    if office_type == "bo":
        return "rural"
    elif office_type in ["ho", "po"]:
        return "urban"
    return "unknown"

merged_df["type"] = merged_df["officetype"].apply(infer_type)

# STEP 5: Set area name (GeoName > OfficeName fallback)
merged_df["area"] = merged_df["geo_area"].combine_first(merged_df["officename"])

# STEP 6: Final output
final_columns = ["pincode", "area", "lat", "lng", "district", "statename", "type"]
missing = [col for col in final_columns if col not in merged_df.columns]
if missing:
    print("❌ Missing columns:", missing)
    exit(1)

output = merged_df[final_columns].rename(columns={"statename": "state"})

# STEP 7: Save merged output
output.to_csv("merged_pincode_data.csv", index=False)
print("✅ Success: merged_pincode_data.csv created with", len(output), "records")

# Optional: Summary stats
print("📊 Breakdown:")
print("  Urban:", (output['type'] == 'urban').sum())
print("  Rural:", (output['type'] == 'rural').sum())
print("  Unknown:", (output['type'] == 'unknown').sum())
print("  Missing lat/lng:", output['lat'].isna().sum())
