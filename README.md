# ChaosChain Server

> Meta-event detection and webhook notification system for blockchain events

ChaosChain allows developers to easily create "meta-events" (aggregated signals) from blockchain data and receive webhook notifications when conditions are met. Instead of manually tracking hundreds of individual events, subscribe to meaningful aggregated conditions like "notify me when withdrawals exceed 20% in the last hour" or "alert when there are more than 25 liquidations in 15 minutes."

## Features

- **Real-time Event Indexing**: Uses SQD Pipes SDK to index Morpho Blue and ERC20 events from Ethereum
- **Meta-Event Detection**: Create complex conditions based on aggregated event data
  - Rolling time windows (1h, 15m, 24h, etc.)
  - Aggregations (sum, avg, count, min, max)
  - Threshold comparisons (>, <, >=, <=, =, !=)
- **Webhook Notifications**: Automatic webhook delivery with retry logic
- **REST API**: Simple TypeScript API for managing subscriptions
- **PostgreSQL Storage**: Efficient time-series event storage with indexing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BLOCKCHAIN (Ethereum)                    │
│              (Morpho Markets + ERC20 Transfers)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ SQD Portal API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQD Pipes Indexer                         │
│                   (src/indexer/index.ts)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Writes events
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Reads for detection
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Meta-Event Detection Worker                    │
│                   (src/worker/index.ts)                     │
│  - Polls DB every 30s                                       │
│  - Evaluates conditions                                     │
│  - Triggers webhooks                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP POST
                       ▼
                  User's Webhook URL
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- pnpm (or npm/yarn)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Setup Environment

```bash
cp .env.example .env
```

Edit `.env` as needed. Default values work for local development.

### 4. Run Database Migrations

```bash
pnpm db:migrate
```

### 5. Start All Services

Start everything at once:

```bash
pnpm dev
```

Or start services individually:

```bash
# Terminal 1 - Indexer
pnpm indexer

# Terminal 2 - Worker
pnpm worker

# Terminal 3 - API
pnpm api
```

The system will start:
- **Indexer**: Indexes Morpho Blue events from Ethereum mainnet
- **Worker**: Checks subscriptions every 30 seconds
- **API**: REST API on http://localhost:3000

## Usage Guide

### Creating a Subscription

Use the REST API to create a subscription:

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "High Withdrawal Alert",
    "webhook_url": "https://your-server.com/webhook",
    "meta_event_config": {
      "type": "event_count",
      "event_type": "morpho_withdraw",
      "window": "1h",
      "condition": {
        "operator": ">",
        "value": 25
      }
    }
  }'
```

### Meta-Event Configuration Examples

#### 1. Event Count - Alert on withdrawal spike

```json
{
  "type": "event_count",
  "event_type": "morpho_withdraw",
  "market_id": "0x...",
  "window": "1h",
  "condition": {
    "operator": ">",
    "value": 25
  }
}
```

**Triggers when**: More than 25 withdrawals occur in the last hour for a specific market.

#### 2. Rolling Aggregate - Monitor total withdrawal volume

```json
{
  "type": "rolling_aggregate",
  "event_type": "morpho_withdraw",
  "market_id": "0x...",
  "window": "1h",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 1000000000000000000
  }
}
```

**Triggers when**: Total withdrawn assets exceed 1 ETH (in wei) in the last hour.

#### 3. Liquidation Spike Alert

```json
{
  "type": "event_count",
  "event_type": "morpho_liquidation",
  "window": "15m",
  "condition": {
    "operator": ">=",
    "value": 3
  }
}
```

**Triggers when**: 3 or more liquidations happen within 15 minutes.

### Webhook Payload

When a meta-event is triggered, your webhook receives:

```json
{
  "subscription_id": "uuid",
  "subscription_name": "High Withdrawal Alert",
  "triggered_at": "2025-11-22T10:30:00.000Z",
  "meta_event": {
    "type": "event_count",
    "condition_met": true,
    "event_count": 28,
    "threshold": 25,
    "window": "1h"
  },
  "events": [
    {
      "block_number": 20500000,
      "timestamp": "2025-11-22T09:45:00.000Z",
      "event_type": "morpho_withdraw",
      "data": {
        "onBehalf": "0x...",
        "receiver": "0x...",
        "assets": "1000000000000000000",
        "shares": "1000000000000000000"
      }
    }
    // ... more events
  ]
}
```

## API Reference

### Subscriptions

#### Create Subscription

```
POST /api/subscriptions
```

**Request Body:**
```json
{
  "user_id": "string",
  "name": "string",
  "webhook_url": "string (url)",
  "meta_event_config": { ... }
}
```

**Response:** `201 Created`

#### List Subscriptions

```
GET /api/subscriptions?user_id={optional}
```

**Response:** `200 OK`

#### Get Subscription

```
GET /api/subscriptions/:id
```

**Response:** `200 OK`

#### Update Subscription

```
PATCH /api/subscriptions/:id
```

**Request Body:**
```json
{
  "name": "string (optional)",
  "webhook_url": "string (optional)",
  "meta_event_config": { ... } (optional),
  "is_active": boolean (optional)
}
```

**Response:** `200 OK`

#### Delete Subscription

```
DELETE /api/subscriptions/:id
```

**Response:** `204 No Content`

#### Get Notification History

```
GET /api/subscriptions/:id/notifications?limit={50}
```

**Response:** `200 OK`

### Events

#### Query Events

```
GET /api/events?event_type={type}&market_id={id}&limit={100}
```

**Query Parameters:**
- `event_type`: Filter by event type
- `market_id`: Filter by Morpho market ID
- `contract_address`: Filter by contract address
- `from_block`: Minimum block number
- `to_block`: Maximum block number
- `limit`: Max results (default: 100, max: 1000)

**Response:** `200 OK`

#### Get Event Statistics

```
GET /api/events/stats
```

**Response:** `200 OK` with aggregated statistics per event type.

## Configuration

### Environment Variables

See `.env.example` for all configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/chaoschain` |
| `API_PORT` | API server port | `3000` |
| `WORKER_INTERVAL_SECONDS` | Meta-event check interval | `30` |
| `SQD_PORTAL_URL` | SQD Portal endpoint | `https://portal.sqd.dev/datasets/ethereum-mainnet` |
| `INDEXER_START_BLOCK` | Starting block for indexer | `20000000` |
| `INDEXER_USE_CACHE` | Enable local Portal caching | `true` |
| `MORPHO_BLUE_ADDRESS` | Morpho Blue contract address | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |

