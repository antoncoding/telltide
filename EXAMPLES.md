# ChaosChain Examples

Real-world examples of meta-event subscriptions for Morpho Blue monitoring.

## Example 1: Whale Withdrawal Alert

Get notified when large withdrawals happen in a specific market.

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "risk_team",
    "name": "Large Withdrawal Alert - USDC Market",
    "webhook_url": "https://your-server.com/alerts/whale",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "morpho_withdraw",
      "market_id": "0x...",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 10000000000000
      }
    }
  }'
```

**Use case**: Risk management teams monitoring for significant capital outflows.

---

## Example 2: Liquidation Cascade Detector

Detect when multiple liquidations occur in quick succession (potential market stress).

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "trading_bot",
    "name": "Liquidation Cascade Alert",
    "webhook_url": "https://trading-bot.example.com/liquidation-alert",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_liquidation",
      "window": "15m",
      "condition": {
        "operator": ">=",
        "value": 5
      }
    }
  }'
```

**Use case**: Trading bots that want to react to market stress events.

---

## Example 3: Supply Surge Monitor

Track when a market sees unusual supply activity (potential yield farming).

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "analytics",
    "name": "Supply Surge - wstETH Market",
    "webhook_url": "https://analytics.example.com/webhooks/supply",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_supply",
      "market_id": "0x...",
      "window": "1h",
      "condition": {
        "operator": ">",
        "value": 50
      }
    }
  }'
```

**Use case**: Analytics platforms tracking capital flows and yield farming trends.

---

## Example 4: Borrow Spike Alert

Detect sudden increases in borrowing activity.

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "market_maker",
    "name": "Borrow Spike Alert",
    "webhook_url": "https://mm-system.example.com/borrow-alert",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "morpho_borrow",
      "window": "30m",
      "aggregation": "count",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 30
      }
    }
  }'
```

**Use case**: Market makers adjusting positions based on borrowing demand.

---

## Example 5: Repayment Velocity Tracker

Monitor repayment activity to gauge market health.

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "protocol_team",
    "name": "High Repayment Activity",
    "webhook_url": "https://protocol-dashboard.example.com/repay",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_repay",
      "window": "2h",
      "condition": {
        "operator": ">=",
        "value": 40
      }
    }
  }'
```

**Use case**: Protocol teams monitoring user behavior and market health.

---

## Example 6: Multi-Market Liquidation Monitor

Monitor liquidations across all markets (no market_id specified).

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "safety_module",
    "name": "Protocol-Wide Liquidation Alert",
    "webhook_url": "https://safety.example.com/critical",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_liquidation",
      "window": "5m",
      "condition": {
        "operator": ">=",
        "value": 3
      }
    }
  }'
```

**Use case**: Protocol safety modules that need to react to systemic risk.

---

## Example 7: Average Withdrawal Size Monitor

Track the average size of withdrawals to detect coordinated exits.

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "research",
    "name": "Large Average Withdrawal Detector",
    "webhook_url": "https://research.example.com/avg-withdraw",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "morpho_withdraw",
      "window": "1h",
      "aggregation": "avg",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 5000000000000
      }
    }
  }'
```

**Use case**: Research teams studying user behavior patterns.

---

## Example 8: Quiet Market Alert (Inverse Condition)

Get notified when activity drops below normal levels.

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "monitoring",
    "name": "Low Activity Alert - USDC Market",
    "webhook_url": "https://ops.example.com/low-activity",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_supply",
      "market_id": "0x...",
      "window": "6h",
      "condition": {
        "operator": "<",
        "value": 5
      }
    }
  }'
```

**Use case**: Operations teams monitoring for potential UI/infrastructure issues.

---

## Combining Multiple Subscriptions

You can create multiple subscriptions to build a comprehensive monitoring system:

```bash
# Script to setup monitoring for a specific market
MARKET_ID="0x..."
WEBHOOK_BASE="https://monitoring.example.com"

# Liquidations
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"market_monitor\",
    \"name\": \"Market ${MARKET_ID:0:8} - Liquidations\",
    \"webhook_url\": \"${WEBHOOK_BASE}/liquidations\",
    \"meta_event_config\": {
      \"type\": \"event_count\",
      \"event_type\": \"morpho_liquidation\",
      \"market_id\": \"${MARKET_ID}\",
      \"window\": \"15m\",
      \"condition\": { \"operator\": \">=\", \"value\": 3 }
    }
  }"

# Large withdrawals
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"market_monitor\",
    \"name\": \"Market ${MARKET_ID:0:8} - Withdrawals\",
    \"webhook_url\": \"${WEBHOOK_BASE}/withdrawals\",
    \"meta_event_config\": {
      \"type\": \"rolling_aggregate\",
      \"event_type\": \"morpho_withdraw\",
      \"market_id\": \"${MARKET_ID}\",
      \"window\": \"1h\",
      \"aggregation\": \"sum\",
      \"field\": \"assets\",
      \"condition\": { \"operator\": \">\", \"value\": 10000000000000 }
    }
  }"

# Supply spikes
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"market_monitor\",
    \"name\": \"Market ${MARKET_ID:0:8} - Supply\",
    \"webhook_url\": \"${WEBHOOK_BASE}/supply\",
    \"meta_event_config\": {
      \"type\": \"event_count\",
      \"event_type\": \"morpho_supply\",
      \"market_id\": \"${MARKET_ID}\",
      \"window\": \"1h\",
      \"condition\": { \"operator\": \">\", \"value\": 40 }
    }
  }"
```

---

## Managing Subscriptions

### List all your subscriptions

```bash
curl http://localhost:3000/api/subscriptions?user_id=risk_team
```

### Get a specific subscription

```bash
curl http://localhost:3000/api/subscriptions/{subscription_id}
```

### Pause a subscription

```bash
curl -X PATCH http://localhost:3000/api/subscriptions/{subscription_id} \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'
```

### Update webhook URL

```bash
curl -X PATCH http://localhost:3000/api/subscriptions/{subscription_id} \
  -H "Content-Type: application/json" \
  -d '{ "webhook_url": "https://new-url.example.com/webhook" }'
```

### Delete a subscription

```bash
curl -X DELETE http://localhost:3000/api/subscriptions/{subscription_id}
```

### View notification history

```bash
curl http://localhost:3000/api/subscriptions/{subscription_id}/notifications?limit=20
```

---

## Querying Raw Events

### Get recent withdrawals

```bash
curl "http://localhost:3000/api/events?event_type=morpho_withdraw&limit=10"
```

### Get events for a specific market

```bash
curl "http://localhost:3000/api/events?market_id=0x...&limit=50"
```

### Get events in a block range

```bash
curl "http://localhost:3000/api/events?from_block=20000000&to_block=20001000"
```

### Get event statistics

```bash
curl http://localhost:3000/api/events/stats
```

Response:
```json
{
  "statistics": [
    {
      "event_type": "morpho_supply",
      "count": "1523",
      "min_block": "20000000",
      "max_block": "20050000",
      "earliest_event": "2025-11-01T10:00:00.000Z",
      "latest_event": "2025-11-22T15:30:00.000Z"
    }
    // ...
  ]
}
```

---

## Testing Your Webhook Handler

Example webhook handler in Node.js/Express:

```javascript
app.post('/webhook', express.json(), (req, res) => {
  const payload = req.body;

  console.log('Meta-event triggered!', {
    subscription: payload.subscription_name,
    type: payload.meta_event.type,
    triggered_at: payload.triggered_at,
    event_count: payload.events.length
  });

  // Your custom logic here
  if (payload.meta_event.type === 'event_count') {
    console.log(`Detected ${payload.meta_event.event_count} events in ${payload.meta_event.window}`);
  }

  // Always respond with 2xx status to acknowledge receipt
  res.status(200).json({ received: true });
});
```

Example webhook handler in Python/Flask:

```python
@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.json

    print(f"Meta-event triggered: {payload['subscription_name']}")
    print(f"Event count: {len(payload['events'])}")

    # Your custom logic here

    return {'received': True}, 200
```
