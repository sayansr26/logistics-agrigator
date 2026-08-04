/**
 * AI Quote Explanation (Charges Engine v3)
 *
 * Plain-language explanation of a quote breakdown. Read-only enrichment —
 * on AI failure the caller gets a graceful AiUnavailableError (503) and the
 * UI simply hides the explanation.
 */

const aiClient = require("../../shared/lib/aiClient");
const prompts = require("./prompts/chargeConfigPrompts");

async function explainQuote({ breakdown, pricing, context }) {
  const { json, model } = await aiClient.completeJson(
    prompts.explainQuoteMessages({ breakdown, pricing, context }),
    { maxTokens: 800, temperature: 0.3 },
  );

  return {
    explanation: json.explanation || "",
    highlights: Array.isArray(json.highlights) ? json.highlights : [],
    model,
  };
}

module.exports = { explainQuote };
