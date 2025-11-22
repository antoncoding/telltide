# 🌊 TellTide Demo Guide

**Stay early. Stay safe in the dark forest.**

---

## 🎯 What is TellTide?

TellTide monitors ERC20 transfers and ERC4626 vault events and sends webhook notifications when **aggregated conditions** are met over time windows.

**Key Features:**
- ✅ Real-time ERC20 + ERC4626 event indexing using SQD Pipes SDK
- ✅ Rolling time window aggregations (sum, avg, count, min, max)
- ✅ Multi-contract monitoring (check ANY of multiple vaults/tokens)
- ✅ Address filtering (track specific whale addresses)
- ✅ Webhook notifications with automatic retry
- ✅ Absolute value conditions only (simple and reliable)

**What's NOT in this version:**
- ❌ No RPC polling or vault state tracking
- ❌ No percentage-based conditions
- ❌ No compound AND/OR conditions

This is a **simplified, production-ready** implementation perfect for hackathon demos!

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate
```

### 2. Configure (Optional)

Edit `.env` if needed:

```env
# Default values work fine for demo
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telltide
API_PORT=3001
RPC_URL=https://eth.llamarpc.com     # Free RPC endpoint
INDEXER_MAX_LOOKBACK_BLOCKS=60000    # ~7 days of historical data
WORKER_INTERVAL_SECONDS=30           # Check every 30s
```

**How indexing works:**
- ✅ **Fully dynamic** - Fetches current blockchain head via RPC on startup
- ✅ **Always recent** - Starts from (current head - MAX_LOOKBACK_BLOCKS)
- ✅ **No manual config** - No need to update start blocks as chain progresses
- ✅ **No cursor tracking** - Fresh index on each restart
- ✅ **Duplicate safe** - Events skipped if already exist (ON CONFLICT DO NOTHING)
- ✅ **Fast startup** - Simple RPC call to get current block (no Portal query needed)

### 3. Start All Services

```bash
# Start everything at once
pnpm dev

# Or start individually in separate terminals:
pnpm indexer  # Indexes blockchain events
pnpm worker   # Checks subscriptions every 30s
pnpm api      # REST API on :3001
```

You'll see:
```
🌊 Starting TellTide Server...

Starting Indexer...
🌊 Starting TellTide Event Indexer...
✅ Database connected

Starting Worker...
🌊 Starting TellTide Meta-Event Worker...
⏱️  Check interval: 30 seconds

Starting API...
🌊 Starting TellTide API Server...
✅ API Server running on http://localhost:3001
```

---

## 📋 Demo Case: "Alert When ANY Vault Has High Withdrawals"

### Step 1: Get a Webhook URL

Go to [webhook.site](https://webhook.site) and copy your unique URL.

### Step 2: Create a Subscription

**Scenario:** Alert when **ANY** of 3 vaults has more than 1M USDC withdrawn in 2 hours.

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "High Vault Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contracts": [
        "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
        "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
        "0x3A1659e4b1f3b1E2F8C4D6D1A9e4E3e9F8F7D6C5"
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

**How it works:**
- Worker checks each vault independently
- If **ANY** vault exceeds 1M USDC withdrawn → triggers webhook
- Response includes `triggered_by_contract` showing which vault

### Step 3: Wait for Detection

The worker checks every 30 seconds. When a condition is met:

```
🔍 Checking active subscriptions...
📋 Found 1 active subscription(s)
🎯 Meta-event triggered for "High Vault Withdrawal Alert"!
   Triggered by contract: 0x83f20f44975d03b1b09e64809b757c47f942beea
📤 Dispatching 1 webhook(s)...
✅ Successful: 1 | ❌ Failed: 0
```

### Step 4: Receive Webhook

Your webhook.site URL receives:

```json
{
  "subscription_id": "123e4567-e89b-12d3-a456-426614174000",
  "subscription_name": "High Vault Withdrawal Alert",
  "triggered_at": "2025-11-22T14:30:00.000Z",
  "meta_event": {
    "type": "rolling_aggregate",
    "condition_met": true,
    "aggregated_value": 1500000000000,
    "threshold": 1000000000000,
    "window": "2h",
    "triggered_by_contract": "0x83f20f44975d03b1b09e64809b757c47f942beea"
  }
}
```

---

## 📊 More Demo Examples

### Example 1: ERC20 Transfer Spike Detection

Alert when USDC has more than 100 transfers in 15 minutes:

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "USDC Transfer Spike",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "erc20_transfer",
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "window": "15m",
      "condition": {
        "operator": ">",
        "value": 100
      }
    }
  }'
```

### Example 2: Whale Tracking (Outflow)

Alert when a specific address transfers out more than 5M USDC in 24 hours:

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Whale Outflow Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc20_transfer",
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "from_address": "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
      "window": "24h",
      "aggregation": "sum",
      "field": "value",
      "condition": {
        "operator": ">",
        "value": 5000000000000
      }
    }
  }'
```

### Example 3: Large Deposit Activity

Alert when total deposits to a vault exceed 2M USDC in 1 hour:

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Large Deposit Activity",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc4626_deposit",
      "contract_address": "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 2000000000000
      }
    }
  }'
```

### Example 4: Average Withdrawal Size

Alert when average withdrawal exceeds 100K USDC in 30 minutes:

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Large Average Withdrawal",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contract_address": "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
      "window": "30m",
      "aggregation": "avg",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 100000000000
      }
    }
  }'
