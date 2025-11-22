<div align="center">

# 🌊 TellTide

<p align="center">
  <em style="color: #6c757d; font-style: italic;">Stay early. Stay safe in the dark forest.</em>
</p>

**Detect aggregated blockchain events and get notified before it's too late.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQD](https://img.shields.io/badge/Powered_by-SQD-purple)](https://sqd.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## What is TellTide?

TellTide monitors **Morpho Markets** and **ERC4626 vaults** across **Ethereum and Base** and alerts you when **aggregated conditions** are met. Instead of tracking individual transactions, subscribe to meaningful signals like:

- 🚨 "Alert when net withdrawals from Morpho markets exceed 1M USDC in 1 hour" (supply - withdraw)
- 📊 "Notify when net borrows across 4 markets exceed $500K in 30 minutes" (borrow - repay)
- 🔔 "Trigger when specific Morpho market has net supply drop below -100K USDC"
- 🐋 "Track whale activity: alert when net withdrawals from vault exceed threshold"
- ⚡ "Monitor market liquidity: detect when net borrows spike in short timeframes"

Perfect for monitoring DeFi protocols, tracking market flows, and detecting unusual on-chain activity in Morpho and ERC4626 vaults.

## Key Features

- ⚡ **Real-time Indexing** - Uses SQD Pipes SDK to index Morpho market events and ERC4626 vault events
- 🎯 **Net Flow Detection** - Track net supply/withdraw and net borrow/repay across markets and vaults
- 📊 **Meta-Event Detection** - Create conditions on rolling time windows with aggregations (sum, avg, count, etc.)
- 🔗 **Webhook Notifications** - Automatic HTTP POST to your endpoint with retry logic
- 🏦 **Multi-Market Support** - Monitor multiple Morpho markets and vaults simultaneously

## Architecture

```
Ethereum + Base Blockchains (Morpho Markets + ERC4626 Vaults)
         ↓
    SQD Portal API (fast historical data)
         ↓
  TellTide Indexer (Morpho + ERC4626 events)
         ↓
    PostgreSQL Database (events with market_id)
         ↓
  Detection Worker (net flow calculations every 30s)
         ↓
   Your Webhook URL 🎯
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- pnpm

### Installation

**1. Clone and install:**
```bash
pnpm install
```

**2. Start PostgreSQL:**
```bash
docker compose up -d
```

**3. Setup environment:**
```bash
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

**4. Run database migrations:**
```bash
pnpm db:migrate
```

**5. Start all services:**
```bash
# Start everything (indexer + worker + api)
pnpm dev

# OR start individually in separate terminals:
pnpm indexer  # Terminal 1
pnpm worker   # Terminal 2
pnpm api      # Terminal 3
```

**Services running:**
- 📡 API: http://localhost:3000
- 🔍 Indexer: Indexing ERC20 + ERC4626 events
- ⚙️ Worker: Checking subscriptions every 30s

**6. (Optional) Insert example subscriptions:**

Quickly create example meta-event subscriptions for testing:
```bash
# Edit src/db/insert-subscriptions.ts first:
# - Set your webhook.site URL
# - Update contract addresses to real vaults/tokens

pnpm db:insert-subs
```

---

## 📖 Usage

### Create a Subscription

**Example 1: Net Withdrawal Alert for Morpho Market**

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "Morpho Market Net Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "ethereum",
      "type": "net_aggregate",
      "event_type": "morpho_supply",
      "positive_event_type": "morpho_supply",
      "negative_event_type": "morpho_withdraw",
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

**This triggers when**: Net withdrawals (supply - withdraw) from the specific Morpho market exceed 1M USDC in 1 hour (negative value means more withdrawals than supply). Won't send another notification for 5 minutes after triggering.

