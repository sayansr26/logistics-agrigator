# Geography Management API Documentation

> **For External Developers**
> Version: 1.0
> Base URL: `https://your-domain.com/api/v1`
> All endpoints route through the API Gateway

---

## Table of Contents

1. [Authentication](#authentication)
2. [Geography Hierarchy](#geography-hierarchy)
3. [API Endpoints](#api-endpoints)
   - [States](#states)
   - [Cities](#cities)
   - [Areas](#areas)
   - [Pincodes](#pincodes)
   - [Distance Calculations](#distance-calculations)
4. [Common Filters & Pagination](#common-filters--pagination)
5. [Response Format](#response-format)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Authentication

### Login

Obtain an access token to authenticate API requests.

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "yourPassword123"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "client",
      "isActive": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

**Using the Access Token:**

Include the access token in the `Authorization` header for all subsequent requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Geography Hierarchy

The system follows a 4-level geographical hierarchy for India:

```
State (35 states/UTs)
  └── City (629 cities)
      └── Area (19,159 areas)
          └── Pincode (19,238 pincodes)
```

**Example Hierarchy:**

```
Delhi (State)
  └── New Delhi (City)
      └── Connaught Place (Area)
          └── 110001 (Pincode)
```

---

## API Endpoints

### States

#### 1. Get All States

Retrieve all active Indian states and Union Territories.

**Endpoint:** `GET /api/v1/geography/states`

**Authentication:** Optional (public data)

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Delhi",
      "code": "DL",
      "status": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Maharashtra",
      "code": "MH",
      "status": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 2. Search States

Search states by name or code.

**Endpoint:** `GET /api/v1/geography/states/search`

**Query Parameters:**

- `name` (string, optional) - Search by state name (partial match)
- `code` (string, optional) - Filter by state code (exact match)
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 50) - Results per page

**Example Request:**

```http
GET /api/v1/geography/states/search?name=delh&page=1&limit=20
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Delhi",
      "code": "DL",
      "status": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### Cities

#### 1. Get Cities

Retrieve cities with optional state filtering.

**Endpoint:** `GET /api/v1/geography/cities`

**Query Parameters:**

- `stateId` (string, optional) - Filter by single state UUID
- `stateIds` (string, optional) - Filter by multiple state UUIDs (comma-separated)
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 50) - Results per page (max: 100)

**Example Request:**

```http
GET /api/v1/geography/cities?stateId=550e8400-e29b-41d4-a716-446655440000&page=1&limit=10
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "New Delhi",
      "stateId": "550e8400-e29b-41d4-a716-446655440000",
      "code": "ND",
      "status": true,
      "state": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Delhi",
        "code": "DL"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 629,
      "totalPages": 63
    },
    "activeCount": 629,
    "inactiveCount": 0
  }
}
```

#### 2. Batch Get Cities by States

Retrieve cities for multiple states in a single request.

**Endpoint:** `POST /api/v1/geography/cities/by-states`

**Request Body:**

```json
{
  "stateIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Limits:** Maximum 50 states per request

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "550e8400-e29b-41d4-a716-446655440000": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "New Delhi",
        "stateId": "550e8400-e29b-41d4-a716-446655440000",
        "code": "ND",
        "status": true
      }
    ],
    "660e8400-e29b-41d4-a716-446655440001": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "name": "Mumbai",
        "stateId": "660e8400-e29b-41d4-a716-446655440001",
        "code": "MU",
        "status": true
      }
    ]
  },
  "summary": {
    "totalCities": 25,
    "statesWithCities": 2
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

### Areas

#### 1. Get Areas

Retrieve areas with optional city/state filtering.

**Endpoint:** `GET /api/v1/geography/areas`

**Query Parameters:**

- `cityId` (string, optional) - Filter by single city UUID
- `cityIds` (string, optional) - Filter by multiple city UUIDs (comma-separated)
- `stateIds` (string, optional) - Filter by state UUIDs (comma-separated)
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 50) - Results per page (max: 100)

**Example Request:**

```http
GET /api/v1/geography/areas?cityId=770e8400-e29b-41d4-a716-446655440002&page=1&limit=10
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "name": "Connaught Place",
      "cityId": "770e8400-e29b-41d4-a716-446655440002",
      "code": "CP",
      "status": true,
      "city": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "New Delhi",
        "stateId": "550e8400-e29b-41d4-a716-446655440000"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 19159,
      "totalPages": 1916
    },
    "activeCount": 19159,
    "inactiveCount": 0
  }
}
```

#### 2. Batch Get Areas by Cities

Retrieve areas for multiple cities in a single request.

**Endpoint:** `POST /api/v1/geography/areas/by-cities`

**Request Body:**

```json
{
  "cityIds": [
    "770e8400-e29b-41d4-a716-446655440002",
    "880e8400-e29b-41d4-a716-446655440003"
  ]
}
```

**Limits:** Maximum 100 cities per request

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "770e8400-e29b-41d4-a716-446655440002": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "name": "Connaught Place",
        "cityId": "770e8400-e29b-41d4-a716-446655440002",
        "status": true
      }
    ]
  },
  "summary": {
    "totalAreas": 150,
    "citiesWithAreas": 2
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

### Pincodes

#### 1. Get Pincodes

Retrieve pincodes with optional area/city/state filtering.

**Endpoint:** `GET /api/v1/geography/pincodes`

**Query Parameters:**

- `areaId` (string, optional) - Filter by area UUID
- `cityId` (string, optional) - Filter by city UUID
- `stateId` (string, optional) - Filter by state UUID
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 10) - Results per page (max: 100)

