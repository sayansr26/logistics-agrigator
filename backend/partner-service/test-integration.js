/**
 * Test script to verify Partner Service external integration
 */

const {
  getExternalPartnerClient,
} = require("./backend/partner-service/services/externalPartnerClient");

async function testIntegration() {
  console.log("🧪 Testing Partner Service External Integration...");

  try {
    const client = getExternalPartnerClient();

    console.log("\n1. Testing Rate Calculation...");
    const rateParams = {
      origin: "110001",
      destination: "400001",
      weight: 1.5,
      serviceType: "standard",
      partnerId: "partner_001",
    };

    console.log("Request params:", rateParams);
    const rateResponse = await client.calculateRates(rateParams);
    console.log("Rate response:", JSON.stringify(rateResponse, null, 2));

    console.log("\n2. Testing Serviceability Check...");
    const serviceabilityParams = {
      pincode: "110001",
      serviceType: "standard",
    };

    console.log("Request params:", serviceabilityParams);
    const serviceabilityResponse =
      await client.checkServiceability(serviceabilityParams);
    console.log(
      "Serviceability response:",
      JSON.stringify(serviceabilityResponse, null, 2),
    );

    console.log("\n3. Testing Health Check...");
    const healthResponse = await client.healthCheck();
    console.log("Health response:", JSON.stringify(healthResponse, null, 2));

    console.log("\n✅ Integration test completed successfully!");
  } catch (error) {
    console.error("❌ Integration test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

testIntegration();
