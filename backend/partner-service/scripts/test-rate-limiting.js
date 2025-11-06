#!/usr/bin/env node

/**
 * Rate Limiting Test Script
 * Tests the rate limiting middleware implementation
 */

import { performance } from "perf_hooks";

const BASE_URL = "http://localhost:3000";

async function makeRequest(endpoint, headers = {}) {
  const start = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers,
    });

    const duration = performance.now() - start;
    const data = await response.json();

    return {
      status: response.status,
      headers: {
        "x-ratelimit-limit": response.headers.get("x-ratelimit-limit"),
        "x-ratelimit-remaining": response.headers.get("x-ratelimit-remaining"),
        "x-ratelimit-reset": response.headers.get("x-ratelimit-reset"),
        "x-ratelimit-window": response.headers.get("x-ratelimit-window"),
      },
      data,
      duration: Math.round(duration),
    };
  } catch (error) {
    return {
      error: error.message,
      duration: Math.round(performance.now() - start),
    };
  }
}

async function testHealthEndpoint() {
  console.log("\n🏥 Testing Health Endpoint Rate Limiting...");

  for (let i = 1; i <= 5; i++) {
    const result = await makeRequest("/health");

    console.log(`Request ${i}:`, {
      status: result.status,
      limit: result.headers["x-ratelimit-limit"],
      remaining: result.headers["x-ratelimit-remaining"],
      duration: `${result.duration}ms`,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function testSearchEndpoint() {
  console.log("\n🔍 Testing Search Endpoint Rate Limiting...");

  for (let i = 1; i <= 3; i++) {
    const result = await makeRequest("/api/v1/pincodes/search");

    console.log(`Request ${i}:`, {
      status: result.status,
      limit: result.headers["x-ratelimit-limit"],
      remaining: result.headers["x-ratelimit-remaining"],
      error: result.data?.error?.code,
      duration: `${result.duration}ms`,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function testWithPartnerAuth() {
  console.log("\n🔐 Testing With Partner Authentication Headers...");

  const headers = {
    "x-partner-id": "test_partner",
    "x-timestamp": Math.floor(Date.now() / 1000).toString(),
    "x-signature": "test_signature", // Invalid but will show rate limiting
  };

  for (let i = 1; i <= 3; i++) {
    const result = await makeRequest("/api/v1/pincodes/search", headers);

    console.log(`Partner Request ${i}:`, {
      status: result.status,
      limit: result.headers["x-ratelimit-limit"],
      remaining: result.headers["x-ratelimit-remaining"],
      error: result.data?.error?.code,
      duration: `${result.duration}ms`,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function testDocumentationEndpoint() {
  console.log(
    "\n📚 Testing Documentation Endpoint (Should Skip Rate Limiting)...",
  );

  const result = await makeRequest("/api-docs");

  console.log("Documentation Request:", {
    status: result.status,
    limit: result.headers?.["x-ratelimit-limit"] || "N/A (skipped)",
    remaining: result.headers?.["x-ratelimit-remaining"] || "N/A (skipped)",
    hasRateLimitHeaders: !!result.headers?.["x-ratelimit-limit"],
    duration: `${result.duration}ms`,
  });
}

async function main() {
  console.log("🚀 Rate Limiting Test Suite");
  console.log("===============================");

  try {
    // Test different endpoints with different rate limiting rules
    await testHealthEndpoint();
    await testSearchEndpoint();
    await testWithPartnerAuth();
    await testDocumentationEndpoint();

    console.log("\n✅ Rate limiting tests completed!");
    console.log("\nExpected behavior:");
    console.log("- Health endpoint: 200 requests/minute");
    console.log("- Search endpoints: 60 requests/minute");
    console.log("- Partner auth: 50 requests/minute (test_partner)");
    console.log("- Documentation: Should skip rate limiting");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);
