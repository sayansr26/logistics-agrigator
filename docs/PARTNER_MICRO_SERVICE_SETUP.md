# Partner Micro Service Setup Guide

## Overview

This document outlines the setup requirements for the External Partner Micro Service integration needed for **PARTNER-002: External API Integration Client**.

**Production Service**: The Partner Micro service is already deployed in production at `https://calc.websiteduniya.com`

## Service Requirements

### Production Configuration

- **Service URL**: `https://calc.websiteduniya.com`
- **Health Check**: `https://calc.websiteduniya.com/health`
- **API Base URL**: `https://calc.websiteduniya.com/api/v1`

### Expected API Endpoints

Based on the partner service requirements, the Partner Micro service should provide:

```bash
# Rate Calculation
POST /api/v1/calculate
Content-Type: application/json
{
  "origin": "110001",
  "destination": "400001",
  "weight": 1.5,
  "dimensions": {
    "length": 10,
    "width": 8,
    "height": 5
  },
  "serviceType": "standard|express|overnight"
}

# Serviceability Check
POST /api/v1/serviceability
Content-Type: application/json
{
  "pincode": "110001",
  "serviceType": "standard|express|overnight"
}

# Partner List
GET /api/v1/partners
Authorization: Bearer <token>

# Health Check
GET /health
```

### Expected Response Formats

#### Rate Calculation Response

```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "partnerId": "delhivery",
        "partnerName": "Delhivery",
        "serviceType": "standard",
        "rate": 45.5,
        "estimatedDays": "2-3",
        "cod": true,
        "insurance": true
      },
      {
        "partnerId": "bluedart",
        "partnerName": "Blue Dart",
        "serviceType": "express",
        "rate": 85.0,
        "estimatedDays": "1-2",
        "cod": false,
        "insurance": true
      }
    ]
  }
}
```

#### Serviceability Response

```json
{
  "success": true,
  "data": {
    "serviceable": true,
    "partners": ["delhivery", "bluedart", "dtdc"],
    "services": ["standard", "express"],
    "cod": true,
    "prepaid": true
  }
}
```

## Authentication Requirements

### API Key Authentication

```bash
Authorization: Bearer <api_key>
X-API-Version: v1
Content-Type: application/json
```

### Environment Variables Needed

```env
# Partner Micro Service Configuration (Production)
PARTNER_SERVICE_EXTERNAL_URL=https://calc.websiteduniya.com
PARTNER_SERVICE_API_KEY=your_api_key_here
PARTNER_SERVICE_TIMEOUT=5000
PARTNER_SERVICE_RETRY_ATTEMPTS=3
PARTNER_SERVICE_CACHE_TTL=300
```

## Docker Configuration

### Option 1: External Service (Recommended)

If you have the Partner Micro service as a separate application:

```yaml
# Add to docker-compose.yml
services:
  partner-micro-service:
    image: partner-micro-service:latest
    container_name: logistics-partner-micro-service
    ports:
      - "8007:8007"
    environment:
      - NODE_ENV=development
      - PORT=8007
      - API_KEY=${PARTNER_MICRO_API_KEY}
    networks:
      - logistics-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8007/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Option 2: Mock Service (Development)

For development/testing without the actual service:

```yaml
# Mock Partner Micro Service
services:
  partner-micro-mock:
    image: node:18-alpine
    container_name: logistics-partner-micro-mock
    ports:
      - "8007:8007"
    working_dir: /app
    volumes:
      - ./mock-services/partner-micro:/app
    command: ["node", "server.js"]
    networks:
      - logistics-network
```

## Integration Checklist

### Prerequisites

- [ ] Partner Micro service deployed and running on port 8007
- [ ] API documentation available and reviewed
- [ ] Authentication credentials obtained
- [ ] Network connectivity verified
- [ ] Health check endpoint responding

### Validation Steps

```bash
# 1. Check service availability
curl -f http://localhost:8007/health

# 2. Test authentication
curl -H "Authorization: Bearer <api_key>" \
     -H "Content-Type: application/json" \
     http://localhost:8007/api/v1/partners

# 3. Test rate calculation
curl -X POST \
     -H "Authorization: Bearer <api_key>" \
     -H "Content-Type: application/json" \
     -d '{"origin":"110001","destination":"400001","weight":1.5}' \
     http://localhost:8007/api/v1/calculate

# 4. Test serviceability
curl -X POST \
     -H "Authorization: Bearer <api_key>" \
     -H "Content-Type: application/json" \
     -d '{"pincode":"110001","serviceType":"standard"}' \
     http://localhost:8007/api/v1/serviceability
```

## Next Steps

Once the Partner Micro service is set up and validated:

1. **Update Environment**: Add Partner Micro service configuration to `.env`
2. **Start PARTNER-002**: Begin External API Integration Client implementation
3. **Create API Client**: Implement `services/externalPartnerClient.js`
4. **Integration Testing**: Test end-to-end integration with partner service

## Support

For issues with Partner Micro service setup:

1. Check service logs: `docker logs logistics-partner-micro-service`
2. Verify network connectivity between services
3. Validate API key and authentication
4. Review API documentation for endpoint changes

---

**Status**: Ready for Partner Micro service deployment
**Next Task**: PARTNER-002 - External API Integration Client
**Dependencies**: Partner Micro service running on port 8007
