# Charges Base Engine — AI Config Drafting: Root Cause & Change Plan

> Status: SUPERSEDED IN PART — implemented 2026-08-27, and the headline
> diagnosis below was disproved while implementing it. See the CORRECTIONS
> block immediately after this header, and `docs/CHARGES_FIX_PROGRESS.md`.
> Scope: partner-service Charges Engine v3, AI config drafting path
> Trigger: base charges for a multi-channel partner either failed to create, or
> were created with wrong numbers.
> Last updated: 2026-08-27

---

## 0. CORRECTIONS (added 2026-08-27, after checking the stored data)

This document's central claim — that the AI misread the rate card — is **not
supported by the `AiChargeSuggestion` rows**. Four corrections:

1. **§4 is wrong. The model's output was correct.** Suggestion `02246f0f-…`
   produced exactly `1/26/130, 1/32/160, 1/38/180, 1/46/220` against the right
   milestone UUIDs, with accurate warnings. It failed to _write_, with the
   stored error:
   `{"applyErrors": ["definition B2C_BASIC_FREIGHT: Charge definition code already exists: B2C_BASIC_FREIGHT"]}`
   The earlier `0.5 / 26 / 26` config was a faithful encoding: the 2026-08-25
   prompt genuinely said "Billing Unit: 0.5 Kg" and "Rate: ₹26 per 0.5 Kg", with
   no minimum freight anywhere. The prompt-trap theory (contaminated few-shot,
   the Rs-26 collision) is not evidenced.

2. **§5 undercounts the write-path defects, and misses the worst one.** Beyond
   the create-only path and the missing `channelId`, a suggestion that fails to
   apply becomes terminal `APPROVED` and **can never be retried** — which is why
   there are 15 suggestions and 8 `REJECTED` ones. Also, `createDefinition`
   erroring on an existing code directly contradicts `validateDraft:95-99`,
   which tells the model to reuse.

