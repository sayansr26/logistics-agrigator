# Geography, Distance, and Pincode Search APIs

This document lists the API Gateway endpoints used for:

- distance calculation
- state search
- city and area lookup/search flows
- pincode lookup/search

Source of truth: routes and controllers in `backend/api-gateway` and `backend/partner-service`.

## Base URL

Use production API Gateway:

- `https://ops.subsolution.in`

## Auth Rules

### Public (no Bearer token required)

All endpoints under `GET/POST /api/v1/geography/*` are public through API Gateway.

### Protected (Bearer token required)

Deprecated endpoint `GET /api/v1/pincodes/search` requires:

- valid JWT
- role: `superadmin` or `admin`

---

## 1) State APIs

### 1.1 Get all states

- **Method:** `GET`
- **Path:** `/api/v1/geography/states`
- **Auth:** Public
- **Query params:** None

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/states"
```

### 1.2 Search states

- **Method:** `GET`
- **Path:** `/api/v1/geography/states/search`
- **Auth:** Public
- **Query params:**
  - `name` (optional, partial match)
  - `code` (optional, exact match)
  - `page` (optional, default `1`)
  - `limit` (optional, default `50`)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/states/search?name=maha&page=1&limit=20"
```

---

## 2) City APIs

### 2.1 Get cities (filter by state)

- **Method:** `GET`
- **Path:** `/api/v1/geography/cities`
- **Auth:** Public
- **Query params:**
  - `stateId` (optional, UUID)
  - `stateIds` (optional, comma-separated UUIDs)
  - `page` (optional, default `1`)
  - `limit` (optional, default `50`)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/cities?stateId=11111111-1111-1111-1111-111111111111&page=1&limit=50"
```

### 2.2 Batch cities by states

- **Method:** `POST`
- **Path:** `/api/v1/geography/cities/by-states`
- **Auth:** Public
- **Body:**
  - `stateIds` (array of UUIDs, min 1, max 50)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/cities/by-states" \
  -H "Content-Type: application/json" \
  -d '{"stateIds":["11111111-1111-1111-1111-111111111111"]}'
```

---

## 3) Area APIs

### 3.1 Get areas (filter by city/state)

- **Method:** `GET`
- **Path:** `/api/v1/geography/areas`
- **Auth:** Public
- **Query params:**
  - `cityId` (optional, UUID)
  - `cityIds` (optional, comma-separated UUIDs)
  - `stateIds` (optional, comma-separated UUIDs)
  - `page` (optional, default `1`)
  - `limit` (optional, default `50`)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/areas?cityId=22222222-2222-2222-2222-222222222222&page=1&limit=50"
```

### 3.2 Batch areas by cities

- **Method:** `POST`
- **Path:** `/api/v1/geography/areas/by-cities`
- **Auth:** Public
- **Body:**
  - `cityIds` (array of UUIDs, min 1, max 100)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/areas/by-cities" \
  -H "Content-Type: application/json" \
  -d '{"cityIds":["22222222-2222-2222-2222-222222222222"]}'
```

---

## 4) Pincode APIs

### 4.1 Get pincodes (filter by area/city/state)

- **Method:** `GET`
- **Path:** `/api/v1/geography/pincodes`
- **Auth:** Public
- **Query params:**
  - `areaId` (optional, UUID)
  - `cityId` (optional, UUID)
  - `stateId` (optional, UUID)
  - `page` (optional, default `1`)
  - `limit` (optional, default `100`)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/pincodes?areaId=33333333-3333-3333-3333-333333333333&page=1&limit=100"
```

### 4.2 Search pincodes (public geography search)

- **Method:** `GET`
- **Path:** `/api/v1/geography/pincodes/search`
- **Auth:** Public
- **Query params (at least one required):**
  - `code` (optional, 1-6 chars)
  - `q` (optional, alias for `code`)
  - `city` (optional)
  - `state` (optional)
  - `district` (optional)
  - `limit` (optional, default `20`, max `100`)

Examples:

```bash
curl "https://ops.subsolution.in/api/v1/geography/pincodes/search?q=560"
curl "https://ops.subsolution.in/api/v1/geography/pincodes/search?city=bengaluru&limit=20"
```

### 4.3 Get pincode details

- **Method:** `GET`
- **Path:** `/api/v1/geography/pincodes/:code`
- **Auth:** Public
- **Path params:**
  - `code` (required, 6 digits)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/geography/pincodes/560001"
```

### 4.4 Batch pincodes by areas