**Example Request:**

```http
GET /api/v1/geography/pincodes?cityId=770e8400-e29b-41d4-a716-446655440002&page=1&limit=10
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "code": "110001",
      "stateId": "550e8400-e29b-41d4-a716-446655440000",
      "cityId": "770e8400-e29b-41d4-a716-446655440002",
      "areaId": "990e8400-e29b-41d4-a716-446655440004",
      "status": true,
      "state": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Delhi",
        "code": "DL"
      },
      "city": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "New Delhi"
      },
      "area": {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "name": "Connaught Place"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 19238,
      "totalPages": 1924
    },
    "activeCount": 19238,
    "inactiveCount": 0
  }
}
```

#### 2. Search Pincodes

Search pincodes with multiple criteria.

**Endpoint:** `GET /api/v1/geography/pincodes/search`

**Query Parameters:**

- `code` (string, optional) - Pincode (6 digits, partial match allowed)
- `city` (string, optional) - City name (partial match)
- `state` (string, optional) - State name (partial match)
- `district` (string, optional) - District name (partial match)
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Results per page

**Note:** At least one search parameter is required.

**Example Request:**

```http
GET /api/v1/geography/pincodes/search?code=110&city=delhi&page=1&limit=20
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "pincodes": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "code": "110001",
        "stateId": "550e8400-e29b-41d4-a716-446655440000",
        "cityId": "770e8400-e29b-41d4-a716-446655440002",
        "areaId": "990e8400-e29b-41d4-a716-446655440004",
        "status": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 3. Get Pincode Details

Get complete details for a specific pincode with full hierarchy.

**Endpoint:** `GET /api/v1/geography/pincodes/:code`

**Path Parameters:**

- `code` (string, required) - 6-digit pincode

**Example Request:**

```http
GET /api/v1/geography/pincodes/110001
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "code": "110001",
    "areaName": "Connaught Place",
    "cityName": "New Delhi",
    "stateName": "Delhi",
    "stateCode": "DL",
    "district": "New Delhi",
    "status": true,
    "hierarchy": {
      "state": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Delhi",
        "code": "DL"
      },
      "city": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "New Delhi",
        "stateId": "550e8400-e29b-41d4-a716-446655440000"
      },
      "area": {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "name": "Connaught Place",
        "cityId": "770e8400-e29b-41d4-a716-446655440002"
      }
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 4. Batch Get Pincodes by Areas

Retrieve pincodes for multiple areas in a single request.

**Endpoint:** `POST /api/v1/geography/pincodes/by-areas`

**Request Body:**

```json
{
  "areaIds": [
    "990e8400-e29b-41d4-a716-446655440004",
    "aa0e8400-e29b-41d4-a716-446655440006"
  ]
}
```