## Event Types

The system indexes these event types:

- `morpho_supply`: Supply events from Morpho Blue
- `morpho_borrow`: Borrow events from Morpho Blue
- `morpho_withdraw`: Withdraw events from Morpho Blue
- `morpho_repay`: Repay events from Morpho Blue
- `morpho_liquidation`: Liquidation events from Morpho Blue
- `erc20_transfer`: ERC20 transfer events (not implemented yet, but supported in schema)

## Project Structure

```
server/
├── src/
│   ├── abi/                  # Contract ABIs
│   │   └── morpho-blue.ts   # Morpho Blue event signatures
│   ├── api/                  # REST API
│   │   ├── routes/          # API route handlers
│   │   ├── validators.ts    # Zod schemas
│   │   └── index.ts         # Express app
│   ├── config/              # Configuration
│   │   └── index.ts
│   ├── db/                  # Database layer
│   │   ├── repositories/    # Data access layer
│   │   ├── client.ts        # PostgreSQL client
│   │   ├── migrate.ts       # Migration runner
│   │   └── schema.sql       # Database schema
│   ├── indexer/             # SQD Pipes indexer
│   │   └── index.ts
│   ├── worker/              # Meta-event detection worker
│   │   ├── detector.ts      # Detection logic
│   │   ├── webhook.ts       # Webhook dispatcher
│   │   └── index.ts         # Worker main
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── index.ts             # Main entry (starts all services)
├── docker-compose.yml       # PostgreSQL container
├── package.json
└── tsconfig.json
```

## Development

### Database Management

**Reset database:**
```bash
docker compose down -v  # Delete data
docker compose up -d    # Restart
pnpm db:migrate         # Re-run migrations
```

**View logs:**
```bash
docker compose logs -f postgres
```

**Connect to PostgreSQL:**
```bash
docker exec -it chaoschain-postgres psql -U postgres -d chaoschain
```

### Testing Webhooks Locally

Use a service like [webhook.site](https://webhook.site) or [ngrok](https://ngrok.com) to test webhooks:

1. Get a webhook URL from webhook.site
2. Create a subscription with that URL
3. Wait for meta-event to trigger
4. View webhook payload in webhook.site

## Production Deployment

1. Use a managed PostgreSQL instance
2. Set `INDEXER_USE_CACHE=false` in production
3. Configure proper `INDEXER_START_BLOCK` to avoid reindexing
4. Add authentication to the API
5. Use a process manager like PM2 or run in containers
6. Set up monitoring and alerting
7. Configure webhook retry policies based on your needs

## Extending the System

### Adding New Event Types

1. Add event signature to `src/abi/` directory
2. Update event decoder in `src/indexer/index.ts`
3. Add event type to `src/types/index.ts`
4. Update validators in `src/api/validators.ts`

### Adding New Meta-Event Types

1. Add type to `MetaEventConditionType` in `src/types/index.ts`
2. Implement detection logic in `src/worker/detector.ts`
3. Update validators

## Troubleshooting

**Indexer not progressing:**
- Check Portal URL is accessible
- Verify start block is valid
- Check database connection

**Webhooks not firing:**
- Verify webhook URL is accessible
- Check worker logs for errors
- Ensure subscription is active
- Verify meta-event condition is correct

**Database connection errors:**
- Ensure PostgreSQL is running: `docker compose ps`
- Check `DATABASE_URL` in `.env`
- Run migrations: `pnpm db:migrate`

## License

ISC

## Contributing

This is a hackathon project prototype. Contributions welcome!

## TODO / Future Improvements

- [ ] Add authentication/API keys
- [ ] Support ERC20 transfer indexing
- [ ] Add more aggregation types (percentile, stddev, etc.)
- [ ] Web dashboard for managing subscriptions
- [ ] Support multiple blockchains
- [ ] Add historical backtesting for meta-events
- [ ] Implement rate limiting
- [ ] Add webhook signature verification
- [ ] Support multiple Morpho markets
- [ ] Add factory pattern for discovering new markets
