#!/bin/bash

# Test HMAC authentication for Partner Micro Service
# This script generates the same HMAC signature as the Postman script

HMAC_SECRET="hmac_super_secret_key_2024_partner_services"
API_SECRET_SALT="api_secret_salt_2024_partner_services"
SERVICE_ID="TESTING_1"
BASE_URL="https://calc.websiteduniya.com"

# Request details
METHOD="POST"
URL="/api/v1/calculate"
TIMESTAMP=$(date +%s)
REQUEST_BODY='{"origin":"110001","destination":"400001","weight":1.5,"dimensions":{"length":10,"width":10,"height":10},"serviceType":"standard"}'

echo "🔐 Testing HMAC Authentication for Partner Micro Service"
echo "Base URL: $BASE_URL"
echo "Service ID: $SERVICE_ID"
echo ""

echo "=== Request Details ==="
echo "Method: $METHOD"
echo "URL: $URL"
echo "Timestamp: $TIMESTAMP"
echo "Request Body: $REQUEST_BODY"
echo ""

# Generate service secret: HMAC-SHA256(SERVICE_ID:API_SECRET_SALT, HMAC_SECRET)
SECRET_DATA="${SERVICE_ID}:${API_SECRET_SALT}"
echo "Secret generation data: $SECRET_DATA"

# Use Node.js to generate the HMAC (since bash doesn't have built-in HMAC-SHA256)
SERVICE_SECRET=$(node -e "
const crypto = require('crypto');
const secret = crypto.createHmac('sha256', '$HMAC_SECRET').update('$SECRET_DATA').digest('hex');
console.log(secret);
")

echo "Generated service secret: $SERVICE_SECRET"

# Generate signature: HMAC-SHA256(METHOD+URL+TIMESTAMP+BODY, SERVICE_SECRET)
SIGNATURE_MESSAGE="${METHOD}${URL}${TIMESTAMP}${REQUEST_BODY}"
echo "Signature message: \"$SIGNATURE_MESSAGE\""

SIGNATURE=$(node -e "
const crypto = require('crypto');
const signature = crypto.createHmac('sha256', '$SERVICE_SECRET').update('$SIGNATURE_MESSAGE').digest('hex');
console.log(signature);
")

echo "Generated signature: $SIGNATURE"
echo ""

echo "=== Authentication Headers ==="
echo "x-service-id: $SERVICE_ID"
echo "x-timestamp: $TIMESTAMP"
echo "x-signature: $SIGNATURE"
echo ""

echo "🚀 Making request to: ${BASE_URL}${URL}"
echo ""

# Make the request
curl -X POST "${BASE_URL}${URL}" \
  -H "Content-Type: application/json" \
  -H "x-service-id: $SERVICE_ID" \
  -H "x-timestamp: $TIMESTAMP" \
  -H "x-signature: $SIGNATURE" \
  -d "$REQUEST_BODY" \
  -v

echo ""
echo "Test completed!"
