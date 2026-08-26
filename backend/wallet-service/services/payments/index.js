/**
 * Payment providers — registration entry point.
 *
 * Consumers should require THIS file, never a concrete provider module:
 *
 *   const { getProvider } = require("../services/payments");
 *   const provider = getProvider("razorpay");
 *
 * ADDING A NEW GATEWAY (Stripe / Cashfree / PayU) is exactly two steps:
 *   1. Add one sibling file `./stripeProvider.js` implementing the
 *      PaymentProvider contract documented in providerRegistry.js.
 *   2. Add one line here:
 *        registerLazy("stripe", () => require("./stripeProvider"));
 * Nothing else in the service changes.
 *
 * Registration is LAZY on purpose: `./razorpayProvider` is written in a later
 * wave and the `razorpay` npm package may not be installed yet, so requiring it
 * eagerly here would crash wallet-service at boot. With registerLazy the module
 * is only resolved on the first getProvider("razorpay") call, and a missing
 * file surfaces as a clean 400 PROVIDER_NOT_SUPPORTED instead of a dead
 * container.
 */

const {
  registerLazy,
  registerProvider,
  getProvider,
  listProviders,
  assertContract,
} = require("./providerRegistry");

// Razorpay — implementation lands in a later wave (./razorpayProvider.js).
registerLazy("razorpay", () => require("./razorpayProvider"));

// CCAvenue — non-seamless (redirect) checkout. Orders only: the provider
// refuses payment links outright (supports.paymentLinks === false).
registerLazy("ccavenue", () => require("./ccavenueProvider"));
// The static-QR collection channel is a SEPARATE provider row from the checkout
// gateway, so its keys and TEST/LIVE mode can rotate independently.
registerLazy("ccavenue_upi_qr", () => require("./ccavenueQrProvider"));

// registerLazy("stripe",   () => require("./stripeProvider"));
// registerLazy("cashfree", () => require("./cashfreeProvider"));
// registerLazy("payu",     () => require("./payuProvider"));

module.exports = {
  getProvider,
  listProviders,
  registerProvider,
  registerLazy,
  assertContract,
};
