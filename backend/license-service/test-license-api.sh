#!/bin/bash

# Test script for License Service API
# This script demonstrates how to:
# 1. Login to auth service to get admin token
# 2. Use that token to generate a license

set -e

echo "========================================="
echo "  License Service API Test Script"
echo "========================================="
echo ""

# Configuration
AUTH_URL="http://localhost:3002"
LICENSE_URL="http://localhost:3011"

# Step 1: Login to get admin token
echo "Step 1: Logging in to auth service..."
echo "Note: Using default admin credentials (if seeded)"
echo ""

# Try to login with default admin credentials
# You may need to create an admin user first if this fails
LOGIN_RESPONSE=$(curl -s -X POST "${AUTH_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logistics.com",
    "password": "Admin@123456"
  }')

# Check if login was successful
if echo "$LOGIN_RESPONSE" | jq -e '.data.accessToken' > /dev/null 2>&1; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
  echo "✓ Login successful!"
  echo "Token: ${TOKEN:0:50}..."
else
  echo "✗ Login failed. Response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  echo ""
  echo "Create an admin user first:"
  echo "curl -X POST ${AUTH_URL}/api/v1/auth/register \\"
  echo "  -H \"Content-Type: application/json\" \\"
  echo "  -d '{"
  echo "    \"email\": \"admin@logistics.com\","
  echo "    \"password\": \"Admin@123456\","
  echo "    \"name\": \"Admin User\","
  echo "    \"role\": \"admin\""
  echo "  }'"
  exit 1
fi

echo ""
echo "========================================="
echo "Step 2: Generating license..."
echo ""

# Generate a license
LICENSE_RESPONSE=$(curl -s -X POST "${LICENSE_URL}/api/v1/licenses/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "STANDARD",
    "plan": "MONTHLY",
    "allowedServices": ["auth-service", "user-service", "api-gateway", "shipment-service"],
    "maxActivations": 2,
    "validityDays": 30
  }')

# Check if license generation was successful
if echo "$LICENSE_RESPONSE" | jq -e '.data.license.key' > /dev/null 2>&1; then
  echo "✓ License generated successfully!"
  echo ""
  echo "$LICENSE_RESPONSE" | jq '.'

  # Extract and display the license key
  LICENSE_KEY=$(echo "$LICENSE_RESPONSE" | jq -r '.data.license.key')
  echo ""
  echo "========================================="
  echo "License Key:"
  echo "$LICENSE_KEY"
  echo "========================================="
  echo ""
  echo "Save this license key for client deployment!"
else
  echo "✗ License generation failed. Response:"
  echo "$LICENSE_RESPONSE" | jq '.'
  exit 1
fi

echo ""
echo "========================================="
echo "Step 3: Validating the license..."
echo ""

# Validate the generated license
VALIDATE_RESPONSE=$(curl -s -X POST "${LICENSE_URL}/api/v1/licenses/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseKey\": \"${LICENSE_KEY}\",
    \"machineId\": \"test-machine-id-12345\",
    \"serverIP\": \"192.168.1.100\"
  }")

echo "Validation result:"
echo "$VALIDATE_RESPONSE" | jq '.'

echo ""
echo "========================================="
echo "✓ Test completed successfully!"
echo "========================================="