3. **§8.1 is wrong, and the truth is worse.** A milestone no-match does _not_
   drop the partner. `distanceZoneService.js:588-600` falls back to the
   highest-`maxKm` milestone, so a 50.5 km shipment was billed the 1401-3200 km
   rate — a silent **overcharge**. Item 0.2 (raise D's `maxKm`) was therefore
   unnecessary and has been dropped; the fix is to floor the distance before
   matching. The dry-run sample in §10 also miscomputes the second example:
   `ceil(8/0.5) x 32` is **512**, not 416.

4. **§8.2 resolves to the worse branch.** The catalog holds only 3 definitions —
   all AI-created, all `isSystem: false`. The 36-definition seed has never run in
   prod, so `BASE_FREIGHT` was never in the `existingDefinitions` list the model
   was shown. It did not ignore an instruction; the code did not exist.

Also note **item 7 was already done** before this work started: `results.errors`
has always rendered at `charge-configs/page.tsx:317-328`.

---

## 1. Summary

Two separate failures were reported as one:

1. **The AI produced a wrong rate card.** `perKg: 0.5` instead of `1`, and
   `minCharge` set to the per-kg rate (26/32/38/46) instead of the admin's
   minimum freight (130/160/180/220). Cause: a contaminated few-shot example in
   the prompt. **Fixed in prod on 2026-08-26; root cause NOT fixed.**
2. **A second channel's base charge could not be created at all.** Cause: the AI
   path has no concept of a channel, so every draft lands as `channelId: null`
   and collides with the existing partner-wide config on the unique key.

The pricing engine itself is correct and was never at fault.

---

## 2. Production reference data

Everything below is real prod data, kept here so work can resume without
re-querying.

### Partner

```
id            cmt89dm2b0000irvqezjx5q4x
name          Delhivery   (code DEL735)
channelMode   MULTI
chargeConfigs 3
shipments     1
```

### Credential channels — `PartnerChannelConfig` (apiKey / aggregator / volumetric)

| id                                     | channelName            | aggregator client          | volumetric |
| -------------------------------------- | ---------------------- | -------------------------- | ---------- |
| `98e6a68c-5d54-486d-a3a5-f59327d154d0` | DelhiveryL 0.5 Surface | LOGIMARTTECHNOLOGIEDLTDB2C | 5000 / 1   |
| `0f042f54-8073-466a-b639-e85e31ac3b57` | Delhivery 5kg Surface  | STARTUPFRANCHISE           | 5000 / 1   |

### Service channels — `PartnerServiceChannel` (weight-slab shipping products)

**These are the ids `PartnerChargeConfig.channelId` points at.**

| id                                     | channelName           | accountRef                 | business | weight   | order amount    |
| -------------------------------------- | --------------------- | -------------------------- | -------- | -------- | --------------- |
| `dd4c1a43-1e21-4deb-8e2c-9d4e44ded4c6` | Delhivery0.5 Surface  | LOGIMARTTECHNOLOGIEDLTDB2C | B2C      | 0.5-5 kg | Rs 1-5,000      |
| `e6f6af23-302d-48d4-826e-c1a204f476ee` | Delhivery 5kg Surface | STARTUPFRANCHISE           | B2C      | 5-10 kg  | Rs 1,000-10,000 |

### Zone — DISTANCE, `234fd3f7-266e-4fb4-93a0-b435b7bc06a0` ("Delhivery B2C")

| suffix | range        | zoneMilestoneId                        |
| ------ | ------------ | -------------------------------------- |
| A      | 0-50 km      | `5d0f2350-fc39-4e8a-a94f-2acc9bd755b3` |
| B      | 51-500 km    | `c77b004a-5480-4536-80e2-a5776590ab5f` |
| C      | 501-1400 km  | `df4d3dc2-3724-45b9-9902-77f41d767ed6` |
| D      | 1401-3200 km | `e45396eb-0c19-401c-82d6-d879ee32e5a5` |

### Charge configs (all 3, as of 2026-08-26 10:23)

| id                                     | definition                               | channelId | notes                                     |
| -------------------------------------- | ---------------------------------------- | --------- | ----------------------------------------- |
| `ba87b5fb-47f9-43f5-a4c2-6367c89e9bdc` | `B2C_BASIC_FREIGHT` (`be5463b3-…`)       | null      | MATRIX MILESTONE, **corrected**           |
| `5faef1d5-dda0-41a8-a854-3871526631df` | `INSURANCE_CHARGE` (`92a73d69-…`)        | null      | PERCENT_WITH_MIN, optionsBy insuranceType |
| `16c18455-6607-4bc7-9525-e236f8714f98` | `FRAGILE_HANDLING_CHARGE` (`00afd3b7-…`) | null      | FLAT 75, gated on isFragile               |

---

## 3. The two "channel" concepts (source of much confusion)

|                | `PartnerChannelConfig`                               | `PartnerServiceChannel`                                 |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| What it is     | API credentials / environment                        | Weight-slab shipping product                            |
| Fields         | apiKey, aggregatorType, volumetricDivisor, isPrimary | minWeight/maxWeight, businessType, accountRef, priority |
| Managed by     | `partnerChannelService`                              | `carrierAccountService`                                 |
| API            | `/api/v1/partners/:id/channels`                      | `/api/v1/partners/:id/carrier-accounts`                 |
| Charge scoping | **NO**                                               | **YES** — `PartnerChargeConfig.channelId` FK            |

`PartnerServiceChannel.channelConfigId` optionally links a service channel to a
credential channel to reuse its API key and volumetric formula.

Renaming these (Credentials vs Rate Card) is deferred item 9.

---

## 4. Root cause — wrong rate card

### 4.1 The epicentre: `services/ai/prompts/chargeConfigPrompts.js:45`

```
- Row maths is: max(minCharge, ceil(chargeableWeight / perKg) x charge). So "perKg" is the
  SLAB SIZE IN KG, not a rate: "Rs 26 for up to 52 kg" is { "perKg": 52, "charge": 26,
  "minCharge": 26 }, and "Rs 52 per kg with Rs 26 minimum" is { "perKg": 1, "charge": 52,
  "minCharge": 26 }.
```

Three compounding defects in this single line:

1. **Both worked examples set `minCharge` to the rate, never to an independent
   floor.** Example 1 has `minCharge == charge` (26 == 26). Across every
   demonstration in the prompt, `minCharge` tracks the per-slab rate. The model
   has never seen a case like ours where the floor (Rs 130) is 5x the rate
   (Rs 26). Output was `26/26, 32/32, 38/38, 46/46` — example 1's shape copied.

2. **The exemplar constant collides with real input.** The prompt's example rate
   is literally Rs 26; Zone A's rate is literally Rs 26. The model matched on the
   identical number and carried `minCharge: 26` straight through, then
   generalised `minCharge = charge` to the other three rows.

3. **The phrase "Minimum Freight" appears nowhere in the prompt.** At line 34
   the field is declared `"minCharge"?: number` — optional, no semantics. The
   seeded `BASE_FREIGHT` description says only "minCharge". Nothing maps the
   admin's "Minimum Freight: Rs 130" onto that field.

### 4.2 Why `perKg: 0.5`

The admin input said "Billing Unit: 1 Kg" and `CEILING(Chargeable Weight / 1 Kg)`.
Both point at `perKg: 1`. The prompt never states that the admin's "Billing Unit"
maps to `perKg`, so the model inferred the slab size from prose in the channel
name ("Delhivery**0.5** Surface") instead of the explicit line.

### 4.3 Why "channel" became a new definition

The admin input opened with _"Create a rate card channel named 'Delhivery 5Kg
Surface'"_. The response contract has no `channelId` field and no channel list,
so the model expressed "channel" the only way the schema allowed — by minting a
new definition, `B2C_BASIC_FREIGHT`.

That code exists in **no source file** (`prisma/seeds/chargeDefinitions.seed.js`
seeds `BASE_FREIGHT` only), confirming it is AI-created — in direct violation of
prompt line 47 which says to use `BASE_FREIGHT` and _"do not create a new
definition per zone."_

### 4.4 Why validation did not catch it

`services/chargeConfigShared.js:203-220` range-checks only:

- `perKg` is a positive number
- `charge` is a positive number
- `minCharge` is a non-negative number

`0.5 / 26 / 26` passes all three. The suggestion reached PENDING with **zero**
validation problems, so it looked correct and approvable.

The deeper miss: the admin input carried **four worked examples with expected
outputs**. Nothing in the pipeline extracts or replays them.

### 4.5 Contributing factor

`shared/lib/aiClient.js:126-129` — `deepseek-chat` at `temperature: 0.1`. The
misreading is **reproducible, not a fluke**; re-running the same prompt produces
the same wrong rows.

---

## 5. Root cause — multi-channel creation failure

`channelId` is dropped at every layer of the AI write path:

| Layer        | File:line                                            | What happens                                                      |
| ------------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| API contract | `validation/aiChargeSchemas.js:11-14`                | Joi body accepts only `description`, `partnerId`                  |
| Controller   | `controllers/aiChargeController.js:27`               | destructures only `{ description, partnerId }`                    |
| Service      | `services/ai/configBrainService.js:179-189`          | context built from `partnerId` only                               |
| Prompt       | `services/ai/prompts/chargeConfigPrompts.js:100-109` | response schema has no `channelId`; no CHANNEL CONTEXT block      |
| Apply        | `services/ai/aiSuggestionService.js:191`             | `channelId: cfg.channelId \|\| null` — never emitted, always null |
| Frontend     | `frontend/src/app/charge-configs/page.tsx:540-543`   | sends `{ description, partnerId }` only                           |

Failure sequence:

1. First channel's base charge → created as partner-wide (`channelId: null`).
2. Second channel → `createConfig` hits the guard at
   `partnerChargeConfigService.js:118-124`:
   `A config for definition B2C_BASIC_FREIGHT already exists for this partner/channel`
3. `aiSuggestionService.js:203-207` **catches it into `results.errors`**, marks
   the suggestion `APPROVED` (not `APPLIED`), and the UI
   (`page.tsx:552-563`) renders it as success.

Net effect: nothing created, no error shown.

### Related gap

`approveSuggestion` only ever calls `createConfig`, never `updateConfig`. So
**re-drafting any rate card for an existing definition fails the same silent
way**, even for a single-channel partner.

---

## 6. What already works — do not rebuild

| Layer                    | File:line                                                                     | Status                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| MATRIX maths             | `chargeEngine/calculators.js:116-159`                                         | Correct: `max(minCharge, ceil(w/perKg) x charge)`                       |
| Per-channel storage      | `schema.prisma:601,622,625`                                                   | `channelId` FK + `@@unique([partnerId, chargeDefinitionId, channelId])` |
| Manual create API        | `validation/partnerChargeConfigSchemas.js:20`                                 | `channelId: uuid.allow(null)` accepted                                  |
| Channel FK check         | `partnerChargeConfigService.js:58-65`                                         | Verifies channel belongs to the partner                                 |
| Override precedence      | `partnerChargeConfigService.js:337-343`                                       | Channel-specific wins over partner-wide, per definition                 |
| Channel routing          | `carrierAccountService.js:92-163`                                             | Weight/amount/payment/business-type slab matching                       |
| Quote wiring             | `quoteService.js:610,671`                                                     | `matchedChannel.id` passed to `getActiveConfigsForPartner`              |
| Missing-base safety      | `pipeline.js:319-330` + `quoteService.js:731-747`                             | Partner is dropped from the quote, never priced without freight         |
| Volumetric per channel   | `weightCalc.js:43-49` + `quoteService.js:614-616`                             | Resolves 5000/1 from the linked credential channel                      |
| Dry-run script precedent | `Makefile:657-661` + `shipment-service/scripts/migrate-shipment-ownership.js` | `--apply` flag, dry-run default, audit-logged                           |

**The per-channel mechanism is fully built.** Only the two human-facing ways to
reach it are missing: the AI path and the frontend.

---

## 7. Fixes already applied

### 7.1 Base freight repriced (done 2026-08-26 08:12)

Config `64b3b832-…` (wrong) was replaced by `ba87b5fb-…` (correct):

| milestone      | before (perKg/charge/min) | after            |
| -------------- | ------------------------- | ---------------- |
| A 0-50 km      | 0.5 / 26 / 26             | **1 / 26 / 130** |
| B 51-500 km    | 0.5 / 32 / 32             | **1 / 32 / 160** |
| C 501-1400 km  | 0.5 / 38 / 38             | **1 / 38 / 180** |
| D 1401-3200 km | 0.5 / 46 / 46             | **1 / 46 / 220** |

Verified by replaying the admin's four worked examples through the engine
formula:

```
30km   3kg   A  expected 130   got 130   PASS
350km  8kg   B  expected 256   got 256   PASS
900km  4kg   C  expected 180   got 180   PASS
1800km 10kg  D  expected 460   got 460   PASS
```

Note: the config was **recreated** (`version: 1`, new id), not updated, so no
`ChargeConfigVersion` snapshot records the old wrong rows.

### 7.2 Not yet fixed

Root cause of the misreading is untouched. Re-running the same prompt today
still produces `perKg: 0.5` / `minCharge: 26`.

---

## 8. Open issues found during investigation

### 8.1 Milestone coverage gaps — partner silently drops off quotes

`services/distanceZoneService.js:574` matches inclusively on both bounds:

```js
if (distanceKm >= milestone.minKm && distanceKm <= milestone.maxKm)
```

With integer boundaries `0-50 / 51-500 / 501-1400 / 1401-3200`, fractional road
distances fall into four dead bands where no milestone matches:

| Gap                  | Impact                                           |
| -------------------- | ------------------------------------------------ |
| 50.01 – 50.99 km     | no milestone                                     |
| 500.01 – 500.99 km   | no milestone                                     |
| 1400.01 – 1400.99 km | no milestone                                     |
| **above 3200 km**    | no milestone — real Indian lanes reach ~3,700 km |

**Fails safely**, not silently: `pipeline.js:319-330` flags the unpriced BASE
charge and `quoteService.js:731-747` drops the partner with
`"Base charge not configured for this lane (B2C_BASIC_FREIGHT)"`. No free
shipping — but Delhivery vanishes from the quote list, which reads as a
serviceability bug.

- Quick data fix: raise milestone D `maxKm` to 99999.
- Proper fix: half-open intervals `[min, max)` or round `distanceKm` before
  matching, in `distanceZoneService.js:574`.

### 8.2 `BASE_FREIGHT` vs `B2C_BASIC_FREIGHT` — UNRESOLVED

Only one BASE-category config exists, so there is **no double-charging today**.
But it is still unknown whether `BASE_FREIGHT` exists in the prod catalog:

```bash
curl -s "http://localhost:3001/api/v1/charge-definitions?limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.definitions[] | select(.category=="BASE") | {code, name, phase, isSystem}'
```

- If `BASE_FREIGHT` is **present**: the model ignored a direct instruction — a
  model-capability problem a prompt tweak alone may not fix.
- If **absent**: the seed never ran in prod, prompt line 47 names a code that was
  never in the injected `existingDefinitions` list, and `GST` /
  `FUEL_SURCHARGE` / `COD_CHARGE` and the rest of the `isSystem` core are
  **also missing** — a far larger finding than the rate card.

### 8.3 Unactionable input fields

The admin's prompt included "Volumetric Formula: LBH / 5000". That lives on
`PartnerChannelConfig` (`schema.prisma:86`), not in any `ChargeDefinition`
computation. The model has no field for it and no instruction to warn, so the
line is silently ignored.

---

## 9. The design shift

Today the model does **two jobs**:

1. Understand the rate card (rates, floors, distance bands) — genuinely AI work.
2. Encode it into internal JSON with UUID references and trap-named fields —
   pure mechanical mapping.

Every observed failure came from job 2. **Job 2 is deterministic and belongs in
code.**

### Proposed AI output — no UUIDs, no internal field names

```json
{
  "chargeName": "B2C Basic Freight",
  "channel": "Delhivery 5Kg Surface",
  "billingUnitKg": 1,
  "bands": [
    {
      "zone": "A",
      "fromKm": 0,
      "toKm": 50,
      "ratePerUnit": 26,
      "minFreight": 130
    },
    {
      "zone": "B",
      "fromKm": 51,
      "toKm": 500,
      "ratePerUnit": 32,
      "minFreight": 160
    },
    {
      "zone": "C",
      "fromKm": 501,
      "toKm": 1400,
      "ratePerUnit": 38,
      "minFreight": 180
    },
    {
      "zone": "D",
      "fromKm": 1401,
      "toKm": null,
      "ratePerUnit": 46,
      "minFreight": 220
    }
  ],
  "examples": [
    { "distanceKm": 30, "weightKg": 3, "expectedFreight": 130 },
    { "distanceKm": 350, "weightKg": 8, "expectedFreight": 256 },
    { "distanceKm": 900, "weightKg": 4, "expectedFreight": 180 },
    { "distanceKm": 1800, "weightKg": 10, "expectedFreight": 460 }
  ]
}
```

A near-verbatim transcription of what the admin typed. **Code** then does the
rest: match `fromKm`/`toKm` to the partner's milestones and fill in real UUIDs,
match `channel` to a `PartnerServiceChannel` by name, set
`perKg = billingUnitKg`, `charge = ratePerUnit`, `minCharge = minFreight`.

The model can no longer invent a UUID, pick the wrong MATRIX mode, mint a
duplicate definition, or misread `perKg` — it never sees any of them.

Side benefit: the prompt shrinks from ~60 lines of DSL contract to roughly
"read this rate card into this shape". A cheaper/weaker model becomes reliable
and `temperature: 0.1` stops mattering.

---

## 10. Change plan

### Phase 0 — immediate, independent

| #   | Task                                                          | Status                  |
| --- | ------------------------------------------------------------- | ----------------------- |
| 0.1 | Reprice `B2C_BASIC_FREIGHT` rows                              | **DONE** (2026-08-26)   |
| 0.2 | Raise milestone D `maxKm` to 99999 (closes the >3200 km hole) | Not started — one field |

### Phase 1 — two pure modules (no wiring, no AI, unit-testable)

| #   | Task                                                                                                                                                                                                                                         | Effort | Kills                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| 1   | **Encoder module** — rate-card text/JSON to MATRIX rows with real `zoneMilestoneId` UUIDs. Maps "Billing Unit" to `perKg`, "Rate" to `charge`, "Minimum Freight" to `minCharge`, `fromKm`/`toKm` to the partner's milestones. Deterministic. | M      | `perKg: 0.5`, invented UUIDs, wrong mode, duplicate definitions |
| 2   | **Replay module** — `(config, {distanceKm, weightKg})` to engine to expected-vs-actual. Reuses `calculators.js:116-159` unchanged.                                                                                                           | S      | All silent mispricing, permanently                              |

Neither module touches a live path.

### Phase 2 — migration, offline, dry-run first

| #   | Task                                                                                                                                                     | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 3   | `backend/partner-service/scripts/migrate-charge-configs.js` — clone of `migrate-shipment-ownership.js` (dry-run default, `--apply` writes, audit-logged) | M      |
| 4   | Makefile targets                                                                                                                                         | XS     |

**What makes automated migration possible:** `AiChargeSuggestion.inputContext`
(`schema.prisma:650`) stores `{ description, partnerId, promptVersion }` —
**the original admin rate-card text is in the database**, including the minimum
freights, the channel name, and the worked examples.

Makefile targets, following the precedent at `Makefile:657-661`:

```makefile
migrate-charge-configs-dry:
	$(COMPOSE_PROD) exec -T partner-service node backend/partner-service/scripts/migrate-charge-configs.js

migrate-charge-configs:
	$(COMPOSE_PROD) exec -T partner-service node backend/partner-service/scripts/migrate-charge-configs.js --apply
```

> NOTE: two targets, **not** `make migrate-charge-configs --dry`. GNU make parses
> `--dry` as its own flag, and `-n` is make's built-in dry run.

Dry-run output shape:

```
Charge config migration — DRY RUN

Partner: Delhivery (cmt89dm2b0000irvqezjx5q4x)

  MISPRICED  B2C_BASIC_FREIGHT  ba87b5fb-…
     source: AiChargeSuggestion a1b2… (2026-08-25 09:01)
     channel: (none) -> "Delhivery0.5 Surface" (dd4c1a43…)

     rows                        current              proposed
       milestone A (0-50km)      0.5 / 26 / 26        1 / 26 / 130
       milestone B (51-500km)    0.5 / 32 / 32        1 / 32 / 160
       milestone C (501-1400km)  0.5 / 38 / 38        1 / 38 / 180
       milestone D (1401-3200km) 0.5 / 46 / 46        1 / 46 / 220
                                 (slabKg/charge/min)

     replaying the 4 examples from the original prompt:
       30km   3kg   expected 130   current 156  FAIL   proposed 130  PASS
       350km  8kg   expected 256   current 416  FAIL   proposed 256  PASS
       900km  4kg   expected 180   current 304  FAIL   proposed 180  PASS
       1800km 10kg  expected 460   current 920  FAIL   proposed 460  PASS

  OK          FRAGILE_HANDLING_CHARGE  16c18455…   (FLAT 75, no examples to replay)
  UNVERIFIED  INSURANCE_CHARGE         5faef1d5…   (no source prompt stored)

Summary: 1 mispriced, 1 ok, 1 unverified.
Dry run only — re-run with --apply to write changes.
```

Three honest buckets. **UNVERIFIED** matters: manually-created configs have no
stored prompt and no examples. The script must say "cannot verify" rather than
guess a minimum freight that is not written down anywhere.

**Side effect that unblocks multi-channel:** migrating a config from
`channelId: null` onto its rightful channel frees the unique key
`[partnerId, chargeDefinitionId, channelId]`, so a second channel's base charge
no longer collides.

### Phase 3 — wire into the live AI path

| #   | Task                                                                                                                                                                   | Effort | Kills                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| 5   | Prompt returns the plain rate card of section 9; Phase 1 encoder does the encoding                                                                                     | M      | The prompt-trap class entirely                  |
| 6   | Channel binding (match `channel` name to `PartnerServiceChannel.channelName` to `channelId`) + **upsert** in `approveSuggestion` with a `ChargeConfigVersion` snapshot | S      | Multi-channel blocker, re-draft blocker         |
| 7   | Surface `results.errors` in the draft UI (`page.tsx:552-563` already receives them and ignores them)                                                                   | XS     | The silent "nothing happened"                   |
| 8   | Frontend channel selector on the charge-configs page (the word "channel" does not currently appear in that file)                                                       | S      | Admins being unable to reach `channelId` at all |

### Deferred — quality-of-life, not fixes

| #   | Task                                                                              | Why deferred                                                                                                                                                |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Rename `perKg` to `slabSizeKg`, `minCharge` to `minFreight` in stored config JSON | Needs a backfill of every stored config plus a dual-read window. After Phase 3 no model reads those names — only code does, and code does not misread them. |
| 10  | Rename the two channel concepts (Credentials vs Rate Card) in UI + code           | Reduces human confusion only; no functional gain.                                                                                                           |

---

## 11. Options considered and rejected

Recorded so they are not re-litigated.

| Option                                                                               | Verdict                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Just fix the prompt wording (better `minCharge` example, rename the trap)            | **Insufficient alone.** Reduces but does not eliminate the failure class; the model still handles UUIDs, MATRIX modes and definition reuse. Superseded by Phase 3 item 5.                                                                 |
| Keep create-only and just surface the duplicate error; admin deletes and re-approves | **Rejected as the primary fix** (kept as the minimal fallback). Leaves the admin doing manual cleanup on every re-draft.                                                                                                                  |
| Conflict UI — flag "a config already exists", offer Replace/Skip per item            | **Viable alternative to upsert.** Safer, but needs frontend work before anything is unblocked. Revisit if silent overwrite proves risky.                                                                                                  |
| Model infers the channel from prompt text via a CHANNEL CONTEXT block                | **Weaker than an explicit selector.** No UI change needed, but the model can pick the wrong channel on near-identical names like "Delhivery0.5 Surface" vs "Delhivery 5kg Surface". Acceptable as a fallback when no channel is selected. |
| Drop the AI entirely; use a plain rate-card grid form                                | **Partly adopted.** Phase 3 keeps the AI as a _parser into a visible structure_, not an author of hidden JSON. A pure form would work but loses the paste-a-rate-card convenience.                                                        |
| Do the field rename (item 9) first, since it is the root of the naming trap          | **Rejected as first step.** Highest blast radius of anything on the list (migrates live pricing data) and Phase 3 makes it unnecessary.                                                                                                   |
| Add per-channel base charges manually via curl and skip the plan                     | **Rejected by the team.** The API supports it today (see 12.1), but it does not scale and leaves the AI path broken.                                                                                                                      |

---

## 12. Reference — what can be done today without any code change

### 12.1 Create a per-channel base charge manually

The manual API already accepts `channelId` and validates it against
`PartnerServiceChannel`:

```bash
curl -X POST http://localhost:3001/api/v1/charge-configs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": "cmt89dm2b0000irvqezjx5q4x",
    "channelId": "e6f6af23-302d-48d4-826e-c1a204f476ee",
    "chargeDefinitionId": "be5463b3-ee59-48e2-8e4b-468389cf97e0",
    "config": {
      "mode": "MILESTONE",
      "rows": [
        {"zoneMilestoneId":"5d0f2350-fc39-4e8a-a94f-2acc9bd755b3","perKg":1,"charge":26,"minCharge":130},
        {"zoneMilestoneId":"c77b004a-5480-4536-80e2-a5776590ab5f","perKg":1,"charge":32,"minCharge":160},
        {"zoneMilestoneId":"df4d3dc2-3724-45b9-9902-77f41d767ed6","perKg":1,"charge":38,"minCharge":180},
        {"zoneMilestoneId":"e45396eb-0c19-401c-82d6-d879ee32e5a5","perKg":1,"charge":46,"minCharge":220}
      ]
    }
  }'
```

`channelId` must be a **`PartnerServiceChannel`** id, not a credential-channel id.

> **Caveat:** if every channel gets its own card and no partner-wide fallback
> remains, a shipment matching no channel has no base freight and the partner is
> dropped from the quote. The current slabs (0.5-5 kg / Rs 1-5,000 and
> 5-10 kg / Rs 1,000-10,000) leave real gaps — e.g. a 6 kg order worth Rs 500
> matches neither. Keeping one partner-wide card as the fallback avoids this.

### 12.2 Useful queries

```bash
# Service channels (the ids charge configs bind to)
curl -s "http://localhost:3001/api/v1/partners/cmt89dm2b0000irvqezjx5q4x/carrier-accounts" \
  -H "Authorization: Bearer $TOKEN" | jq .

# All charge configs for a partner (no isActive filter unless passed explicitly)
curl -s "http://localhost:3001/api/v1/charge-configs?partnerId=cmt89dm2b0000irvqezjx5q4x&limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.configs[] | {id, channelId, code: .chargeDefinition.code}'

# Zones + milestones
curl -s "http://localhost:3001/api/v1/zones?partnerId=cmt89dm2b0000irvqezjx5q4x" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 13. Blast radius

| Phase | Risk                                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | One deliberate config write (done) + one zone field.                                                                                                                                                                                   |
| 1     | **Zero.** New modules, not wired to anything. Worst case they fail their own tests.                                                                                                                                                    |
| 2     | **Zero until `--apply`.** Dry run is read-only. `--apply` writes only what was reviewed, audit-logged, with version snapshots.                                                                                                         |
| 3     | AI drafting path only. Engine, manual config API, and existing configs untouched. The one behaviour change is upsert-may-overwrite (item 6) — needs a `ChargeConfigVersion` snapshot and ideally a "this will replace X" confirmation. |
| 9-10  | Real migration risk. Deferred.                                                                                                                                                                                                         |

No schema migration is required anywhere before item 9.

---

## 14. Key file map

| Concern                           | Path                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| AI prompts (the defect)           | `backend/partner-service/services/ai/prompts/chargeConfigPrompts.js` |
| AI drafting service               | `backend/partner-service/services/ai/configBrainService.js`          |
| AI suggestion approval            | `backend/partner-service/services/ai/aiSuggestionService.js`         |
| AI request validation             | `backend/partner-service/validation/aiChargeSchemas.js`              |
| AI controller                     | `backend/partner-service/controllers/aiChargeController.js`          |
| AI client (model/temperature)     | `shared/lib/aiClient.js`                                             |
| MATRIX maths                      | `backend/partner-service/services/chargeEngine/calculators.js`       |
| Pipeline / missing-base detection | `backend/partner-service/services/chargeEngine/pipeline.js`          |
| Config CRUD + override precedence | `backend/partner-service/services/partnerChargeConfigService.js`     |
| Structural validation             | `backend/partner-service/services/chargeConfigShared.js`             |
| Channel selection                 | `backend/partner-service/services/carrierAccountService.js`          |
| Distance to milestone matching    | `backend/partner-service/services/distanceZoneService.js`            |
| Quote orchestration               | `backend/partner-service/services/quoteService.js`                   |
| Definition seed                   | `backend/partner-service/prisma/seeds/chargeDefinitions.seed.js`     |
| Frontend charge configs page      | `frontend/src/app/charge-configs/page.tsx`                           |
| Dry-run script precedent          | `backend/shipment-service/scripts/migrate-shipment-ownership.js`     |
| Makefile precedent                | `Makefile:657-661`                                                   |
