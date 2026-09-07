# AI charge drafting — progress

Plan: `~/.claude/plans/plan-for-this-changes-purring-turtle.md`
Branch: `dev/v6`

Status key: [x] done [~] in progress [ ] not started

## Stage 1 — Make the invisible visible ✅ code complete

- [x] `configBrainService.collectUnsupported()` — lifts `rateCard.notes` and any
      v4-style explicit refusals into one `draft.unsupported` list, and logs the count
- [x] `tests/unsupportedCollection.test.js` (8 tests)
- [x] Frontend types widened — `AiRateCard`, `AiReplayResult`, `AiUnsupportedItem`,
      and `rateCards` / `encoderWarnings` / `replay` / `unsupported` on `AiSuggestionPayload`
      (the payload type previously had no `rateCards` key at all)
- [x] Draft UI now renders, in this order:
      **"Not applied from your prompt"** (amber, above the config preview) ·
      the rate card as read from the prompt · worked examples re-priced by the engine ·
      encoder warnings — **none of these were displayed before**
- [x] Rewrote the "Base freight" prompt template, which still taught the v2 contract
      ("use mode MILESTONE ... keyed by the zoneMilestoneId values") and therefore
      contradicted the v3 rule that base freight must go in `rateCards`. Clicking it
      produced a config that bypassed both the encoder and the replay check.

## Stage 2 — Per-method config validation ✅ module done, ⛔ enforcement gated

- [x] `services/chargeConfigMethods.js` — `validateConfigForMethod(computation, config)`
      covering all 9 methods, each mirroring its calculator so a config that validates
      cannot price to `null` for a configuration reason
- [x] `tests/chargeConfigMethods.test.js` (41 tests) — every valid case asserts both
      "validates" **and** "actually prices" via the real `calculators.compute`
- [x] Wired into `validateAllConfigs()` — **report only**
- [x] `scripts/validate-charge-configs.js` + `yarn validate:charges` (dev),
      `yarn validate:charges:prod`, and `make validate-charge-configs` — following the
      existing script/Makefile pattern rather than a raw `docker exec node -e` one-liner
- [ ] **GATED:** wiring into `assertConfigRefs` (the throwing path). Run the sweep and
      review what it flags before enforcing on writes.

## Stage 3 — Action layer ✅ code complete

- [x] Prompt **v4**: `actions[]` + `unsupported[]` + a capability manifest naming the
      three action types and, explicitly, what to do when an ask fits none of them
      ("NEVER silently drop it")
- [x] `services/ai/actions/compile.js` — compiles actions down to the same
      `{definitions, configs}` the approval path already applies, so
      **`approveSuggestion` needed no rewrite** and its preflight/idempotence survive
- [x] `create_definition` + `upsert_config` in one draft: "create the charge if it is
      missing, then price it" now works end to end
- [x] `upsert_config` validated per computation method (Stage 2) — so all 9 methods are
      reachable from a prompt _and_ guarded, closing the lopsidedness
- [x] Refusals carry a next step ("zones are managed in Zone Management, not here")
- [x] Reuses the encoder's channel matching, including its refusal to guess between
      near-identical names — one implementation, not two
- [x] `tests/actionCompile.test.js` (20), `tests/draftBackwardCompat.test.js` (7)

### Deliberately unchanged

`aiSuggestionService.approveSuggestion` — actions compile to its existing input shape.
No tool/function calling, no RAG. Definitions stay create-only.

---

## Verified so far

- **184 tests passing** (8 suites; 76 new).
- ESLint: 0 errors on every file touched.
- `tsc --noEmit` (frontend): clean; only pre-existing errors in the untouched
  `shipmentApi.ts`.

## Blocked — Docker daemon was down for this whole session

Nothing below has been run against a live stack:

```bash
docker-compose restart partner-service     # then check logs + /health

# Stage 2 gate — what would newly fail if enforcement were switched on:
yarn validate:charges                 # dev
make validate-charge-configs          # server (docker-compose.production.yml)
```

**Stage 1 acceptance:** draft a prompt containing a deliberately unmappable line
(_"also create the channel"_, _"volumetric divisor 5000"_). The draft must show a
**"Not applied from your prompt"** block naming both. Before this change they
vanished into `notes` and were never displayed.
