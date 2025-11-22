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

TellTide monitors ERC20 transfers and ERC4626 vault events (deposits/withdrawals) and alerts you when **aggregated conditions** are met. Instead of tracking individual transactions, subscribe to meaningful signals like:

- 🚨 "Alert when total withdrawals from any of these 3 vaults exceed 1M USDC in 2 hours"
- 📊 "Notify when more than 50 USDC transfers occur in 15 minutes"
- 🔔 "Trigger when average deposit size falls below 10K USDC in 1 hour"

Perfect for monitoring DeFi protocols, tracking whale movements, and detecting unusual on-chain activity.

## Key Features

- ⚡ **Real-time Indexing** - Uses SQD Pipes SDK to index ERC20 and ERC4626 events from Ethereum
- 🎯 **Meta-Event Detection** - Create conditions on rolling time windows with aggregations (sum, avg, count, etc.)
- 🔗 **Webhook Notifications** - Automatic HTTP POST to your endpoint with retry logic
- 🗃️ **PostgreSQL Storage** - Efficient event storage with time-based queries
- 🔧 **Simple REST API** - Easy subscription management

## Architecture

```
Ethereum Blockchain (ERC20 + ERC4626)
         ↓
    SQD Portal API (fast historical data)
         ↓
  TellTide Indexer (stores last 7 days)
         ↓
    PostgreSQL Database
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
    "meta_event_config": {
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

**This triggers when**: Any of the 3 vaults has total withdrawals exceeding 1M USDC (assuming 6 decimals) in the last 2 hours.

### Example Use Cases

**1. Monitor ERC20 Transfer Spike**
```json
{
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
Triggers when USDC has more than 50 transfers in 15 minutes.

**2. Track Deposits to Specific Vault**
```json
{
  "type": "rolling_aggregate",
  "event_type": "erc4626_deposit",
  "contract_address": "0xYourVault...",
  "window": "1h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 10000000000
  }
}
```
Triggers when total deposits exceed 10K USDC (6 decimals) in 1 hour.

**3. Monitor Withdrawals from ANY of Multiple Vaults**
```json
{
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
  },
  "events": [
    {
      "block_number": 20500000,
      "timestamp": "2025-11-22T09:45:00.000Z",
      "event_type": "erc4626_withdraw",
      "contract_address": "0xVaultB...",
      "data": {
        "sender": "0x...",
        "receiver": "0x...",
        "owner": "0x...",
        "assets": "500000000000",
        "shares": "500000000000"
      }
    }
    // ... up to 50 recent events
  ]
}
```

---

## 🔌 API Reference

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/subscriptions` | Create a new subscription |
| `GET` | `/api/subscriptions` | List all subscriptions (filter by `?user_id=`) |
| `GET` | `/api/subscriptions/:id` | Get subscription details |
| `PATCH` | `/api/subscriptions/:id` | Update subscription |
| `DELETE` | `/api/subscriptions/:id` | Delete subscription |
| `GET` | `/api/subscriptions/:id/notifications` | Get notification history |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events` | Query recent events (filter by type, contract, block range) |
| `GET` | `/api/events/stats` | Get event statistics |

### Health Check

```bash
curl http://localhost:3000/health
```

---

## ⚙️ Configuration

Key environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/telltide` |
| `API_PORT` | API server port | `3000` |
| `WORKER_INTERVAL_SECONDS` | How often to check subscriptions | `30` |
| `INDEXER_START_BLOCK` | Starting block for indexer | `20000000` |
| `SQD_PORTAL_URL` | SQD Portal endpoint | `https://portal.sqd.dev/datasets/ethereum-mainnet` |

---

## 🛠️ Development

### Reset Database
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
- **`rolling_aggregate`** - Aggregate field values (sum, avg, count, min, max) in time window

## ⏱️ Time Windows

Supported formats: `15m`, `1h`, `2h`, `24h`, `7d`, etc.

---

## 🤝 Contributing

This is a hackathon project. Contributions welcome!

## 📄 License

ISC

---

<div align="center">
  <sub>Built with SQD Pipes SDK | Powered by PostgreSQL | Made for the dark forest 🌲</sub>
</div>
