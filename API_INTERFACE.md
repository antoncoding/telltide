# TellTide API Interface Documentation

**Base URL:** `http://localhost:3000`

---

## Quick Reference

### Endpoints
- `GET /health` - Health check
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions` - List all subscriptions
- `GET /api/subscriptions?user_id=alice` - List user's subscriptions
- `GET /api/subscriptions/:id` - Get subscription details
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions/:id/notifications?limit=50` - Get notification history

---

## Event Types

### Morpho Market Events
```typescript
"morpho_supply"      // Supply liquidity to Morpho market
"morpho_withdraw"    // Withdraw liquidity from Morpho market
"morpho_borrow"      // Borrow from Morpho market
"morpho_repay"       // Repay loan to Morpho market
```

**Morpho Contract Address (Both Chains):**
```
0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb
```

**✨ IMPORTANT:** The system automatically uses the Morpho contract address for all Morpho events. **You do NOT need to specify `contract_address` when creating subscriptions for Morpho events** - it's automatically injected! Just specify the `event_type` (e.g., `morpho_supply`) and optionally filter by `market_id`.

**Event Data Structure:**
```json
{
  "market_id": "0x58e212060645d18eab6d9b2af3d56fbc906a92ff5667385f616f662c70372284",
  "caller": "0x...",
  "onBehalf": "0x...",
  "receiver": "0x...",
  "assets": "1000000000000",
  "shares": "1000000000000"
}
```

### ERC4626 Vault Events
```typescript
"erc4626_deposit"    // Deposit to vault
"erc4626_withdraw"   // Withdraw from vault
```

### ERC20 Events
```typescript
"erc20_transfer"     // Token transfer
```

---

## Meta-Event Types

### 1. Event Count
Count events in time window
```typescript
{
  type: "event_count"
}
```

### 2. Rolling Aggregate
Sum/avg/min/max field values
```typescript
{
  type: "rolling_aggregate"
  aggregation: "sum" | "avg" | "min" | "max"
  field: "assets" | "value" | "shares"
}
```

### 3. Net Aggregate ⭐ NEW
Calculate net flow (positive - negative)
```typescript
{
  type: "net_aggregate"
  positive_event_type: EventType
  negative_event_type: EventType
  aggregation: "sum" | "avg" | "min" | "max"
  field: "assets" | "value" | "shares"
}
```

**Common Patterns:**
- **Net Supply**: `morpho_supply - morpho_withdraw`
- **Net Borrow**: `morpho_borrow - morpho_repay`
- **Net Vault Flow**: `erc4626_deposit - erc4626_withdraw`

---

## Create Subscription Request

### TypeScript Interface

```typescript
interface CreateSubscriptionRequest {
  user_id: string;
  name: string;
  webhook_url: string;
  cooldown_minutes?: number;
  meta_event_config: MetaEventConfig;
}

interface MetaEventConfig {
  // Meta-event type
  type: "event_count" | "rolling_aggregate" | "net_aggregate";

  // Event type
  event_type:
    | "erc20_transfer"
    | "erc4626_deposit"
    | "erc4626_withdraw"
    | "morpho_supply"
    | "morpho_withdraw"
    | "morpho_borrow"
    | "morpho_repay";

  // Optional filters
  chain?: "ethereum" | "base";
  contracts?: string[];              // Array of addresses (OR logic)
  contract_address?: string;         // Single address
  market_id?: string;                // Morpho market ID (bytes32)
  from_address?: string;
  to_address?: string;

  // Time window
  window: string;                    // "15m", "1h", "2h", "24h", "7d"
  lookback_blocks?: number;          // Use blocks instead of time

  // Aggregation (for rolling_aggregate and net_aggregate)
  aggregation?: "sum" | "avg" | "min" | "max" | "count";
  field?: string;                    // "assets", "value", "shares"

  // Net aggregate specific
  positive_event_type?: EventType;   // e.g., "morpho_supply"
  negative_event_type?: EventType;   // e.g., "morpho_withdraw"

  // Condition
  condition: {
    operator: ">" | "<" | ">=" | "<=" | "=" | "!=";
    value: number | string;
  };
}
```

---

## Example: Morpho Net Supply Alert

### Detect Net Withdrawals from Specific Market

**Scenario:** Alert when net supply (supply - withdraw) drops below -1M USDC in 1 hour

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "Morpho Market Net Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "type": "net_aggregate",
      "event_type": "morpho_supply",
      "positive_event_type": "morpho_supply",
      "negative_event_type": "morpho_withdraw",
      "chain": "ethereum",
      "market_id": "0x58e212060645d18eab6d9b2af3d56fbc906a92ff5667385f616f662c70372284",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": "<",
        "value": -1000000000000
      }
    }
  }'
```

**Note:** No `contract_address` needed - automatically uses Morpho contract!

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "alice",
  "name": "Morpho Market Net Withdrawal Alert",
  "webhook_url": "https://webhook.site/your-unique-url",
  "cooldown_minutes": 5,
  "meta_event_config": {
    "type": "net_aggregate",
    "event_type": "morpho_supply",
    "positive_event_type": "morpho_supply",
    "negative_event_type": "morpho_withdraw",
    "chain": "ethereum",
    "market_id": "0x58e212060645d18eab6d9b2af3d56fbc906a92ff5667385f616f662c70372284",
    "window": "1h",
    "aggregation": "sum",
    "field": "assets",
    "condition": {
      "operator": "<",
      "value": -1000000000000
    }
  },
  "is_active": true,
  "created_at": "2025-11-22T10:30:00.000Z",
  "updated_at": "2025-11-22T10:30:00.000Z"
}
```

---

## Example: Morpho Net Borrow Spike