**Limits:** Maximum 100 areas per request

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "990e8400-e29b-41d4-a716-446655440004": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "code": "110001",
        "areaId": "990e8400-e29b-41d4-a716-446655440004",
        "status": true
      }
    ]
  },
  "summary": {
    "totalPincodes": 50,
    "areasWithPincodes": 2
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

### Distance Calculations

#### 1. Calculate Distance Between Coordinates

Calculate distance between two latitude/longitude points using the Haversine formula.

**Endpoint:** `POST /api/v1/geography/distance/coordinates`

**Request Body:**

```json
{
  "from": {
    "latitude": 28.6139,
    "longitude": 77.209
  },
  "to": {
    "latitude": 18.9387,
    "longitude": 72.8354
  }
}
```

**Validation Rules:**

- `latitude`: -90 to 90
- `longitude`: -180 to 180

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "distance": 1145.67,
    "distanceMiles": 711.84,
    "unit": "kilometers",
    "calculationMethod": "haversine",
    "cached": false,
    "fromLocation": {
      "latitude": 28.6139,
      "longitude": 77.209
    },
    "toLocation": {
      "latitude": 18.9387,
      "longitude": 72.8354
    }
  },
  "message": "Distance calculated successfully",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 2. Calculate Distance Between Pincodes

Calculate distance between two Indian pincodes.

**Endpoint:** `POST /api/v1/geography/distance/pincode-to-pincode`

**Request Body:**

```json
{
  "fromPincode": "110001",
  "toPincode": "400001"
}
```

**Validation Rules:**

- Both pincodes must be 6-digit strings
- Pincodes must exist in database

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "distance": 1145.67,
    "distanceMiles": 711.84,
    "unit": "kilometers",
    "calculationMethod": "pincode_coordinates",
    "cached": true,
    "fromPincode": {
      "code": "110001",
      "city": "New Delhi",
      "state": "Delhi"
    },
    "toPincode": {
      "code": "400001",
      "city": "Mumbai",
      "state": "Maharashtra"
    }
  },
  "message": "Distance calculated successfully",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 3. Calculate Distance Between Cities

Calculate distance between two cities using their central coordinates.

**Endpoint:** `POST /api/v1/geography/distance/city-to-city`

**Request Body:**

```json
{
  "fromCityId": "770e8400-e29b-41d4-a716-446655440002",
  "toCityId": "880e8400-e29b-41d4-a716-446655440003"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "distance": 1145.67,
    "distanceMiles": 711.84,
    "unit": "kilometers",
    "calculationMethod": "city_coordinates",
    "cached": true,
    "fromCity": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "New Delhi",
      "state": "Delhi"
    },
    "toCity": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "name": "Mumbai",
      "state": "Maharashtra"
    }
  },
  "message": "Distance calculated successfully",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 4. Calculate Distance Between States

Calculate distance between two states (capital to capital).

**Endpoint:** `POST /api/v1/geography/distance/state-to-state`

**Request Body:**

```json
{
  "fromStateId": "550e8400-e29b-41d4-a716-446655440000",
  "toStateId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "distance": 1145.67,
    "distanceMiles": 711.84,
    "unit": "kilometers",
    "calculationMethod": "state_capitals",
    "cached": true,
    "fromState": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Delhi",
      "code": "DL"
    },
    "toState": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Maharashtra",
      "code": "MH"
    }
  },
  "message": "Distance calculated successfully",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 5. Calculate Distance Between Areas

Calculate distance between two areas.

**Endpoint:** `POST /api/v1/geography/distance/area-to-area`

**Request Body:**

