# Extending Pincode Coverage

`merged_pincode_data.csv` is built from `india_post_raw.csv` (data.gov.in India Post
directory) left-joined with GeoNames `IN.txt` for coordinates. That source carries
**19,238 unique pincodes**. Any pincode India Post has not published — newly allotted
PINs, or codes couriers/sellers use that never made the directory — will be absent
from the DB no matter how many times `make import-pincodes` runs.

To add those, hand-maintain `extra_pincode_data.csv` in this directory using the
column layout below (see `extra_pincode_data.SAMPLE.csv` / `.SAMPLE.json`).

## Columns

| Field      | Type                       | Required    | Maps to                     | Notes                                                                                                     |
| ---------- | -------------------------- | ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pincode`  | string, exactly 6 digits   | Yes         | `pincodes.code` (`@unique`) | Keep leading zeros — quote it in JSON / format as Text in Excel                                           |
| `area`     | string                     | Yes         | `Area.name` (auto-created)  | Row is silently dropped if blank                                                                          |
| `district` | string                     | Yes         | `City.name` (auto-created)  | Row is silently dropped if blank                                                                          |
| `state`    | string                     | Yes         | `State.name` (auto-created) | Must match `STATE_CANONICAL` in `scripts/build-merged-pincodes.js`, else a duplicate state row is created |
| `lat`      | decimal(10,8)              | Recommended | `pincodes.latitude`         | Without it `geographicalDistanceService` cannot compute distance-based zones/rates for this PIN           |
| `lng`      | decimal(11,8)              | Recommended | `pincodes.longitude`        | Same                                                                                                      |
| `type`     | string (`S.O`/`B.O`/`H.O`) | Optional    | —                           | Currently ignored by the importer; collected for future use                                               |

`odaApplicable`, `hillApplicable` and `status` are DB defaults — do not put them in
this file.

## File rules

- UTF-8, no BOM
- `,` delimiter; quote any value that contains a comma
- Header row exactly: `pincode,area,lat,lng,district,state,type`
- Leave `lat`/`lng` **blank** when unknown — never `0` (0,0 is a valid coordinate off
  the coast of Africa and will produce nonsense distances)

## Importer behaviour worth knowing

- `pincodes.code` is `@unique` and the importer uses
  `createMany({ skipDuplicates: true })`, so **one row per pincode wins** even though
  the merged CSV carries one row per post office. List a pincode once here.
- Rows missing area/district/state are counted in the error total without an
  individual log line.

## Workflow

Locally:

```bash
# edit data/extra_pincode_data.csv
yarn build:pincodes          # regenerates merged_pincode_data.csv
# commit data/extra_pincode_data.csv + data/merged_pincode_data.csv
make release-prod
```

On the server:

```bash
make deploy
make import-pincodes
make classify-cities         # required: new districts land without cityClass/isMetro
```

## Not yet wired

`scripts/build-merged-pincodes.js` does not read `extra_pincode_data.csv` yet. It
needs an append pass after the India Post loop, with the extra file winning on
pincode conflict.

## Unrelated

`frontend/src/components/partners/pincode-import.tsx` imports _partner serviceability
assignments_, not master pincodes. Different format, different table.
