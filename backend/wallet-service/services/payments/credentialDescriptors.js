/**
 * Payment Provider Credential Descriptors
 *
 * SINGLE SOURCE OF TRUTH for "what credential fields does provider X have, where
 * is each one stored, and which legacy config key does it feed?".
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `providerConfigService.js` hard-codes a three-field credential model in an
 * `isLive ? live… : test…` ternary repeated across three functions:
 *   testKeyId / liveKeyId                     (plaintext column)
 *   testKeySecretEnc / liveKeySecretEnc       (AES-256-GCM envelope)
 *   testWebhookSecretEnc / liveWebhookSecretEnc
 *
 * That trio cannot express CCAvenue, which needs Merchant ID (public), Access
 * Code (semi-public — it rides in the redirect form the browser posts) and a
 * Working Key that does DOUBLE DUTY as both the request-encryption key and the
 * response/webhook-decryption key. A follow-up change makes
 * `providerConfigService` iterate these descriptors instead of naming columns.
 *
 * TWO STORAGE BACKINGS
 * --------------------
 * 1. LEGACY COLUMNS — Razorpay keeps its four existing columns exactly where
 *    they are today. Zero movement of live secrets, zero backfill risk. A field
 *    declares them via `legacyColumns: {test: {...}, live: {...}}`.
 * 2. THE CREDENTIAL BAG — new nullable JSONB columns `testCredentials` /
 *    `liveCredentials` on `payment_provider_configs`, shaped:
 *        { "<fieldName>": { "v": "<plaintext>" } | { "enc": "<AES-256-GCM envelope>" } }
 *    The `v` / `enc` discriminant is deliberate: it is structurally impossible
 *    to mistake a plaintext value for ciphertext (or vice versa) when reading
 *    the bag back, even if a field's `storageClass` were ever mis-declared.
 * A field with no `legacyColumns` lives in the bag, keyed by its `name`.
 *
 * >>> THE ALIAS MECHANISM — THE CRUX OF THE WHOLE REFACTOR <<<
 * -----------------------------------------------------------
 * Every consumer downstream of `resolveConfigForMode()` expects the legacy
 * shape `{ keyId, keySecret, webhookSecret }`:
 *   - `webhookService` verifies signatures with `webhookSecret`
 *   - `topupService.pollProvider` and `reconcileService` authenticate with
 *     `keyId` + `keySecret`
 *   - the frontend's `isAvailable` check is literally `keyId.length > 0`
 *
 * `aliasesTo` lets a provider's own field names PROJECT onto that legacy shape,
 * so the resolver keeps returning `{keyId, keySecret, webhookSecret}` and NONE
 * of those consumers change:
 *
 *   razorpay : keyId      -> keyId
 *              keySecret  -> keySecret
 *              webhookSecret -> webhookSecret          (identity mapping)
 *
 *   ccavenue : merchantId -> (nothing; CCAvenue-specific, read by name)
 *              accessCode -> keyId                     (so `isAvailable` works)
 *              workingKey -> keySecret AND webhookSecret
 *                            ^^^^^^^^^^^^^^^^^^^^^^^^^ the double duty: one
 *                            stored secret fans out to BOTH legacy slots, which
 *                            is exactly right because CCAvenue encrypts the
 *                            request and decrypts the response notification
 *                            with the same working key.
 *
 * An alias target outside LEGACY_CONFIG_KEYS is rejected at module load.
 *
 * PURITY
 * ------
 * Data + pure functions only. No DB access, no `process.env`, no crypto, no I/O.
 * `assertDescriptorIntegrity()` runs once at require-time so a descriptor that
 * could leak a secret (e.g. `revealable` on an encrypted field) crashes the
 * service at boot instead of leaking later.
 */

