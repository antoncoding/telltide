# TellTide API Interface Documentation

**Base URL:** `http://localhost:3001`

---

## 🔥 Quick Start - Copy & Paste These!

### 1. Morpho Net Withdrawal Alert (Base - USDC/cbBTC)
```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Morpho Net Withdrawal Alert",
    "webhook_url": "https://webhook.site/YOUR-UNIQUE-URL",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "base",
      "type": "net_aggregate",
      "event_type": "morpho_supply",
      "positive_event_type": "morpho_supply",
      "negative_event_type": "morpho_withdraw",
      "market_id": "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": "<",
        "value": -1000000
      }
    }
  }'
```

### 2. USDC Transfer Spike (Ethereum)
```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "USDC Transfer Spike",
    "webhook_url": "https://webhook.site/YOUR-UNIQUE-URL",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "ethereum",
      "type": "event_count",
      "event_type": "erc20_transfer",
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "window": "5m",
      "condition": {
        "operator": ">",
        "value": 10
      }
    }
  }'
```

### 3. Morpho Supply Count (Base)
```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Supply Event Count",
    "webhook_url": "https://webhook.site/YOUR-UNIQUE-URL",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "base",
      "type": "event_count",
      "event_type": "morpho_supply",
      "market_id": "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836",
      "window": "15m",
      "condition": {
        "operator": ">",
        "value": 2
      }
    }
  }'
```

**Steps:**
1. Get webhook URL from [webhook.site](https://webhook.site)
2. Replace `YOUR-UNIQUE-URL` in examples above
3. Run curl command
4. Check response for subscription ID

---

## Verify It Worked

```bash
# List all subscriptions
curl http://localhost:3001/api/subscriptions?user_id=demo-user

# Check health
curl http://localhost:3001/health

# View notifications for a subscription
curl http://localhost:3001/api/subscriptions/{SUBSCRIPTION_ID}/notifications
```

---

## Event Types

**Morpho Markets** (no `contract_address` needed - auto-injected!)
- `morpho_supply` - Supply to market
- `morpho_withdraw` - Withdraw from market
- `morpho_borrow` - Borrow from market
- `morpho_repay` - Repay loan

**ERC4626 Vaults**
- `erc4626_deposit` - Vault deposits
- `erc4626_withdraw` - Vault withdrawals

**ERC20**
- `erc20_transfer` - Token transfers

---

## Meta-Event Types

**1. event_count** - Count events
```json
{
  "type": "event_count",
  "event_type": "morpho_supply",
  "window": "15m",
  "condition": { "operator": ">", "value": 5 }
}
```

**2. rolling_aggregate** - Sum/avg/min/max a field
```json
{
  "type": "rolling_aggregate",
  "event_type": "morpho_supply",
  "aggregation": "sum",
  "field": "assets",
  "window": "1h",
  "condition": { "operator": ">", "value": 1000000 }
}
```

**3. net_aggregate** - Calculate net flow (positive - negative)
```json
{
  "type": "net_aggregate",
  "event_type": "morpho_supply",
  "positive_event_type": "morpho_supply",
  "negative_event_type": "morpho_withdraw",
  "aggregation": "sum",
  "field": "assets",
  "window": "1h",
  "condition": { "operator": "<", "value": -1000000 }
}
```

---

## Config Options

```typescript
{
  user_id: string;
  name: string;
  webhook_url: string;
  cooldown_minutes?: number; // default: 1
  meta_event_config: {
    // Required
    type: "event_count" | "rolling_aggregate" | "net_aggregate";
    event_type: EventType;
    window: string; // "15m", "1h", "2h", "24h"
    condition: {
      operator: ">" | "<" | ">=" | "<=" | "=" | "!=";
      value: number;
    };

    // Optional filters
    chain?: "ethereum" | "base";
    market_id?: string; // For Morpho (bytes32)
    contract_address?: string; // Single address
    contracts?: string[]; // Multiple addresses (OR logic)
    from_address?: string;
    to_address?: string;
    lookback_blocks?: number; // Use blocks instead of time

    // For aggregates
    aggregation?: "sum" | "avg" | "min" | "max";
    field?: "assets" | "value" | "shares";

    // For net_aggregate
    positive_event_type?: EventType;
    negative_event_type?: EventType;
  };
}
```

---

## Other Endpoints

```bash
# Update subscription
curl -X PATCH http://localhost:3001/api/subscriptions/{ID} \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Delete subscription
curl -X DELETE http://localhost:3001/api/subscriptions/{ID}
```

---

## Troubleshooting

**No subscriptions showing?**
- Check: `curl http://localhost:3001/api/subscriptions?user_id=demo-user`

**Subscription not triggering?**
- Lower threshold (e.g., `value: 1`)
- Check worker logs for check results
- Verify indexer is running and Base events are indexed

**Connection refused?**
- Verify API is running: `pnpm api`
- Check port in `.env` file

---

**Market ID Used in Examples:**
`0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836` (USDC/cbBTC on Base)