```

### Example 5: Block-Based Lookback (Efficient for Testing)

Alert when USDC has more than 5 transfers in the last 100 blocks (most efficient for recent data):

```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "name": "Recent USDC Activity",
    "webhook_url": "https://webhook.site/your-unique-url",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "erc20_transfer",
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "window": "1m",
      "lookback_blocks": 100,
      "condition": {
        "operator": ">",
        "value": 5
      }
    }
  }'
```

**Why use `lookback_blocks`?**
- 🚀 More efficient queries (scans only 100 blocks instead of all data in time window)
- 🎯 Perfect for testing (quickly see results with recent data)
- 📊 Predictable performance (not dependent on block time variance)
- 💡 Great for small time windows like "1m" or "5m"

---

## 🧪 Testing Workflow

### Quick Test Script

Use the included script to insert example subscriptions:

```bash
# 1. Edit the script and set your webhook URL
code src/db/insert-subscriptions.ts

# 2. Insert subscriptions
pnpm db:insert-subs

# 3. Check they were created
curl http://localhost:3001/api/subscriptions
```

### Manual Testing

```bash
# Check if events are being indexed
curl http://localhost:3001/api/subscriptions

# View logs
# Indexer terminal shows: "✅ Inserted X events"
# Worker terminal shows: "🔍 Checking active subscriptions..."
```

### Database Inspection

```bash
# Connect to database
docker exec -it telltide-postgres psql -U postgres -d telltide

# Check indexed events
SELECT event_type, COUNT(*) FROM events GROUP BY event_type;

# Check subscriptions
SELECT id, name, is_active FROM subscriptions;

# Check notifications sent
SELECT * FROM notifications_log ORDER BY created_at DESC LIMIT 10;
```

---

## ⚙️ How It Works

### Architecture

```
Ethereum Blockchain (ERC20 + ERC4626)
         ↓
   SQD Portal API
         ↓
  TellTide Indexer (stores events in PostgreSQL)
         ↓
    Worker (checks subscriptions every 30s)
         ↓
   Your Webhook URL 🎯
```

### Meta-Event Detection

**Event Count:**
```typescript
// Count USDC transfers in last 15 minutes
SELECT COUNT(*) FROM events
WHERE event_type = 'erc20_transfer'
  AND contract_address = '0xA0b8...'
  AND timestamp >= NOW() - INTERVAL '15 minutes'

// If count > 100 → trigger webhook
```

**Rolling Aggregate:**
```typescript
// Sum withdrawn assets from vault in last 2 hours
SELECT SUM((data->>'assets')::numeric) FROM events
WHERE event_type = 'erc4626_withdraw'
  AND contract_address = '0x83F2...'
  AND timestamp >= NOW() - INTERVAL '2 hours'

// If sum > 1,000,000,000,000 → trigger webhook
```

---

## 🛠️ Development Commands

```bash
# Insert example subscriptions
pnpm db:insert-subs

# Clean all data (keeps schema)
pnpm db:clean

# Full database reset
docker compose down -v
docker compose up -d
pnpm db:migrate

# Check TypeScript errors
npx tsc --noEmit
```

---

## 📋 Supported Features

### Event Types
- `erc20_transfer` - ERC20 Transfer events
- `erc4626_deposit` - ERC4626 vault deposits
- `erc4626_withdraw` - ERC4626 vault withdrawals

### Meta-Event Types
- `event_count` - Count events in time window
- `rolling_aggregate` - Aggregate field values (sum, avg, min, max)

### Aggregations
- `sum` - Total of all values
- `avg` - Average of all values
- `min` - Minimum value
- `max` - Maximum value
- `count` - Use `event_count` type instead

### Time Windows
- Minutes: `1m`, `5m`, `15m`, `30m`
- Hours: `1h`, `2h`, `6h`, `12h`, `24h`
- Days: `1d`, `7d`

### Block-Based Lookback
- Optional `lookback_blocks` field for efficient queries
- Scans only the specified number of recent blocks
- More predictable performance than time-based windows
- Example: `lookback_blocks: 100` checks only the last 100 blocks
- Perfect for testing and small time windows

### Comparison Operators
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `=` - Equal
- `!=` - Not equal

---

## 🐛 Troubleshooting

**Events not being indexed?**
- Check indexer logs for errors
- Verify `INDEXER_START_BLOCK` is recent enough
- Ensure database is running: `docker ps`

**Webhook not firing?**
- Check subscription is active: `GET /api/subscriptions`
- Verify condition threshold is realistic
- Check worker logs: should see "🔍 Checking active subscriptions..."
- Test webhook URL works: visit webhook.site

**Worker not checking?**
- Ensure worker service is running
- Check `WORKER_INTERVAL_SECONDS` in `.env`
- Look for "No active subscriptions found" message

**Database connection errors?**
- Run `docker compose ps` to check PostgreSQL
- Verify `DATABASE_URL` in `.env`
- Try: `docker compose down && docker compose up -d`

---

## 🚀 Production Deployment

**Before deploying:**

1. ✅ Use managed PostgreSQL (AWS RDS, Supabase, etc.)
2. ✅ Set `INDEXER_START_BLOCK` appropriately (recent for faster sync)
3. ✅ Use production webhook endpoints (not webhook.site)
4. ✅ Add authentication to the API
5. ✅ Set up monitoring and logging
6. ✅ Configure proper CORS if needed
7. ✅ Use process manager (PM2) or containerize

---

<div align="center">
  <sub>Built with SQD Pipes SDK | Powered by PostgreSQL | Made for the dark forest 🌲</sub>
</div>