- **Method:** `POST`
- **Path:** `/api/v1/geography/pincodes/by-areas`
- **Auth:** Public
- **Body:**
  - `areaIds` (array of UUIDs, min 1, max 100)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/pincodes/by-areas" \
  -H "Content-Type: application/json" \
  -d '{"areaIds":["33333333-3333-3333-3333-333333333333"]}'
```

### 4.5 Pincode autocomplete (admin, DEPRECATED)

- **Method:** `GET`
- **Path:** `/api/v1/pincodes/search`
- **Auth:** Bearer token + `superadmin|admin`
- **Status:** Deprecated (use `/api/v1/geography/pincodes/search`)
- **Sunset:** `2026-06-30T00:00:00.000Z`
- **Deprecation headers:**
  - `Deprecation: true`
  - `Sunset: 2026-06-30T00:00:00.000Z`
  - `Link: </api/v1/geography/pincodes/search>; rel="successor-version"`
- **Query params:**
  - `q` or `code` (one required, numeric, max 6)
  - `limit` (optional, default `10`, max `50`)

Example:

```bash
curl "https://ops.subsolution.in/api/v1/pincodes/search?q=560&limit=10" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 5) Distance Calculation APIs

All of these are routed through API Gateway to partner-service distance controller.

### 5.1 Pincode to pincode

- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/pincode-to-pincode`
- **Auth:** Public
- **Body:**
  - `fromPincode` (required, 6 digits)
  - `toPincode` (required, 6 digits)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/pincode-to-pincode" \
  -H "Content-Type: application/json" \
  -d '{"fromPincode":"110001","toPincode":"400001"}'
```

### 5.2 City to city

- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/city-to-city`
- **Auth:** Public
- **Body:**
  - `fromCityId` (required, UUID)
  - `toCityId` (required, UUID)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/city-to-city" \
  -H "Content-Type: application/json" \
  -d '{"fromCityId":"44444444-4444-4444-4444-444444444444","toCityId":"55555555-5555-5555-5555-555555555555"}'
```

### 5.3 State to state

- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/state-to-state`
- **Auth:** Public
- **Body:**
  - `fromStateId` (required, UUID)
  - `toStateId` (required, UUID)

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/state-to-state" \
  -H "Content-Type: application/json" \
  -d '{"fromStateId":"66666666-6666-6666-6666-666666666666","toStateId":"77777777-7777-7777-7777-777777777777"}'
```

### 5.4 Area to area

- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/area-to-area`
- **Auth:** Public
- **Body:**
  - `fromAreaId` (required, UUID)
  - `toAreaId` (required, UUID)

Example:

````bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/area-to-area" \
  -H "Content-Type: application/json" \
  -d '{"fromAreaId":"88888888-8888-8888-8888-888888888888","toAreaId":"99999999-9999-9999-9999-999999999999"}'
### 5.5 Coordinates to coordinates
- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/coordinates`
- **Auth:** Public
- **Body:**
  - `from.latitude` (required, -90 to 90)
  - `from.longitude` (required, -180 to 180)
  - `to.latitude` (required, -90 to 90)
  - `to.longitude` (required, -180 to 180)

Example:
```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/coordinates" \
  -H "Content-Type: application/json" \
  -d '{"from":{"latitude":28.6139,"longitude":77.2090},"to":{"latitude":18.9387,"longitude":72.8354}}'
````

### 5.6 Batch distance calculation

- **Method:** `POST`
- **Path:** `/api/v1/geography/distance/batch`
- **Auth:** Public
- **Body:**
  - `calculations` (required array, min 1, max 100)
  - each item:
    - `type`: `pincode | city | state | area | coordinates`
    - `from`, `to` format depends on type

Example:

```bash
curl -X POST "https://ops.subsolution.in/api/v1/geography/distance/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "calculations": [
      {"type":"pincode","from":"110001","to":"400001"},
      {"type":"coordinates","from":{"latitude":28.6139,"longitude":77.2090},"to":{"latitude":19.0760,"longitude":72.8777}}
    ]
  }'
```

---

## Distance Response Fields (Success)

Distance APIs return `data` containing:

- identifiers (`fromPincode`, `toPincode`, or `fromCityId`, etc.)
- source + destination location objects
- `distance` (kilometers)
- `distanceMiles`
- `calculationMethod` (`haversine`)
- `cached` (boolean)

Batch endpoint returns:

- `totalRequests`
- `successCount`
- `failureCount`
- `results[]` with per-item `success`, `type`, and `result` or `error`

---

## Gateway Routing Notes (for backend devs)

- `/api/v1/geography/*` is proxied from API Gateway to partner-service geography routes.
- `/api/v1/pincodes/search` is kept only for deprecation window and should not be used for new integrations.
- Partner service is not intended for direct external access; call through API Gateway.