const { ValidationError } = require("../../shared/lib/errors");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CredentialField
 * @property {string} name                    canonical field name, e.g. "workingKey"
 * @property {string} label                   admin UI label, e.g. "Working Key"
 * @property {"plaintext"|"encrypted"} storageClass
 * @property {boolean} requiredForEnable      blocks enabling the provider when missing
 * @property {boolean} revealable             UI may render the stored value; MUST be false for "encrypted"
 * @property {string} [placeholder]
 * @property {string} [hint]
 * @property {number} [maxLength]
 * @property {{test: {plain?: string, enc?: string}, live: {plain?: string, enc?: string}}} [legacyColumns]
 * @property {string[]} [aliasesTo]           legacy ResolvedProviderConfig keys this field fills
 */

/**
 * @typedef {Object} ProviderDescriptor
 * @property {string} provider
 * @property {CredentialField[]} fields
 * @property {string} publicIdField           the field safe to hand the browser as `keyId`
 * @property {string[]} webhookEvents         rendered in the admin UI for dashboard setup
 * @property {"CHECKOUT_MODAL"|"REDIRECT_POST"} returnFlow
 * @property {boolean} usesReturnEndpoint
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The keys of the legacy ResolvedProviderConfig shape. Every `aliasesTo` entry
 * must be one of these — that is what keeps downstream consumers unchanged.
 * @type {string[]}
 */
const LEGACY_CONFIG_KEYS = ["keyId", "keySecret", "webhookSecret"];

const STORAGE_CLASSES = ["plaintext", "encrypted"];
const RETURN_FLOWS = ["CHECKOUT_MODAL", "REDIRECT_POST"];

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

/**
 * Razorpay — byte-compatible with today's behaviour. Every field is backed by
 * the column it already uses; nothing moves into the bag.
 * @type {ProviderDescriptor}
 */
const RAZORPAY_DESCRIPTOR = {
  provider: "razorpay",
  publicIdField: "keyId",
  returnFlow: "CHECKOUT_MODAL",
  usesReturnEndpoint: false,
  // Copied verbatim from providerConfigService.WEBHOOK_EVENTS.
  webhookEvents: [
    "payment.captured",
    "payment.failed",
    "payment_link.paid",
    "payment_link.expired",
    "refund.processed",
  ],
  fields: [
    {
      name: "keyId",
      label: "Key ID",
      storageClass: "plaintext",
      requiredForEnable: true,
      revealable: true,
      placeholder: "rzp_test_XXXXXXXXXXXX",
      hint: "Public API key from Razorpay Dashboard → Settings → API Keys.",
      maxLength: 128,
      legacyColumns: {
        test: { plain: "testKeyId" },
        live: { plain: "liveKeyId" },
      },
      aliasesTo: ["keyId"],
    },
    {
      name: "keySecret",
      label: "Key Secret",
      storageClass: "encrypted",
      requiredForEnable: true,
      revealable: false,
      placeholder: "••••••••••••••••",
      hint: "Shown only once when the key pair is generated in the Razorpay Dashboard.",
      maxLength: 256,
      legacyColumns: {
        test: { enc: "testKeySecretEnc" },
        live: { enc: "liveKeySecretEnc" },
      },
      aliasesTo: ["keySecret"],
    },
    {
      name: "webhookSecret",
      label: "Webhook Secret",
      storageClass: "encrypted",
      requiredForEnable: true,
      revealable: false,
      placeholder: "••••••••••••••••",
      hint: "Paste the signing secret shown when you register the webhook below.",
      maxLength: 256,
      legacyColumns: {
        test: { enc: "testWebhookSecretEnc" },
        live: { enc: "liveWebhookSecretEnc" },
      },
      aliasesTo: ["webhookSecret"],
    },
  ],
};

/**
 * CCAvenue checkout gateway — everything lives in the credential bag, so no
 * `legacyColumns` anywhere. Note `workingKey.aliasesTo` fanning out to BOTH
 * `keySecret` and `webhookSecret`: CCAvenue encrypts the redirect payload and
 * decrypts the response/notification with the same key.
 * @type {ProviderDescriptor}
 */
