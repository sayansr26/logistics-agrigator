# Charges Base Engine fix — progress

Plan: `~/.claude/plans/plan-for-this-changes-purring-turtle.md`
Branch: `dev/v6`

Status key: [x] done [~] in progress [ ] not started

## Stage 1 — Write path (the actual fix)

- [x] **1.1** `ensureVersionSnapshot` in `services/chargeConfigShared.js`
  - [x] wired into `partnerChargeConfigService.updateConfig`
  - [x] wired into `chargeDefinitionService.updateDefinition`
- [x] **1.5** `services/chargeEngine/milestoneMatch.js` (new shared matcher)
  - [x] `distanceZoneService` consumes it; floor, global-max fallback pass
  - [x] `usedFallback` surfaced on both result branches
  - [x] cache key floored + real `distanceKm` restated on cache hit
- [x] **1.2** `approveSuggestion` rewrite
  - [x] `APPROVABLE_STATUSES` — retry a stuck `APPROVED` (defect E)
  - [x] `applyDefinition` — reuse instead of error (defect A)
  - [x] `applyConfig` — upsert on `{partnerId, chargeDefinitionId, channelId}` (defects B, C)
  - [x] `preflight` — resolve every id before the first write
  - [x] validation merged, not clobbered (defect D)
  - [x] result shape carries `action` / `version` / `previousVersion` / `warnings`
- [x] **1.3** `channelId` contract: Joi -> controller -> `configBrainService` -> prompt
  - [x] fail-fast channel/partner check before the model call
  - [x] `renderChannelContext` + `renderExistingDefinitions` in the prompt
- [x] **1.4** Frontend: channel `<Select>`, created-vs-replaced rendering, widened types
- [x] **1.6** `make seed-charge-definitions` + `yarn seed:charges`

## Stage 2 — Replay + encoder (defence in depth)

- [x] export `computeLine` from `services/chargeEngine/pipeline.js`
- [x] `services/ai/rateCard/replay.js`
- [x] `services/ai/rateCard/encoder.js`
- [x] prompt `v3` rate-card contract + `configBrainService` encode/replay wiring
- [x] `tests/milestoneMatch.test.js` (31 tests)
- [x] `tests/rateCardReplay.test.js` (10 tests)
- [x] `tests/rateCardEncoder.test.js` (33 tests, incl. encoder+replay end to end)

## Stage 3 — Offline audit/migration script

- [x] `scripts/migrate-charge-configs.js` (run against the prod import: 1 mispriced, 2 unverified)
- [x] Makefile targets `migrate-charge-configs{,-dry}` + `.PHONY`

## Follow-ups not yet done

- [x] Correct `docs/CHARGES_BASE_ENGINE_AI_CHANGES.md` — CORRECTIONS block added as §0
- [x] End-to-end approve check run against the live stack — results below
- [x] Seed run in **dev**: 36 created, 39 total. Root scripts `yarn seed:charges` / `seed:charges:prod` added — the root package.json exposes each partner-service script as a docker-compose exec pair, and I had only added it to the workspace package.json at first.
- [ ] **You decide:** run `yarn seed:charges:prod` (or `make seed-charge-definitions`) against production
- [ ] **Unproven:** the v3 `rateCards` prompt has never been exercised against the real model — the encoder/replay are unit-tested, but no live deepseek call has produced a `rateCards` payload yet

## Verified locally

- `yarn test` in partner-service: **104 passed** (4 suites; 71 new + 33 pre-existing engine).
- ESLint: 0 errors on every file touched (remaining warnings are pre-existing).
- `tsc --noEmit` (frontend): only pre-existing errors in `shipmentApi.ts`, which was not touched.
- `docker restart logistics-partner-service`: clean boot, 0 `MODULE_NOT_FOUND`, `/health` returns 200.
- Audit script run against the imported prod data — output below.

### What the audit found on real data

```
MISPRICED  Delhivery / B2C_BASIC_FREIGHT  (ba87b5fb…, partner-wide, v1)
  source: suggestion 02246f0f… (APPROVED, LOW confidence, 4 candidates)
  - the stored draft's config does not match the live rows — provenance is a guess
  - worked example "35 km, 2 kg -> Rs 52": config computes Rs 130
  -   ^ the Rs 130 minimum freight for milestone A is what binds; the worked
        example ignores the minimum its own rate card states
  NOT WRITABLE: provenance is LOW confidence
```

The config is **correct**; the admin's own worked example is not — it multiplies
2 kg x Rs 26 = Rs 52 while the same card states a Rs 130 minimum for Zone A.
Worth raising with them: either the example or the minimum is wrong.

### End-to-end proof (run 2026-08-27, against the live dev stack)

Three scratch suggestions, approved through the real API gateway with an admin
token. All artifacts deleted afterwards — the 3 original configs are back at
v1 and all 15 original suggestions are untouched.

| Test                                                 | Defect | Result                                                                                            |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Approve a draft that re-emits an existing definition | A      | `APPLIED`, `definitions[0].action = "REUSED"`, `errors: []` — the exact case that failed 15 times |
| Approve an identical second draft                    | B      | `action: "UPDATED"`, `v1 -> v2`, no duplicate-key collision                                       |
| Approve a row stuck in terminal `APPROVED`           | E      | `APPLIED`, `v2 -> v3` — previously unretryable                                                    |
| Channel scoping                                      | C      | config written with `channelId = e6f6af23…` from `inputContext`                                   |
| Validation persistence                               | D      | `problems` survived, `applyErrors` cleared to `[]`                                                |

The original blocker is gone: a per-channel base charge sat alongside the
partner-wide one (`Delhivery 5kg Surface` + `(partner-wide)`), with
`ChargeConfigVersion` snapshots at v1, v2 and v3 — no gaps, so nothing was
overwritten unrecoverably.

### After seeding (dev)

39 definitions total: the 36 seeded plus the 3 pre-existing AI-created ones,
which are untouched (`version 1`, `isSystem false`). `BASE_FREIGHT`, `GST`,
`FUEL_SURCHARGE` and `COD_CHARGE` are now present.

Only 4 of the 36 carry `isSystem: true` — my earlier note in the plan guessed
"33+", which was wrong; the seed marks only the core few.

**Two BASE-category definitions now coexist** — `BASE_FREIGHT` (seeded) and
`B2C_BASIC_FREIGHT` (AI-created, and what Delhivery's live config uses). No
partner has more than one BASE config, so there is no double-charging today,
and the encoder's resolution order prefers _the definition a partner's base
freight already lives on_ — so new rate cards for Delhivery keep binding to
`B2C_BASIC_FREIGHT`, while a brand-new partner gets `BASE_FREIGHT`.
Reconciling the two remains deliberately out of scope.
