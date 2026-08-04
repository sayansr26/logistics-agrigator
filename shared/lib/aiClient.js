/**
 * Shared AI Client (DeepSeek — OpenAI-compatible chat completions)
 *
 * Thin axios wrapper used by the charges-engine AI brain. Hard rules:
 *   - 20s timeout, one retry on 5xx/timeout
 *   - throws AiUnavailableError on failure — callers MUST degrade gracefully;
 *     AI availability may never block quoting or booking
 *   - completeJson() forces response_format json_object and parses the result
 *
 * Env: AI_API_KEY (required), AI_BASE_URL (default https://api.deepseek.com),
 *      AI_MODEL (default deepseek-chat), AI_DEFAULT_PROVIDER (informational)
 */

const axios = require("axios");
const { AiUnavailableError } = require("./errors");
const logger = require("./logger");

// Generation time scales with prompt size + max_tokens: short calls (explain,
// cod-risk) finish well under 30s, but config drafting / anomaly scans can
// stream for a minute+. Callers pass timeoutMs per call; AI_TIMEOUT_MS
// overrides the default globally.
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30000;

function getConfig() {
  return {
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(
      /\/$/,
      "",
    ),
    model: process.env.AI_MODEL || "deepseek-chat",
    provider: process.env.AI_DEFAULT_PROVIDER || "DEEPSEEK",
  };
}

function isConfigured() {
  return Boolean(getConfig().apiKey);
}

async function postChatCompletion(
  body,
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) {
    throw new AiUnavailableError("AI_API_KEY is not configured");
  }

  const url = `${baseUrl}/chat/completions`;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      // "aborted"/ECONNRESET with a 200 status = the response body stream was
      // cut mid-generation (usually our own timeout firing while the model
      // streams) — transient, retry it like a timeout.
      const streamAborted =
        error.code === "ECONNRESET" ||
        error.code === "ERR_CANCELED" ||
        /aborted/i.test(error.message || "");
      const retryable =
        !status ||
        status >= 500 ||
        error.code === "ECONNABORTED" ||
        streamAborted;
      logger.warn("AI request failed", {
        attempt,
        status: status || error.code,
        streamAborted,
        retryable,
        error: error.message,
      });
      if (!retryable || attempt === 2) break;
    }
  }

  throw new AiUnavailableError("AI provider request failed", {
    status: lastError?.response?.status || lastError?.code || null,
    message: lastError?.message,
  });
}

/**
 * Chat completion returning the assistant's raw text.
 *
 * @param {Array<{role, content}>} messages
 * @param {Object} [options] - { temperature, maxTokens, timeoutMs }
 */
async function complete(messages, options = {}) {
  const { model } = getConfig();
  const data = await postChatCompletion(
    {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.2,
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    },
    options,
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiUnavailableError("AI provider returned an empty response");
  }
  return { content, model: data.model, usage: data.usage };
}

/**
 * Chat completion forced into JSON mode; returns the parsed object.
 */
async function completeJson(messages, options = {}) {
  const { model } = getConfig();
  const data = await postChatCompletion(
    {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.1,
      response_format: { type: "json_object" },
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    },
    options,
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiUnavailableError("AI provider returned an empty response");
  }

  try {
    return { json: JSON.parse(content), model: data.model, usage: data.usage };
  } catch (parseError) {
    throw new AiUnavailableError("AI provider returned invalid JSON", {
      snippet: content.slice(0, 200),
    });
  }
}

module.exports = { complete, completeJson, isConfigured, getConfig };