**Example 2: Net Borrow Alert Across Multiple Markets**

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "bob",
    "name": "High Net Borrow Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 10,
    "meta_event_config": {
      "chain": "ethereum",
      "type": "net_aggregate",
      "event_type": "morpho_borrow",
      "positive_event_type": "morpho_borrow",
      "negative_event_type": "morpho_repay",
      "contracts": [
        "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
      ],
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

**This triggers when**: Net borrows (borrow - repay) across the Morpho contract exceed 500K USDC in 30 minutes.

### Example Use Cases

**1. Monitor Net Supply Drop in Morpho Market**
```json
{
  "chain": "ethereum",
  "type": "net_aggregate",
  "event_type": "morpho_supply",
  "positive_event_type": "morpho_supply",
  "negative_event_type": "morpho_withdraw",
  "market_id": "0x58e212060645d18eab6d9b2af3d56fbc906a92ff5667385f616f662c70372284",
  "window": "1h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": "<",
    "value": -100000000000
  }
}
```
Triggers when net supply (supply - withdraw) drops below -100K USDC in 1 hour for a specific Morpho market. Detects rapid liquidity exits.

**2. Track Net Borrow Spike Across Multiple Morpho Markets**
```json
{
  "chain": "ethereum",
  "type": "net_aggregate",
  "event_type": "morpho_borrow",
  "positive_event_type": "morpho_borrow",
  "negative_event_type": "morpho_repay",
  "contracts": ["0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"],
  "window": "30m",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 500000000000
  }
}
```
Triggers when net borrows (borrow - repay) exceed 500K USDC in 30 minutes across all markets in the Morpho contract.

**3. Monitor Net Withdrawals from ERC4626 Vault**
```json
{
  "chain": "ethereum",
  "type": "net_aggregate",
  "event_type": "erc4626_deposit",
  "positive_event_type": "erc4626_deposit",
  "negative_event_type": "erc4626_withdraw",
  "contract_address": "0xVaultAddress...",
  "window": "2h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": "<",
    "value": -1000000000000
  }
}
```
Triggers when net deposits (deposits - withdrawals) drop below -1M USDC in 2 hours. Monitors vault outflows.

**4. Track High Supply Activity in Specific Morpho Market (Base)**
```json
{
  "chain": "base",
  "type": "rolling_aggregate",
  "event_type": "morpho_supply",
  "contract_address": "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  "market_id": "0x...",
  "window": "15m",
  "lookback_blocks": 450,
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 100000000000
  }
}
```
Triggers when total supply to a Morpho market exceeds 100K USDC in last 450 blocks on Base (~15 minutes with 2s blocks). Using `lookback_blocks` makes queries more efficient.

### Webhook Payload

When triggered, your webhook receives:

```json
{
  "subscription_id": "uuid",
  "subscription_name": "High Vault Withdrawal Alert",
  "triggered_at": "2025-11-22T10:30:00.000Z",
  "meta_event": {
    "type": "rolling_aggregate",
    "condition_met": true,
    "aggregated_value": 1500000000000,
    "threshold": 1000000000000,
    "window": "2h",
    "triggered_by_contract": "0xVaultB..."
  }
}
```

---

## 📡 API Reference

**Base URL:** `http://localhost:3000`

### Subscriptions
- `POST /api/subscriptions` - Create a new meta-event subscription
- `GET /api/subscriptions` - List all subscriptions
- `GET /api/subscriptions/:id` - Get subscription details
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions/:id/notifications` - Get notification history

### Health
- `GET /health` - Health check endpoint

**Full API Documentation:** See [ARCHITECTURE.md](./ARCHITECTURE.md#4-rest-api-srcapi) for complete request/response formats and examples.

---

## ⚙️ Configuration

Key environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/telltide` |
| `API_PORT` | API server port | `3000` |
| `WORKER_INTERVAL_SECONDS` | How often to check subscriptions | `30` |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint for getting current block | `https://eth.llamarpc.com` |
| `BASE_RPC_URL` | Base RPC endpoint for getting current block | `https://mainnet.base.org` |
| `INDEXER_MAX_LOOKBACK_BLOCKS` | Max blocks back from chain head | `10000` |
| `INDEXER_ENABLED_CHAINS` | Comma-separated list of chains to index | `ethereum,base` |

**Note on indexing:** The indexer **dynamically** calculates the start block on every startup by fetching the current blockchain head via RPC and going back `MAX_LOOKBACK_BLOCKS`. This ensures you always have recent data without manual configuration. Duplicate events are automatically skipped.

---

## 🛠️ Development

### Insert Example Subscriptions
Quickly create example subscriptions for testing:

```bash
pnpm db:insert-subs
```

This creates example meta-event subscriptions. Edit the script first to set your webhook URL and enable the subscriptions you want.

### Clean Database
Delete all data without destroying the database schema:

```bash
pnpm db:clean
```

This removes all events, subscriptions, notifications, and resets the indexer cursor. Useful for testing from a clean slate.

### Reset Database (Full Reset)
```bash
docker compose down -v
docker compose up -d
pnpm db:migrate
```

### Connect to PostgreSQL
```bash
docker exec -it telltide-postgres psql -U postgres -d telltide
```

### Test Webhooks
Use [webhook.site](https://webhook.site) to get a test webhook URL.

---

## 📋 Supported Event Types

### Morpho Market Events
- `morpho_supply` - Morpho market supply events (market_id, caller, onBehalf, assets, shares)
- `morpho_withdraw` - Morpho market withdraw events (market_id, caller, onBehalf, receiver, assets, shares)
- `morpho_borrow` - Morpho market borrow events (market_id, caller, onBehalf, receiver, assets, shares)
- `morpho_repay` - Morpho market repay events (market_id, caller, onBehalf, assets, shares)

### ERC4626 Vault Events
- `erc4626_deposit` - ERC4626 vault deposits (sender, owner, assets, shares)
- `erc4626_withdraw` - ERC4626 vault withdrawals (sender, receiver, owner, assets, shares)

### ERC20 Events
- `erc20_transfer` - ERC20 Transfer events (from, to, value)

## 🎯 Meta-Event Types

- **`event_count`** - Count events in time window
- **`rolling_aggregate`** - Aggregate field values (sum, avg, min, max) in time window
- **`net_aggregate`** - Calculate net flow: positive events - negative events (e.g., supply - withdraw, borrow - repay)

## ⏱️ Time Windows

Supported formats: `15m`, `1h`, `2h`, `24h`, `7d`, etc.

---

## 📚 Documentation

- **[README.md](./README.md)** - Quick start guide and overview (you are here!)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete technical reference, API docs, and AI context

---

## 🤝 Contributing

This is a hackathon project. Contributions welcome!

## 📄 License

ISC

---

<div align="center">
  <sub>Built with SQD Pipes SDK | Powered by PostgreSQL | Made for the dark forest 🌲</sub>
</div>
