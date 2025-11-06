"""
Simple Pincode Data Merger
Processes IN.txt directly without requiring All_India_Pincode_directory.csv
"""
import pandas as pd
import csv

print("📌 Starting pincode data processing...")

# Load GeoNames IN.txt
print("📂 Loading IN.txt data...")
geonames_data = []
processed_count = 0
error_count = 0

with open("IN.txt", "r", encoding="utf-8") as f:
    reader = csv.reader(f, delimiter='\t')
    for row in reader:
        try:
            processed_count += 1
            if processed_count % 1000 == 0:
                print(f"   Processed {processed_count} records...")

            geonames_data.append({
                "pincode": int(row[1]),
                "area": row[2],
                "lat": float(row[9]) if row[9] else None,
                "lng": float(row[10]) if row[10] else None,
                "district": row[5] if len(row) > 5 else "",
                "state": row[3] if len(row) > 3 else "",
                "type": "unknown"  # We don't have office type data
            })
        except (ValueError, IndexError) as e:
            error_count += 1
            pass  # skip bad rows

print(f"✅ Loaded {len(geonames_data)} records (errors: {error_count})")

# Convert to DataFrame
df = pd.DataFrame(geonames_data)

# Remove duplicates based on pincode
print("🔄 Removing duplicate pincodes...")
before_dedup = len(df)
df = df.drop_duplicates(subset=['pincode'], keep='first')
after_dedup = len(df)
print(f"   Removed {before_dedup - after_dedup} duplicates")

# Sort by pincode
df = df.sort_values('pincode')

# Save to CSV
output_file = "merged_pincode_data.csv"
df.to_csv(output_file, index=False)
print(f"\n✅ Success: {output_file} created with {len(df)} records")

# Summary stats
print("\n📊 Breakdown:")
print(f"  Total Pincodes: {len(df)}")
print(f"  With lat/lng: {df['lat'].notna().sum()}")
print(f"  Missing lat/lng: {df['lat'].isna().sum()}")
print(f"  Unique States: {df['state'].nunique()}")
print(f"  Unique Districts: {df['district'].nunique()}")
print(f"  Unique Areas: {df['area'].nunique()}")

# Show sample
print("\n📍 Sample Records:")
print(df.head(5)[['pincode', 'area', 'district', 'state', 'lat', 'lng']].to_string())
