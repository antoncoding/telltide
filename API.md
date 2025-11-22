# 🌊 TellTide API Documentation

Complete API reference for TellTide meta-event detection and webhook notification system.

**Base URL:** `http://localhost:3000` (default development)

---

## Table of Contents

- [Authentication](#authentication)
- [Subscriptions API](#subscriptions-api)
- [Health Check](#health-check)
- [Data Types](#data-types)
- [Error Responses](#error-responses)

---

## Authentication

Currently, TellTide does not require authentication. This is intended for hackathon/demo purposes. In production, you should add API keys or OAuth authentication.

---

## Subscriptions API

Manage meta-event subscriptions and receive webhook notifications when conditions are met.

### Create Subscription

Create a new meta-event subscription.

**Endpoint:** `POST /api/subscriptions`

**Request Body:**

```json
{
  "user_id": "string",
  "name": "string",
  "webhook_url": "string (valid URL)",
  "meta_event_config": {
    "type": "rolling_aggregate" | "event_count",
    "event_type": "erc20_transfer" | "erc4626_deposit" | "erc4626_withdraw",
    "contract_address": "string (optional, 0x-prefixed address)",
    "contracts": ["string[]"] (optional, multiple addresses for OR logic),
    "from_address": "string (optional, filter transfers FROM address)",
    "to_address": "string (optional, filter transfers TO address)",
    "window": "string (e.g., '1h', '15m', '24h')",
    "aggregation": "sum" | "avg" | "min" | "max" (required for rolling_aggregate),
    "field": "string (required for rolling_aggregate, e.g., 'assets', 'value')",
    "condition": {
      "operator": ">" | "<" | ">=" | "<=" | "=" | "!=",
      "value": number
    }
  }
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "user_id": "string",
  "name": "string",
  "webhook_url": "string",
  "meta_event_config": { ... },
  "is_active": true,
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "High Vault Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contracts": [
        "0x1234567890123456789012345678901234567890",
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
      ],
      "window": "2h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 1000000000000
      }
    }
  }'
```

---

### List Subscriptions

Get all subscriptions, optionally filtered by user ID.

**Endpoint:** `GET /api/subscriptions`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | No | Filter subscriptions by user ID |

**Response:** `200 OK`

```json
[
  {
    "id": "uuid",
    "user_id": "string",
    "name": "string",
    "webhook_url": "string",
    "meta_event_config": { ... },
    "is_active": boolean,
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  }
]
```

**Example:**

```bash
# Get all subscriptions
curl http://localhost:3000/api/subscriptions

# Get subscriptions for a specific user
curl http://localhost:3000/api/subscriptions?user_id=alice
```

---

### Get Subscription

Get a specific subscription by ID.

**Endpoint:** `GET /api/subscriptions/:id`

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "user_id": "string",
  "name": "string",
  "webhook_url": "string",
  "meta_event_config": { ... },
  "is_active": boolean,
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Error Responses:**
- `404 Not Found` - Subscription not found

**Example:**

```bash
curl http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000
```

---

### Update Subscription

Update an existing subscription.

**Endpoint:** `PATCH /api/subscriptions/:id`

**Request Body:**

All fields are optional. Only provide fields you want to update.

```json
{
  "name": "string (optional)",
  "webhook_url": "string (optional)",
  "meta_event_config": { ... } (optional),
  "is_active": boolean (optional)
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "user_id": "string",
  "name": "string",
  "webhook_url": "string",
  "meta_event_config": { ... },
  "is_active": boolean,
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

**Example:**

```bash
# Pause a subscription
curl -X PATCH http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Update webhook URL
curl -X PATCH http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"webhook_url": "https://new-webhook.site/url"}'
```

---

### Delete Subscription

Delete a subscription permanently.

**Endpoint:** `DELETE /api/subscriptions/:id`

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - Subscription not found

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000
```

---

### Get Notification History

Get webhook notification history for a subscription.

**Endpoint:** `GET /api/subscriptions/:id/notifications`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results to return (default: 50, max: 100) |

**Response:** `200 OK`

```json
[
  {
    "id": "uuid",
    "subscription_id": "uuid",
    "triggered_at": "ISO 8601 timestamp",
    "payload": {
      "subscription_id": "uuid",
      "subscription_name": "string",
      "triggered_at": "ISO 8601 timestamp",
      "meta_event": { ... }
    },
    "webhook_response_status": 200,
    "retry_count": 0,
    "created_at": "ISO 8601 timestamp"
  }
]
```

**Example:**

```bash
# Get last 50 notifications
curl http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000/notifications

# Get last 10 notifications
curl http://localhost:3000/api/subscriptions/123e4567-e89b-12d3-a456-426614174000/notifications?limit=10
```

---

## Health Check

Check if the API server is running.

**Endpoint:** `GET /health`

**Response:** `200 OK`

```json
{
  "status": "ok",
  "service": "TellTide",
  "timestamp": "ISO 8601 timestamp"
}
```

**Example:**

```bash
curl http://localhost:3000/health
```

---

## Data Types

### Event Types

#### ERC20 Transfer

```json
{
  "event_type": "erc20_transfer",
  "data": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000"
  }
}
```

#### ERC4626 Deposit

```json
{
  "event_type": "erc4626_deposit",
  "data": {
    "sender": "0x...",
    "owner": "0x...",
    "assets": "1000000000000",
    "shares": "1000000000000"
  }
}
```

#### ERC4626 Withdraw

```json
{
  "event_type": "erc4626_withdraw",
  "data": {
    "sender": "0x...",
    "receiver": "0x...",
    "owner": "0x...",
    "assets": "1000000000000",
    "shares": "1000000000000"
  }
}
```

### Meta-Event Config Types

#### Event Count

Triggers when the number of events in a time window meets a condition.

```json
{
  "type": "event_count",
  "event_type": "erc20_transfer",
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "window": "15m",
  "condition": {
    "operator": ">",
    "value": 100
  }
}
```

**Triggers when:** More than 100 transfers occur in 15 minutes.

#### Rolling Aggregate

Triggers when an aggregated field value in a time window meets a condition.

```json
{
  "type": "rolling_aggregate",
  "event_type": "erc4626_withdraw",
  "contract_address": "0x...",
  "window": "2h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 1000000000000
  }
}
```

**Triggers when:** Total withdrawn assets exceed 1M USDC in 2 hours.

**Aggregation Types:**
- `sum` - Total of all values
- `avg` - Average of all values
- `min` - Minimum value
- `max` - Maximum value

**Fields:**
- For ERC20: `value`
- For ERC4626: `assets` or `shares`

### Multi-Contract Monitoring

Monitor ANY of multiple contracts (OR logic):

```json
{
  "type": "rolling_aggregate",
  "event_type": "erc4626_withdraw",
  "contracts": [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333"
  ],
  "window": "1h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 500000000000
  }
}
```

**Triggers when:** ANY of the 3 vaults exceeds 500K USDC withdrawn in 1 hour.

### Address Filtering

Filter events by sender/receiver addresses:

```json
{
  "type": "rolling_aggregate",
  "event_type": "erc20_transfer",
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "from_address": "0x123...",  // Track specific sender
  "window": "24h",
  "aggregation": "sum",
  "field": "value",
  "condition": {
    "operator": ">",
    "value": 5000000000000
  }
}
```

**Triggers when:** Whale address sends more than 5M USDC in 24 hours.

### Time Windows

Supported time window formats:

- Minutes: `1m`, `5m`, `15m`, `30m`
- Hours: `1h`, `2h`, `6h`, `12h`, `24h`
- Days: `1d`, `7d`

### Webhook Payload

When a meta-event triggers, your webhook receives:

```json
{
  "subscription_id": "uuid",
  "subscription_name": "string",
  "triggered_at": "ISO 8601 timestamp",
  "meta_event": {
    "type": "rolling_aggregate" | "event_count",
    "condition_met": true,
    "aggregated_value": number (for rolling_aggregate),
    "threshold": number,
    "window": "string",
    "triggered_by_contract": "0x..." (if using multiple contracts)
  }
}
```

**Webhook Requirements:**
- Must respond with 2xx status code
- Timeout: 10 seconds
- Retries: 3 attempts with exponential backoff
- User-Agent: `TellTide-Webhook/1.0`

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| `200 OK` | Request successful |
| `201 Created` | Resource created successfully |
| `204 No Content` | Resource deleted successfully |
| `400 Bad Request` | Invalid request body or parameters |
| `404 Not Found` | Resource not found |
| `500 Internal Server Error` | Server error |

### Common Error Examples

**Invalid Request Body:**
```json
{
  "error": "Validation error: invalid event_type"
}
```

**Resource Not Found:**
```json
{
  "error": "Not found"
}
```

**Invalid Contract Address:**
```json
{
  "error": "Validation error: contract_address must be a valid 0x-prefixed address"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. In production, consider implementing rate limits based on:
- Requests per minute per user
- Webhook notification frequency
- Event query result sizes

---

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

---

<div align="center">
  <sub>Built with SQD Pipes SDK | Powered by PostgreSQL | Made for the dark forest 🌲</sub>
</div>