```json
{
  "fromAreaId": "990e8400-e29b-41d4-a716-446655440004",
  "toAreaId": "aa0e8400-e29b-41d4-a716-446655440006"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "distance": 12.34,
    "distanceMiles": 7.67,
    "unit": "kilometers",
    "calculationMethod": "area_coordinates",
    "cached": true,
    "fromArea": {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "name": "Connaught Place",
      "city": "New Delhi"
    },
    "toArea": {
      "id": "aa0e8400-e29b-41d4-a716-446655440006",
      "name": "Karol Bagh",
      "city": "New Delhi"
    }
  },
  "message": "Distance calculated successfully",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

#### 6. Batch Distance Calculations

Calculate multiple distances in a single request for better performance.

**Endpoint:** `POST /api/v1/geography/distance/batch`

**Request Body:**

```json
{
  "calculations": [
    {
      "type": "pincode",
      "from": "110001",
      "to": "400001"
    },
    {
      "type": "city",
      "from": "770e8400-e29b-41d4-a716-446655440002",
      "to": "880e8400-e29b-41d4-a716-446655440003"
    },
    {
      "type": "coordinates",
      "from": { "latitude": 28.6139, "longitude": 77.209 },
      "to": { "latitude": 18.9387, "longitude": 72.8354 }
    }
  ]
}
```

**Validation Rules:**

- Minimum: 1 calculation
- Maximum: 100 calculations per request
- Supported types: `pincode`, `city`, `state`, `area`, `coordinates`

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "index": 0,
        "type": "pincode",
        "success": true,
        "distance": 1145.67,
        "distanceMiles": 711.84
      },
      {
        "index": 1,
        "type": "city",
        "success": true,
        "distance": 1145.67,
        "distanceMiles": 711.84
      },
      {
        "index": 2,
        "type": "coordinates",
        "success": true,
        "distance": 1145.67,
        "distanceMiles": 711.84
      }
    ],
    "summary": {
      "total": 3,
      "successful": 3,
      "failed": 0
    }
  },
  "message": "Batch calculation completed",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

## Common Filters & Pagination

### Pagination Parameters

All list endpoints support pagination:

- `page` (number, optional, default: 1) - Page number (starts from 1)
- `limit` (number, optional) - Results per page
  - States: default 50, max 100
  - Cities: default 50, max 100
  - Areas: default 50, max 100
  - Pincodes: default 10, max 100

### Pagination Response

```json
{
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

### Multiple Filters

You can combine multiple filters:

```http
GET /api/v1/geography/areas?cityIds=city1,city2&stateIds=state1&page=1&limit=50
```

---

## Response Format

### Success Response

```json
{
  "status": "success",
  "data": {
    /* Response data */
  },
  "message": "Operation successful",
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "pagination": {
      /* Optional pagination */
    }
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters"
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

## Error Handling

### Common Error Codes

| Code                  | HTTP Status | Description                       |
| --------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid request parameters        |
| `NOT_FOUND`           | 404         | Resource not found                |
| `INTERNAL_ERROR`      | 500         | Internal server error             |
| `CALCULATION_ERROR`   | 400         | Distance calculation failed       |
| `SERVICE_ERROR`       | 500         | Service temporarily unavailable   |
| `UNAUTHORIZED`        | 401         | Missing or invalid authentication |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                 |

### Example Error Response

```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Pincode 999999 not found"
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z"
  }
}
```

---

## Rate Limiting

All geography endpoints have rate limiting to prevent abuse:

- **Limit:** 100 requests per 15 minutes per IP address
- **Headers included in response:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

### Rate Limit Exceeded Response (429)

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  },
  "meta": {
    "timestamp": "2025-01-10T10:30:00.000Z",
    "retryAfter": 300
  }
}
```

---

## Best Practices

### 1. Use Batch Endpoints

For better performance, use batch endpoints when querying multiple entities:

```javascript
// ❌ Bad: Multiple individual requests
const cities1 = await fetch("/api/v1/geography/cities?stateId=state1");
const cities2 = await fetch("/api/v1/geography/cities?stateId=state2");

// ✅ Good: Single batch request
const cities = await fetch("/api/v1/geography/cities/by-states", {
  method: "POST",
  body: JSON.stringify({ stateIds: ["state1", "state2"] }),
});
```

### 2. Implement Caching

Distance calculations are cached for 24 hours. Cache responses on your end to reduce API calls:

```javascript
// Cache geography data locally
const states = await fetch("/api/v1/geography/states");
localStorage.setItem("states", JSON.stringify(states), { ttl: 3600 });
```

### 3. Handle Pagination Efficiently

Don't load all data at once. Use pagination:

```javascript
// ✅ Good: Paginated loading
const pincodes = await fetch("/api/v1/geography/pincodes?page=1&limit=50");
```

### 4. Use Specific Filters

Be specific with filters to reduce response size:

```javascript
// ❌ Bad: Loading all cities
const cities = await fetch("/api/v1/geography/cities");

// ✅ Good: Filter by state
const cities = await fetch("/api/v1/geography/cities?stateId=550e8400...");
```

### 5. Error Handling

Always implement proper error handling:

```javascript
try {
  const response = await fetch("/api/v1/geography/pincodes/110001");
  const data = await response.json();

  if (data.status === "error") {
    console.error(`Error: ${data.error.message}`);
    return;
  }

  // Process data
} catch (error) {
  console.error("Network error:", error);
}
```

---

## Sample Integration Code

### JavaScript/Node.js

```javascript
const API_BASE_URL = "https://your-domain.com/api/v1";
let accessToken = null;

// 1. Login
async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (data.status === "success") {
    accessToken = data.data.accessToken;
  }
  return data;
}

// 2. Get States
async function getStates() {
  const response = await fetch(`${API_BASE_URL}/geography/states`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.json();
}

// 3. Get Cities by State
async function getCitiesByState(stateId, page = 1, limit = 50) {
  const response = await fetch(
    `${API_BASE_URL}/geography/cities?stateId=${stateId}&page=${page}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.json();
}

// 4. Search Pincodes
async function searchPincodes(code, city) {
  const params = new URLSearchParams();
  if (code) params.append("code", code);
  if (city) params.append("city", city);

  const response = await fetch(
    `${API_BASE_URL}/geography/pincodes/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.json();
}

// 5. Calculate Distance
async function calculateDistance(fromPincode, toPincode) {
  const response = await fetch(
    `${API_BASE_URL}/geography/distance/pincode-to-pincode`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fromPincode, toPincode }),
    },
  );
  return response.json();
}

// Usage Example
async function main() {
  // Login
  await login("user@example.com", "password123");

  // Get all states
  const states = await getStates();
  console.log("States:", states.data);

  // Get cities for first state
  const cities = await getCitiesByState(states.data[0].id);
  console.log("Cities:", cities.data);

  // Search pincodes in Delhi
  const pincodes = await searchPincodes("110", "delhi");
  console.log("Pincodes:", pincodes.data);

  // Calculate distance
  const distance = await calculateDistance("110001", "400001");
  console.log("Distance:", distance.data.distance, "km");
}

main();
```

### Python

```python
import requests

API_BASE_URL = 'https://your-domain.com/api/v1'
access_token = None

# 1. Login
def login(email, password):
    global access_token
    response = requests.post(
        f'{API_BASE_URL}/auth/login',
        json={'email': email, 'password': password}
    )
    data = response.json()
    if data['status'] == 'success':
        access_token = data['data']['accessToken']
    return data

# 2. Get States
def get_states():
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get(f'{API_BASE_URL}/geography/states', headers=headers)
    return response.json()

# 3. Get Cities by State
def get_cities_by_state(state_id, page=1, limit=50):
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'stateId': state_id, 'page': page, 'limit': limit}
    response = requests.get(
        f'{API_BASE_URL}/geography/cities',
        headers=headers,
        params=params
    )
    return response.json()

# 4. Search Pincodes
def search_pincodes(code=None, city=None):
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {}
    if code:
        params['code'] = code
    if city:
        params['city'] = city

    response = requests.get(
        f'{API_BASE_URL}/geography/pincodes/search',
        headers=headers,
        params=params
    )
    return response.json()

# 5. Calculate Distance
def calculate_distance(from_pincode, to_pincode):
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    response = requests.post(
        f'{API_BASE_URL}/geography/distance/pincode-to-pincode',
        headers=headers,
        json={'fromPincode': from_pincode, 'toPincode': to_pincode}
    )
    return response.json()

# Usage Example
if __name__ == '__main__':
    # Login
    login('user@example.com', 'password123')

    # Get all states
    states = get_states()
    print('States:', states['data'])

    # Get cities for first state
    cities = get_cities_by_state(states['data'][0]['id'])
    print('Cities:', cities['data'])

    # Search pincodes in Delhi
    pincodes = search_pincodes(code='110', city='delhi')
    print('Pincodes:', pincodes['data'])

    # Calculate distance
    distance = calculate_distance('110001', '400001')
    print(f"Distance: {distance['data']['distance']} km")
```

---

## Support

For API support or questions, please contact:

- **Email:** support@your-domain.com
- **Documentation:** https://docs.your-domain.com
- **Status Page:** https://status.your-domain.com

---

**Last Updated:** January 10, 2025
**API Version:** 1.0
**Documentation Version:** 1.0