const CCAVENUE_DESCRIPTOR = {
  provider: "ccavenue",
  publicIdField: "accessCode",
  returnFlow: "REDIRECT_POST",
  usesReturnEndpoint: true,
  // CCAvenue "Dynamic Event Notification" event names as shown in their
  // merchant dashboard.
  // TODO: confirm exact labels from the CCAvenue merchant dashboard
  webhookEvents: ["Order Status", "Order Refund Status", "Order Risk Status"],
  fields: [
    {
      name: "merchantId",
      label: "Merchant ID",
      storageClass: "plaintext",
      requiredForEnable: true,
      revealable: true,
      placeholder: "123456",
      hint: "Numeric merchant identifier from the CCAvenue dashboard.",
      maxLength: 64,
      aliasesTo: [],
    },
    {
      name: "accessCode",
      label: "Access Code",
      storageClass: "plaintext",
      requiredForEnable: true,
      revealable: true,
      placeholder: "AVXXXXXXXXXXXXXXXXXX",
      hint: "Semi-public; it is posted to CCAvenue in the redirect form.",
      maxLength: 128,
      // Fills the legacy `keyId` slot so the frontend availability check
      // (`keyId.length > 0`) keeps working untouched.
      aliasesTo: ["keyId"],
    },
    {
      name: "workingKey",
      label: "Working Key",
      storageClass: "encrypted",
      requiredForEnable: true,
      revealable: false,
      placeholder: "••••••••••••••••",
      hint: "Used to BOTH encrypt the request and decrypt the response/notification. Rotate it in the CCAvenue dashboard and re-enter it here.",
      maxLength: 256,
      aliasesTo: ["keySecret", "webhookSecret"],
    },
  ],
};

/**
 * CCAvenue static UPI QR collection channel. Configured as its own provider row
 * so its keys and its test/live mode can rotate independently of the checkout
 * gateway. Same three fields; no browser redirect return endpoint.
 * @type {ProviderDescriptor}
 */
const CCAVENUE_UPI_QR_DESCRIPTOR = {
  provider: "ccavenue_upi_qr",
  publicIdField: "accessCode",
  returnFlow: "REDIRECT_POST",
  usesReturnEndpoint: false,
  // TODO: confirm exact labels from the CCAvenue merchant dashboard
  webhookEvents: ["QR Collection"],
  fields: [
    {
      name: "merchantId",
      label: "Merchant ID",
      storageClass: "plaintext",
      requiredForEnable: true,
      revealable: true,
      placeholder: "123456",
      hint: "Numeric merchant identifier for the QR collection account.",
      maxLength: 64,
      aliasesTo: [],
    },
    {
      name: "accessCode",
      label: "Access Code",
      storageClass: "plaintext",
      requiredForEnable: true,
      revealable: true,
      placeholder: "AVXXXXXXXXXXXXXXXXXX",
      hint: "Access code issued for the QR collection account.",
      maxLength: 128,
      aliasesTo: ["keyId"],
    },
    {
      name: "workingKey",
      label: "Working Key",
      storageClass: "encrypted",
      requiredForEnable: true,
      revealable: false,
      placeholder: "••••••••••••••••",
      hint: "Used to BOTH sign the QR request and decrypt the collection notification.",
      maxLength: 256,
      aliasesTo: ["keySecret", "webhookSecret"],
    },
  ],
};

/** @type {Record<string, ProviderDescriptor>} */
const DESCRIPTORS = {
  [RAZORPAY_DESCRIPTOR.provider]: RAZORPAY_DESCRIPTOR,
  [CCAVENUE_DESCRIPTOR.provider]: CCAVENUE_DESCRIPTOR,
  [CCAVENUE_UPI_QR_DESCRIPTOR.provider]: CCAVENUE_UPI_QR_DESCRIPTOR,
};

// ---------------------------------------------------------------------------
// Integrity self-check
// ---------------------------------------------------------------------------

function integrityFailure(message) {
  // Thrown at require-time: a descriptor that could leak a secret must kill the
  // boot, not survive to serve a request.
  return new Error(
    `[credentialDescriptors] descriptor integrity violation: ${message}`,
  );
}