### Detect High Net Borrowing Activity

**Scenario:** Alert when net borrows (borrow - repay) exceed 500K USDC in 30 minutes

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "bob",
    "name": "High Net Borrow Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 10,
    "meta_event_config": {
      "type": "net_aggregate",
      "event_type": "morpho_borrow",
      "positive_event_type": "morpho_borrow",
      "negative_event_type": "morpho_repay",
      "chain": "ethereum",
      "window": "30m",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 500000000000
      }
    }
  }'
```

**Note:** No `contract_address` needed - monitors all Morpho markets!

---

## Example: ERC4626 Vault Net Withdrawals

### Monitor Vault Outflows

**Scenario:** Alert when net deposits (deposits - withdrawals) drop below -1M USDC in 2 hours

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "charlie",
    "name": "Vault Net Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 15,
    "meta_event_config": {
      "type": "net_aggregate",
      "event_type": "erc4626_deposit",
      "positive_event_type": "erc4626_deposit",
      "negative_event_type": "erc4626_withdraw",
      "chain": "ethereum",
      "contract_address": "0xYourVaultAddress...",
      "window": "2h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": "<",
        "value": -1000000000000
      }
    }
  }'
```

---

## Example: Simple Supply Count

### Count Supply Events to Market

**Scenario:** Alert when more than 20 supply events occur in 15 minutes

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "david",
    "name": "High Supply Activity",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_supply",
      "chain": "ethereum",
      "market_id": "0x58e212060645d18eab6d9b2af3d56fbc906a92ff5667385f616f662c70372284",
      "window": "15m",
      "condition": {
        "operator": ">",
        "value": 20
      }
    }
  }'
```

**Note:** No `contract_address` needed!

---

## Example: Total Supply Aggregation

### Sum Total Supply to Market

**Scenario:** Alert when total supply exceeds 100K USDC in 1 hour

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "eve",
    "name": "Large Supply Aggregate",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 30,
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "morpho_supply",
      "chain": "ethereum",
      "market_id": "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 100000000000
      }
    }
  }'
```

**Note:** No `contract_address` needed!

---

## Webhook Payload

When a meta-event triggers, your webhook receives:

```json
{
  "subscription_id": "550e8400-e29b-41d4-a716-446655440000",
  "subscription_name": "Morpho Market Net Withdrawal Alert",
  "triggered_at": "2025-11-22T10:30:00.000Z",
  "meta_event": {
    "type": "net_aggregate",
    "condition_met": true,
    "aggregated_value": -1500000000000,
    "threshold": -1000000000000,
    "window": "1h",
    "triggered_by_contract": "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
  }
}
```

---

## Update Subscription

```bash
curl -X PATCH http://localhost:3000/api/subscriptions/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

**Updatable Fields:**
```typescript
{
  name?: string;
  webhook_url?: string;
  meta_event_config?: MetaEventConfig;
  cooldown_minutes?: number;
  is_active?: boolean;
}
```

---

## List Subscriptions

```bash
# List all active subscriptions
curl http://localhost:3000/api/subscriptions

# List user's subscriptions
curl http://localhost:3000/api/subscriptions?user_id=alice
```

---

## Get Notification History

```bash
# Get last 50 notifications (default)
curl http://localhost:3000/api/subscriptions/{id}/notifications

# Get last 10 notifications
curl http://localhost:3000/api/subscriptions/{id}/notifications?limit=10
```

**Response:**
```json
[
  {
    "id": "uuid",
    "subscription_id": "uuid",
    "triggered_at": "2025-11-22T10:30:00.000Z",
    "payload": {
      "subscription_id": "uuid",
      "subscription_name": "Alert name",
      "triggered_at": "2025-11-22T10:30:00.000Z",
      "meta_event": {
        "type": "net_aggregate",
        "condition_met": true,
        "aggregated_value": -1500000000000,
        "threshold": -1000000000000,
        "window": "1h"
      }
    },
    "webhook_response_status": 200,
    "retry_count": 0,
    "created_at": "2025-11-22T10:30:00.000Z"
  }
]
```

---

## Delete Subscription

```bash
curl -X DELETE http://localhost:3000/api/subscriptions/{id}
```

**Response:** 204 No Content

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": {
    "issues": [
      {
        "path": ["meta_event_config", "market_id"],
        "message": "Invalid market_id format"
      }
    ]
  }
}
```

### 404 Not Found
```json
{
  "error": "Subscription not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Important Notes

### Morpho Events
- **Contract Address:** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (same on Ethereum & Base)
- **Market ID Format:** bytes32 hex string (66 chars: `0x` + 64 hex chars)
- Always include `contract_address` when filtering Morpho events

### Net Aggregate
- Returns **positive - negative** value
- Negative results mean net outflow (more withdrawals/repays)
- Positive results mean net inflow (more supply/borrows)

### Time Windows
- Format: `{number}{unit}` where unit is `m` (minutes), `h` (hours), or `d` (days)
- Examples: `15m`, `1h`, `2h`, `24h`, `7d`

### Block-Based Lookback
- More efficient for short windows on chains with consistent block times
- Base: ~2s blocks → 450 blocks ≈ 15 minutes
- Ethereum: ~12s blocks → 300 blocks ≈ 1 hour

### Cooldown
- Prevents notification spam
- Default: 1 minute
- Recommended: 5-15 minutes for production alerts

---

## Testing with webhook.site

1. Visit https://webhook.site
2. Copy your unique URL
3. Use it as `webhook_url` in your subscription
4. Watch real-time webhook deliveries in the browser

---

**Last Updated:** 2025-11-22
**Version:** 1.0 (Morpho + Net Aggregate Support)
