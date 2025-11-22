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

TellTide monitors ERC20 transfers and ERC4626 vault events (deposits/withdrawals) across **Ethereum and Base** and alerts you when **aggregated conditions** are met. Instead of tracking individual transactions, subscribe to meaningful signals like:

- 🚨 "Alert when total withdrawals from any of these 3 vaults exceed 1M USDC in 2 hours"
- 📊 "Notify when more than 50 USDC transfers occur in 15 minutes"
- 🔔 "Trigger when Base vault has high deposit activity in last 300 blocks"
- 🐋 "Track whale movements across Ethereum mainnet"

Perfect for monitoring DeFi protocols, tracking whale movements, and detecting unusual on-chain activity.

## Key Features

- ⚡ **Real-time Indexing** - Uses SQD Pipes SDK to index ERC20 and ERC4626 events
- 🌐 **Multi-Chain Support** - Ethereum Mainnet + Base Mainnet
- 🎯 **Meta-Event Detection** - Create conditions on rolling time windows with aggregations (sum, avg, count, etc.)
- 📦 **Block-Based Lookback** - Efficient queries using recent blocks instead of time windows
- 🔗 **Webhook Notifications** - Automatic HTTP POST to your endpoint with retry logic
- ⏱️ **Cooldown Control** - Per-subscription cooldown periods to prevent notification spam
- 🗃️ **PostgreSQL Storage** - Efficient event storage with time-based queries
- 🔧 **Simple REST API** - Easy subscription management

## Architecture

```
Ethereum + Base Blockchains (ERC20 + ERC4626)
         ↓
    SQD Portal API (fast historical data)
         ↓
  TellTide Indexer (dynamic lookback)
         ↓
    PostgreSQL Database (chain-tagged events)
         ↓
  Detection Worker (checks every 30s)
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

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "High Vault Withdrawal Alert",
    "webhook_url": "https://webhook.site/your-unique-url",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "ethereum",
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contracts": [
        "0xVaultA...",
        "0xVaultB...",
        "0xVaultC..."
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

**This triggers when**: Any of the 3 vaults on Ethereum has total withdrawals exceeding 1M USDC (assuming 6 decimals) in the last 2 hours. Won't send another notification for 5 minutes after triggering.

### Example Use Cases

**1. Monitor ERC20 Transfer Spike on Ethereum**
```json
{
  "chain": "ethereum",
  "type": "event_count",
  "event_type": "erc20_transfer",
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "window": "15m",
  "condition": {
    "operator": ">",
    "value": 50
  }
}
```
Triggers when USDC has more than 50 transfers in 15 minutes on Ethereum.

**2. Track Deposits to Specific Vault on Base**
```json
{
  "chain": "base",
  "type": "rolling_aggregate",
  "event_type": "erc4626_deposit",
  "contract_address": "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183",
  "window": "1h",
  "lookback_blocks": 300,
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 10000000000
  }
}
```
Triggers when total deposits exceed 10K tokens in 1 hour on Base. Uses last 300 blocks (~10 min on Base).

**3. Monitor Withdrawals from ANY of Multiple Vaults**
```json
{
  "chain": "ethereum",
  "type": "rolling_aggregate",
  "event_type": "erc4626_withdraw",
  "contracts": ["0xVault1...", "0xVault2...", "0xVault3..."],
  "window": "2h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 1000000000000
  }
}
```
Triggers when ANY of the 3 vaults exceeds 1M USDC withdrawn in 2 hours.

**4. Use Block-Based Lookback for Efficiency (Base)**
```json
{
  "chain": "base",
  "type": "event_count",
  "event_type": "erc20_transfer",
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "window": "1m",
  "lookback_blocks": 300,
  "condition": {
    "operator": ">",
    "value": 5
  }
}
```
Triggers when USDC has more than 5 transfers in the last 300 blocks on Base (~10 minutes with 2s blocks). Using `lookback_blocks` makes queries more efficient by scanning recent blocks instead of time ranges.

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

**Full API Documentation:** See [API.md](./API.md) for complete endpoint documentation, request/response formats, and examples.

**Quick Overview:**

### Subscriptions
- `POST /api/subscriptions` - Create a new meta-event subscription
- `GET /api/subscriptions` - List all subscriptions
- `GET /api/subscriptions/:id` - Get subscription details
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions/:id/notifications` - Get notification history

### Health
- `GET /health` - Health check endpoint

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

- `erc20_transfer` - ERC20 Transfer events (from, to, value)
- `erc4626_deposit` - ERC4626 vault deposits (sender, owner, assets, shares)
- `erc4626_withdraw` - ERC4626 vault withdrawals (sender, receiver, owner, assets, shares)

## 🎯 Meta-Event Types

- **`event_count`** - Count events in time window
- **`rolling_aggregate`** - Aggregate field values (sum, avg, min, max) in time window

## ⏱️ Time Windows

Supported formats: `15m`, `1h`, `2h`, `24h`, `7d`, etc.

---

## 📚 Documentation

- **[API.md](./API.md)** - Complete API documentation with all endpoints, request/response formats, and examples
- **README.md** - Project overview and quick start guide (you are here!)

---

## 🤝 Contributing

This is a hackathon project. Contributions welcome!

## 📄 License

ISC

---

<div align="center">
  <sub>Built with SQD Pipes SDK | Powered by PostgreSQL | Made for the dark forest 🌲</sub>
</div>