/**
 * Validate every descriptor against the invariants that keep secrets safe.
 * Invoked once at module load; also exported so tests can call it directly.
 *
 * Enforced invariants:
 *  1. provider key matches `descriptor.provider`, and there is >= 1 field.
 *  2. field names are non-empty and unique within a provider.
 *  3. `storageClass` is "plaintext" | "encrypted"; `returnFlow` is a known flow.
 *  4. NEVER `revealable === true` on an `encrypted` field (the secret-leak case).
 *  5. `publicIdField` names an existing field, and that field is not encrypted.
 *  6. every field has a storage home: either a well-formed `legacyColumns`
 *     (both `test` and `live`, carrying `plain` for plaintext / `enc` for
 *     encrypted), or the implied credential-bag home keyed by `name`.
 *  7. every `aliasesTo` entry is one of LEGACY_CONFIG_KEYS, with no duplicates.
 *  8. no two fields of a provider alias to the same legacy key.
 *
 * @throws {Error} on the first violation found
 */
function assertDescriptorIntegrity() {
  for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
    if (!descriptor || descriptor.provider !== key) {
      throw integrityFailure(
        `registry key "${key}" does not match descriptor.provider`,
      );
    }
    if (!Array.isArray(descriptor.fields) || descriptor.fields.length === 0) {
      throw integrityFailure(`${key}: fields must be a non-empty array`);
    }
    if (!RETURN_FLOWS.includes(descriptor.returnFlow)) {
      throw integrityFailure(
        `${key}: unknown returnFlow "${descriptor.returnFlow}"`,
      );
    }
    if (!Array.isArray(descriptor.webhookEvents)) {
      throw integrityFailure(`${key}: webhookEvents must be an array`);
    }
    if (typeof descriptor.usesReturnEndpoint !== "boolean") {
      throw integrityFailure(`${key}: usesReturnEndpoint must be a boolean`);
    }

    const seenNames = new Set();
    const claimedAliases = new Map();

    for (const field of descriptor.fields) {
      if (!field || typeof field.name !== "string" || field.name.length === 0) {
        throw integrityFailure(`${key}: a field is missing a name`);
      }
      if (seenNames.has(field.name)) {
        throw integrityFailure(`${key}: duplicate field name "${field.name}"`);
      }
      seenNames.add(field.name);

      if (!STORAGE_CLASSES.includes(field.storageClass)) {
        throw integrityFailure(
          `${key}.${field.name}: unknown storageClass "${field.storageClass}"`,
        );
      }
      if (typeof field.label !== "string" || field.label.length === 0) {
        throw integrityFailure(`${key}.${field.name}: label is required`);
      }
      if (typeof field.requiredForEnable !== "boolean") {
        throw integrityFailure(
          `${key}.${field.name}: requiredForEnable must be a boolean`,
        );
      }
      if (typeof field.revealable !== "boolean") {
        throw integrityFailure(
          `${key}.${field.name}: revealable must be a boolean`,
        );
      }

      // (4) the secret-leak invariant.
      if (field.revealable && field.storageClass === "encrypted") {
        throw integrityFailure(
          `${key}.${field.name}: encrypted fields must never be revealable`,
        );
      }

      // (6) storage home.
      if (field.legacyColumns !== undefined) {
        const { legacyColumns } = field;
        if (typeof legacyColumns !== "object" || legacyColumns === null) {
          throw integrityFailure(
            `${key}.${field.name}: legacyColumns must be an object`,
          );
        }
        for (const mode of ["test", "live"]) {
          const entry = legacyColumns[mode];
          if (typeof entry !== "object" || entry === null) {
            throw integrityFailure(
              `${key}.${field.name}: legacyColumns.${mode} is missing`,
            );
          }
          const columnKey =
            field.storageClass === "encrypted" ? "enc" : "plain";
          if (
            typeof entry[columnKey] !== "string" ||
            entry[columnKey].length === 0
          ) {
            throw integrityFailure(
              `${key}.${field.name}: legacyColumns.${mode}.${columnKey} is required for a ${field.storageClass} field`,
            );
          }
        }
      }
      // else: no legacyColumns -> implied credential-bag home keyed by
      // field.name, which the non-empty-name check above already guarantees.

      // (7) + (8) alias targets.
      if (field.aliasesTo !== undefined) {
        if (!Array.isArray(field.aliasesTo)) {
          throw integrityFailure(
            `${key}.${field.name}: aliasesTo must be an array`,
          );
        }
        const seenTargets = new Set();
        for (const target of field.aliasesTo) {
          if (!LEGACY_CONFIG_KEYS.includes(target)) {
            throw integrityFailure(
              `${key}.${field.name}: aliasesTo "${target}" is not one of ${LEGACY_CONFIG_KEYS.join(", ")}`,
            );
          }
          if (seenTargets.has(target)) {
            throw integrityFailure(
              `${key}.${field.name}: duplicate aliasesTo entry "${target}"`,
            );
          }
          seenTargets.add(target);

          if (claimedAliases.has(target)) {
            throw integrityFailure(
              `${key}: legacy key "${target}" is claimed by both "${claimedAliases.get(target)}" and "${field.name}"`,
            );
          }
          claimedAliases.set(target, field.name);
        }
      }
    }

    // (5) publicIdField.
    const publicField = descriptor.fields.find(
      (f) => f.name === descriptor.publicIdField,
    );
    if (!publicField) {
      throw integrityFailure(
        `${key}: publicIdField "${descriptor.publicIdField}" names no declared field`,
      );
    }
    if (publicField.storageClass === "encrypted") {
      throw integrityFailure(
        `${key}: publicIdField "${descriptor.publicIdField}" must not be an encrypted field`,
      );
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param {string} provider
 * @returns {ProviderDescriptor}
 * @throws {ValidationError} code PROVIDER_NOT_SUPPORTED (HTTP 400) when unknown
 */
function getCredentialDescriptor(provider) {
  const descriptor =
    typeof provider === "string" ? DESCRIPTORS[provider] : undefined;
  if (!descriptor) {
    const error = new ValidationError(
      `Unsupported payment provider: ${provider}`,
    );
    error.code = "PROVIDER_NOT_SUPPORTED";
    error.statusCode = 400;
    throw error;
  }
  return descriptor;
}

/**
 * @returns {ProviderDescriptor[]} every descriptor, in registration order
 */
function listDescriptors() {
  return Object.values(DESCRIPTORS);
}

/**
 * @param {string} provider
 * @param {string} name
 * @returns {CredentialField|null}
 */
function fieldByName(provider, name) {
  const descriptor = getCredentialDescriptor(provider);
  return descriptor.fields.find((field) => field.name === name) || null;
}

/**
 * The field safe to hand the browser as `keyId`.
 * @param {string} provider
 * @returns {CredentialField}
 */
function getPublicIdField(provider) {
  const descriptor = getCredentialDescriptor(provider);
  // Integrity check guarantees this resolves.
  return descriptor.fields.find(
    (field) => field.name === descriptor.publicIdField,
  );
}

/**
 * Admin-UI projection. Deliberately returns metadata ONLY — never a stored
 * value, encrypted or otherwise.
 *
 * @param {string} provider
 * @returns {Array<{name: string, label: string, storageClass: string, requiredForEnable: boolean, revealable: boolean, placeholder: string|null, hint: string|null}>}
 */
function describeFieldsForUi(provider) {
  const descriptor = getCredentialDescriptor(provider);
  return descriptor.fields.map((field) => ({
    name: field.name,
    label: field.label,
    storageClass: field.storageClass,
    requiredForEnable: field.requiredForEnable,
    revealable: field.revealable,
    placeholder: field.placeholder ?? null,
    hint: field.hint ?? null,
  }));
}

// Fail loudly at boot rather than leaking a secret later.
assertDescriptorIntegrity();

module.exports = {
  LEGACY_CONFIG_KEYS,
  getCredentialDescriptor,
  listDescriptors,
  fieldByName,
  getPublicIdField,
  describeFieldsForUi,
  assertDescriptorIntegrity,
};
