# TellTide Architecture & AI Context Reference

> **Purpose:** This document serves as the complete technical reference for TellTide. Use this to give AI assistants full context about the system's current state, design decisions, and implementation details.

---

## Executive Summary

**TellTide** is a multi-chain meta-event detection and webhook notification system for Ethereum and Base. It indexes ERC20 transfers and ERC4626 vault events, detects aggregated conditions (meta-events), and sends webhook notifications.

**Current State (v1.0):**
- ✅ Multi-chain support (Ethereum + Base)
- ✅ ERC20 + ERC4626 event indexing
- ✅ Meta-event detection (count + aggregations)
- ✅ Webhook notifications with retry
- ✅ Per-subscription cooldowns
- ✅ Block-based lookback for efficiency
- ✅ REST API for subscription management
- ✅ PostgreSQL storage with JSONB

**Tech Stack:**
- Runtime: Node.js 18+ / TypeScript
- Indexing: SQD Pipes SDK
- Database: PostgreSQL 16
- API: Express.js + Zod validation
- Scheduling: node-cron
- HTTP: Axios

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BLOCKCHAIN NETWORKS                                    │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │  Ethereum        │      │  Base            │       │
│  │  ~12s blocks     │      │  ~2s blocks      │       │
│  └──────────────────┘      └──────────────────┘       │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
            │ SQD Portal API          │ SQD Portal API
            ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│  INDEXER (per chain)                                    │
│  • Fetches ERC20 + ERC4626 events                      │
│  • Dynamic start block (current - N blocks)            │
│  • Batch inserts to PostgreSQL                         │
│  • Handles forks via cursor management                 │
└───────────┬─────────────────────────────────────────────┘
            │
            │ INSERT events with chain tag
            ▼
┌─────────────────────────────────────────────────────────┐
│  POSTGRESQL DATABASE                                    │
│  • events (chain, block_number, event_type, data...)   │
│  • subscriptions (user configs + chain + cooldown)     │
│  • notifications_log (delivery tracking)               │
└───────┬─────────────────────┬───────────────────────────┘
        │                     │
        │ Query events        │ Manage subscriptions
        ▼                     ▼
┌──────────────────┐    ┌─────────────────────────────┐
│  WORKER          │    │  REST API                   │
│  • Every 30s     │    │  • POST /subscriptions      │
│  • Check active  │    │  • GET  /subscriptions      │
│  • Detect        │    │  • PATCH/DELETE /:id        │
│  • Webhook POST  │    │  • GET  /:id/notifications  │
│  • Cooldown      │    │  • GET  /health             │
└──────────────────┘    └─────────────────────────────┘
        │
        │ HTTP POST (retry 3x)
        ▼
┌─────────────────────────┐
│  USER'S WEBHOOK         │
│  (webhook.site, etc.)   │
└─────────────────────────┘
```

---

## Core Components

### 1. Indexer (`src/indexer/index.ts`)

**Purpose:** Fetch and store blockchain events from Ethereum and Base

**How it works:**
1. Fetches current head block via RPC (`eth_blockNumber`)
2. Calculates start block: `max(1, head - MAX_LOOKBACK_BLOCKS)`
3. Uses SQD Pipes SDK to stream events from SQD Portal
4. Decodes ERC20 Transfer + ERC4626 Deposit/Withdraw events
5. Batch inserts to PostgreSQL with `chain` field
6. Duplicate prevention via unique constraint: `(chain, transaction_hash, log_index)`

**Key Features:**
- Dynamic start block calculation (no hardcoded values)
- Chain-specific portal URLs
- SQLite cache for development (optional)
- Graceful error handling

**Log Format (concise):**
```
[14:37:58.161] INFO: Indexer starting | chain=ethereum blocks=21,190,000-21,200,000 events=ERC20+ERC4626
block=21190000-21190050 events=125
```

**Config:**
- `config.chains.ethereum.rpcUrl` - RPC endpoint for head block
- `config.chains.ethereum.sqdPortalUrl` - SQD Portal URL
- `config.indexer.maxLookbackBlocks` - How far back to index (default: 10,000)

### 2. Database Layer (`src/db/`)

**Schema:**

```sql
-- Events table (with chain support)
events (
  id UUID PRIMARY KEY,
  chain VARCHAR(20) NOT NULL DEFAULT 'ethereum',
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  contract_address VARCHAR(66) NOT NULL,
  from_address VARCHAR(66),
  to_address VARCHAR(66),
  data JSONB NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chain, transaction_hash, log_index)
)

-- Indexes
idx_events_timestamp (timestamp)
idx_events_event_type (event_type)
idx_events_chain (chain)
idx_events_composite (event_type, timestamp, chain)

-- Subscriptions table
subscriptions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  webhook_url TEXT NOT NULL,
  meta_event_config JSONB NOT NULL,
  cooldown_minutes INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Notifications log
notifications_log (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  triggered_at TIMESTAMP NOT NULL,
  payload JSONB NOT NULL,
  webhook_response_status INTEGER,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Repositories:**
- `eventsRepository` - Event queries with chain filtering
- `subscriptionsRepository` - Subscription CRUD
- `notificationsRepository` - Notification tracking

**Key Queries:**

```typescript
// Count events in time window for specific chain
getEventCount(
  eventType: EventType,
  windowMinutes: number,
  contracts?: string[],
  contractAddress?: string,
  fromAddress?: string,
  toAddress?: string,
  lookbackBlocks?: number,
  chain?: string  // 'ethereum' or 'base'
): Promise<number>

// Aggregate field values in time window for specific chain
getAggregatedValue(
  eventType: EventType,
  field: string,
  aggregation: 'sum' | 'avg' | 'min' | 'max',
  windowMinutes: number,
  // ... same filters as getEventCount
  chain?: string
): Promise<number>
```

**Block-based Lookback:**
When `lookbackBlocks` is specified:
1. Query: `SELECT MAX(block_number) FROM events WHERE event_type = ? AND chain = ?`
2. Calculate: `minBlock = max(0, maxBlock - lookbackBlocks)`
3. Use: `WHERE block_number >= minBlock AND chain = ?`

This is more efficient than time-based queries for small windows.

### 3. Meta-Event Detection Worker (`src/worker/`)

**Purpose:** Check subscriptions every 30s and send webhooks when conditions met

**Components:**

#### Detector (`src/worker/detector.ts`)
- Parses time windows: `1h` → 60 minutes, `15m` → 15 minutes, `1d` → 1440 minutes
- Evaluates conditions: `>`, `<`, `>=`, `<=`, `=`, `!=`
- Supports two detection types:
  - **event_count**: Count events in window
  - **rolling_aggregate**: Aggregate field values (sum/avg/min/max)

**Detection Flow:**
```typescript
1. Parse config.window to minutes
2. Extract chain from config (default: 'ethereum')
3. Query database with chain filter
4. For rolling_aggregate: Apply SQL aggregation function
5. Compare actual value vs threshold
6. Return { triggered: boolean, value, threshold, window }
```

**Multi-Contract Support:**
When `contracts` array is provided, detector checks EACH contract individually and returns on FIRST match. This implements OR logic for monitoring multiple vaults.

#### Webhook Dispatcher (`src/worker/webhook.ts`)
- Sends HTTP POST to webhook URL
- Retry logic: 3 attempts with exponential backoff
- Special handling: 404 errors are NOT retried (bad URL)
- Logs delivery status to `notifications_log`
- Timeout: 10 seconds per request

**Log Format (concise):**
```
[14:37:58.161] INFO: Worker starting | interval=30s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 META-EVENT TRIGGERED: "Base Vault Withdrawal"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Type: rolling_aggregate
   Window: 1h
   Value: 1500000000 (threshold: 1000000000)
   Contract: 0xbeeF...
   Webhook: https://webhook.site/...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ❌ Webhook 404: https://bad-url.com/...
```

#### Worker Orchestrator (`src/worker/index.ts`)
- Runs on cron: every 30 seconds (configurable)
- Fetches active subscriptions
- Checks cooldown: `timeSince < (cooldown_minutes * 60 * 1000)`
- Calls detector for each subscription
- Dispatches webhooks in batch
- Silent when no active subscriptions or in cooldown

**Cooldown Logic:**
```typescript
const lastNotification = await getLastNotificationTime(subscription.id);
if (lastNotification) {
  const cooldownMs = (subscription.cooldown_minutes ?? 1) * 60 * 1000;
  const timeSince = Date.now() - lastNotification.getTime();
  if (timeSince < cooldownMs) {
    continue; // Skip, still in cooldown (silent)
  }
}
```

### 4. REST API (`src/api/`)

**Framework:** Express.js with TypeScript

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscriptions` | Create subscription |
| GET | `/api/subscriptions` | List subscriptions (?user_id=...) |
| GET | `/api/subscriptions/:id` | Get subscription details |
| PATCH | `/api/subscriptions/:id` | Update subscription |
| DELETE | `/api/subscriptions/:id` | Delete subscription |
| GET | `/api/subscriptions/:id/notifications` | Get notification history (?limit=50) |
| GET | `/health` | Health check |

**Validation:** Zod schemas in `src/api/validators.ts`

**Request Body (POST /api/subscriptions):**
```json
{
  "user_id": "string",
  "name": "string",
  "webhook_url": "https://...",
  "cooldown_minutes": 5,  // optional, default: 1
  "meta_event_config": {
    "chain": "ethereum" | "base",  // optional, default: ethereum
    "type": "event_count" | "rolling_aggregate",
    "event_type": "erc20_transfer" | "erc4626_deposit" | "erc4626_withdraw",
    "contract_address": "0x...",  // optional
    "contracts": ["0x...", "0x..."],  // optional, OR logic
    "from_address": "0x...",  // optional
    "to_address": "0x...",  // optional
    "window": "1h" | "15m" | "24h" | ...,
    "lookback_blocks": 300,  // optional, overrides time-based
    "aggregation": "sum" | "avg" | "min" | "max",  // for rolling_aggregate
    "field": "assets" | "value" | "shares",  // for rolling_aggregate
    "condition": {
      "operator": ">" | "<" | ">=" | "<=" | "=" | "!=",
      "value": 1000000000
    }
  }
}
```

**Response (all endpoints return full subscription object):**
```json
{
  "id": "uuid",
  "user_id": "string",
  "name": "string",
  "webhook_url": "https://...",
  "cooldown_minutes": 5,
  "meta_event_config": { ... },
  "is_active": true,
  "created_at": "2025-11-22T10:00:00Z",
  "updated_at": "2025-11-22T10:00:00Z"
}
```

**cURL Examples:**

```bash
# Create subscription
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"user_id":"alice","name":"Test","webhook_url":"https://webhook.site/...","meta_event_config":{...}}'

# List all subscriptions
curl http://localhost:3000/api/subscriptions

# Get specific subscription
curl http://localhost:3000/api/subscriptions/{id}

# Update subscription
curl -X PATCH http://localhost:3000/api/subscriptions/{id} \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'

# Delete subscription
curl -X DELETE http://localhost:3000/api/subscriptions/{id}

# Get notification history
curl http://localhost:3000/api/subscriptions/{id}/notifications?limit=10
```

---

## Multi-Chain Implementation

### Chain Configuration (`src/config/index.ts`)

```typescript
export type ChainConfig = {
  name: string;
  rpcUrl: string;
  sqdPortalUrl: string;
};

export const config = {
  chains: {
    ethereum: {
      name: 'ethereum',
      rpcUrl: process.env.ETHEREUM_RPC_URL ?? 'https://eth.llamarpc.com',
      sqdPortalUrl: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    },
    base: {
      name: 'base',
      rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
      sqdPortalUrl: 'https://portal.sqd.dev/datasets/base-mainnet',
    },
  },
  indexer: {
    maxLookbackBlocks: parseInt(process.env.INDEXER_MAX_LOOKBACK_BLOCKS ?? '10000', 10),
    useCache: process.env.INDEXER_USE_CACHE === 'true',
    enabledChains: (process.env.INDEXER_ENABLED_CHAINS ?? 'ethereum,base').split(','),
  },
};
```

### Chain Defaults

- All `MetaEventConfig` objects accept optional `chain` field
- Default: `'ethereum'` if not specified
- Events are tagged with chain: `{ chain: 'ethereum' | 'base', ... }`
- All repository queries filter by chain: `WHERE chain = $1`

### Block Time Differences

| Chain | Block Time | Recommended lookback_blocks |
|-------|------------|----------------------------|
| Ethereum | ~12s | 100 blocks ≈ 20 min |
| Base | ~2s | 300 blocks ≈ 10 min |

**Why this matters:**
- Block-based lookback is more efficient on Base due to consistent 2s blocks
- Time-based windows can be less predictable on Ethereum (block time variance)
- Always use `lookback_blocks` for small windows (< 1h) on both chains

---

## Event Types & Data Structures

### Event Types

```typescript
export type EventType =
  | 'erc20_transfer'
  | 'erc4626_deposit'
  | 'erc4626_withdraw';

export type Event = {
  id: string;
  chain: string;              // 'ethereum' | 'base'
  block_number: number;
  timestamp: Date;
  event_type: EventType;
  contract_address: string;
  from_address: string | null;
  to_address: string | null;
  data: Record<string, unknown>;  // JSONB
  transaction_hash: string;
  log_index: number;
  created_at: Date;
};
```

### Event Data Formats

**ERC20 Transfer:**
```json
{
  "from": "0x...",
  "to": "0x...",
  "value": "1000000000000"
}
```

**ERC4626 Deposit:**
```json
{
  "sender": "0x...",
  "owner": "0x...",
  "assets": "1000000000000",
  "shares": "1000000000000"
}
```

**ERC4626 Withdraw:**
```json
{
  "sender": "0x...",
  "receiver": "0x...",
  "owner": "0x...",
  "assets": "1000000000000",
  "shares": "1000000000000"
}
```

### Meta-Event Config

```typescript
export type MetaEventConfig = {
  chain?: string;                    // 'ethereum' | 'base' (default: 'ethereum')
  type: 'event_count' | 'rolling_aggregate';
  event_type: EventType;
  contracts?: string[];              // OR logic: check ANY contract
  contract_address?: string;         // Single contract
  from_address?: string;             // Filter by sender
  to_address?: string;               // Filter by receiver
  window: string;                    // '1h', '15m', '24h', etc.
  lookback_blocks?: number;          // Override time-based with block-based
  aggregation?: 'sum' | 'avg' | 'min' | 'max';  // For rolling_aggregate
  field?: string;                    // Field to aggregate ('assets', 'value', etc.)
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
    value: number;
  };
};

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  meta_event_config: MetaEventConfig;
  cooldown_minutes?: number;        // Default: 1
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};
```

### Webhook Payload

```typescript
export type WebhookPayload = {
  subscription_id: string;
  subscription_name: string;
  triggered_at: string;  // ISO 8601
  meta_event: {
    type: 'event_count' | 'rolling_aggregate';
    condition_met: true;
    aggregated_value?: number;      // For rolling_aggregate
    event_count?: number;            // For event_count
    threshold: number;
    window: string;
    triggered_by_contract?: string;  // If using multi-contract
  };
};
```

---

## Configuration & Environment

### Environment Variables (`.env`)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telltide

# API
API_PORT=3000
API_HOST=0.0.0.0

# Worker
WORKER_INTERVAL_SECONDS=30

# RPC URLs (for getting current block head)
ETHEREUM_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org

# Indexer
INDEXER_MAX_LOOKBACK_BLOCKS=10000
INDEXER_USE_CACHE=false
INDEXER_ENABLED_CHAINS=ethereum,base

# Logging
LOG_LEVEL=info
```

### Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm indexer\" \"pnpm worker\" \"pnpm api\"",
    "indexer": "tsx src/indexer/index.ts",
    "worker": "tsx src/worker/index.ts",
    "api": "tsx src/api/index.ts",
    "db:migrate": "tsx src/db/schema.ts",
    "db:migrate:chain": "tsx src/db/migrate-chain.ts",
    "db:clean": "tsx src/db/clean-db.ts",
    "db:clean-subs": "tsx src/db/clean-subscriptions.ts",
    "db:insert-subs": "tsx src/db/insert-subscriptions.ts"
  }
}
```

---

## Common Operations

### Setup from Scratch

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Run schema migration
pnpm db:migrate

# 4. Run chain migration (adds chain + cooldown_minutes)
pnpm db:migrate:chain

# 5. Start all services
pnpm dev
```

### Create Subscription (cURL)

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice",
    "name": "High USDC Activity",
    "webhook_url": "https://webhook.site/your-url",
    "cooldown_minutes": 5,
    "meta_event_config": {
      "chain": "ethereum",
      "type": "event_count",
      "event_type": "erc20_transfer",
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "window": "15m",
      "lookback_blocks": 100,
      "condition": {
        "operator": ">",
        "value": 50
      }
    }
  }'
```

### Insert Test Subscriptions

```bash
# 1. Edit src/db/insert-subscriptions.ts
#    - Set your webhook.site URL (line 11)
#    - Uncomment desired subscriptions

# 2. Run insertion script
pnpm db:insert-subs
```

### Clean Database (preserves schema)

```bash
# Option 1: Clean everything
pnpm db:clean

# Option 2: Clean only subscriptions/notifications (keep events)
pnpm db:clean-subs
```

### Connect to PostgreSQL

```bash
docker exec -it telltide-postgres psql -U postgres -d telltide

# Useful queries
\d events                    -- Show events table schema
\d subscriptions             -- Show subscriptions table schema
SELECT COUNT(*) FROM events; -- Count events
SELECT * FROM subscriptions; -- List subscriptions
```

---

## Design Decisions & Rationale

### 1. Why JSONB for event data?

**Decision:** Store decoded event data as JSONB instead of separate columns

**Rationale:**
- Flexibility: Different event types have different fields
- No schema changes needed for new event types
- PostgreSQL JSONB is indexed and queryable
- Can extract fields via `(data->>'field')::numeric`

**Trade-off:** Slightly slower than native columns, but acceptable for this use case

### 2. Why block-based lookback?

**Decision:** Support `lookback_blocks` in addition to time-based windows

**Rationale:**
- More predictable performance (scan N blocks vs time range)
- Better for testing (limit data scanned)
- More efficient on chains with fast/consistent block times (Base)
- Avoids edge cases with block time variance

**Implementation:**
```sql
-- Instead of:
WHERE timestamp >= NOW() - INTERVAL '1 hour'

-- Use:
WHERE block_number >= (MAX(block_number) - 300) AND chain = 'base'
```

### 3. Why per-subscription cooldowns?

**Decision:** Each subscription has its own `cooldown_minutes` field

**Rationale:**
- Different use cases need different notification frequencies
- Critical alerts: 1 minute cooldown
- Non-urgent monitoring: 60 minute cooldown
- User control over notification spam
- Tracked in database for persistence across restarts

### 4. Why dynamic start block calculation?

**Decision:** Calculate start block on every indexer startup instead of hardcoding

**Rationale:**
- Always get recent data without manual configuration
- Automatically adjusts to current blockchain state
- No stale data issues from old start blocks
- Simple: `start = max(1, currentHead - maxLookbackBlocks)`

**Trade-off:** Requires RPC call on startup, but only once

### 5. Why multi-contract OR logic?

**Decision:** When `contracts` array is provided, check each contract and return on first match

**Rationale:**
- Common use case: "Alert if ANY of these vaults has high withdrawals"
- Efficient: Stop checking once one matches
- Simple to understand: OR logic is intuitive
- Payload includes `triggered_by_contract` for clarity

**Example:**
```typescript
for (const contract of contracts) {
  const value = await getAggregatedValue(..., contract);
  if (conditionMet(value)) {
    return { triggered: true, triggeredByContract: contract };
  }
}
```

### 6. Why silent cooldown?

**Decision:** Don't log when subscription is in cooldown period

**Rationale:**
- Reduces log noise significantly
- Cooldown is expected behavior, not an error
- Logs should focus on important events (triggers, errors)
- User can check `notifications_log` table for history

### 7. Why concise logs?

**Decision:** Use single-line log format with timestamps

**Rationale:**
- Easy to scan for important events
- Similar to industry standard (SQD indexer format)
- Timestamp with milliseconds for debugging
- Key metrics on one line: `block=X-Y events=N`

**Format:**
```
[14:37:58.161] INFO: message | key=value key2=value2
```

---

## Performance Considerations

### Database Indexes

All queries use indexes efficiently:

```sql
-- Time-based queries
WHERE timestamp >= NOW() - INTERVAL '1 hour'
  AND event_type = 'erc20_transfer'
  AND chain = 'ethereum'
-- Uses: idx_events_composite(event_type, timestamp, chain)

-- Block-based queries
WHERE block_number >= 21190000
  AND event_type = 'erc4626_withdraw'
  AND chain = 'base'
-- Uses: idx_events_composite + idx_events_chain
```

### Query Optimization

**Event Count:**
```sql
SELECT COUNT(*)
FROM events
WHERE event_type = $1
  AND block_number >= $2
  AND chain = $3
  AND contract_address = $4;
```
- Index scan on composite index
- No table scan needed
- Efficient even with millions of rows

**Aggregation:**
```sql
SELECT SUM((data->>'assets')::numeric)
FROM events
WHERE event_type = $1
  AND block_number >= $2
  AND chain = $3
  AND contract_address = $4;
```
- JSONB field extraction is optimized in PostgreSQL
- Index scan limits rows before aggregation
- Parallel aggregation on large datasets

### Batch Processing

**Indexer:**
- Inserts events in batches of 500
- Uses PostgreSQL's `VALUES (row1), (row2), ...` for efficiency
- `ON CONFLICT DO NOTHING` prevents duplicates
- ~10-100x faster than individual inserts

**Worker:**
- Checks all subscriptions in parallel (Promise.allSettled)
- Dispatches webhooks in batch
- Graceful error handling (one failure doesn't stop others)

---

## Error Handling & Edge Cases

### 1. Blockchain Forks

**Problem:** Chain reorganizations can invalidate recent blocks

**Solution:** SQD Pipes SDK handles forks automatically via cursor management
- Cursor stores last processed block
- On fork detection, rolls back to safe block
- Re-processes affected blocks
- No manual intervention needed

### 2. Duplicate Events

**Problem:** Same event might be indexed multiple times

**Solution:** Unique constraint on `(chain, transaction_hash, log_index)`
- Database enforces uniqueness
- `ON CONFLICT DO NOTHING` in insert queries
- No duplicate events in database

### 3. Webhook 404 Errors

**Problem:** User provides invalid webhook URL

**Solution:** Special handling for 404 responses
- Don't retry 404s (bad URL, not transient error)
- Log concise error: `❌ Webhook 404: https://...`
- User can check logs or notification history

### 4. Indexer Crashes

**Problem:** Indexer stops mid-processing

**Solution:** Cursor management ensures resumable indexing
- Cursor updated after each successful batch
- On restart, resume from last cursor position
- No events lost or re-processed

### 5. Worker Overlap

**Problem:** Previous worker cycle still running when next one starts

**Solution:** Simple lock mechanism
```typescript
if (this.isRunning) {
  return; // Skip this cycle
}
this.isRunning = true;
try {
  // ... process subscriptions
} finally {
  this.isRunning = false;
}
```

### 6. Database Connection Loss

**Problem:** PostgreSQL connection drops during operation

**Solution:**
- Connection pool with retry logic (from `pg` library)
- Each repository function catches errors
- Worker continues on next cycle
- Logs error for debugging

---

## Testing & Development

### Local Development Setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Run migrations
pnpm db:migrate
pnpm db:migrate:chain

# 3. Insert test subscriptions
pnpm db:insert-subs

# 4. Start services in separate terminals
pnpm indexer   # Terminal 1
pnpm worker    # Terminal 2
pnpm api       # Terminal 3

# 5. Get webhook test URL
# Visit https://webhook.site to get a unique URL
# Update subscriptions with this URL
```

### Testing Subscriptions

**Option 1: Use real contracts on mainnet**
```json
{
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  // Real USDC
  "event_type": "erc20_transfer",
  "window": "15m",
  "condition": { "operator": ">", "value": 50 }
}
```

**Option 2: Use Base testnet vault**
```json
{
  "chain": "base",
  "contract_address": "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183",
  "event_type": "erc4626_deposit",
  "lookback_blocks": 300,
  "condition": { "operator": ">", "value": 5 }
}
```

**Option 3: Lower thresholds for testing**
```json
{
  "condition": { "operator": ">", "value": 1 }  // Triggers easily
}
```

### Debugging

**Check indexer is running:**
```bash
# Should see events being inserted
# Look for: block=X-Y events=N
```

**Check worker is running:**
```bash
# Should see startup message
# [HH:MM:SS.mmm] INFO: Worker starting | interval=30s
```

**Check subscriptions are active:**
```sql
SELECT id, name, is_active FROM subscriptions;
```

**Check notification history:**
```sql
SELECT
  s.name,
  nl.triggered_at,
  nl.webhook_response_status,
  nl.retry_count
FROM notifications_log nl
JOIN subscriptions s ON nl.subscription_id = s.id
ORDER BY nl.triggered_at DESC
LIMIT 10;
```

---

## Migration Guide

### Adding Multi-Chain Support to Existing Database

If you have an existing database without chain support:

```bash
pnpm db:migrate:chain
```

This runs `src/db/migrations/add-chain-and-cooldown.sql`:
- ✅ Adds `chain` column to events (defaults to 'ethereum')
- ✅ Adds `cooldown_minutes` to subscriptions (defaults to 1)
- ✅ Updates unique constraint to include chain
- ✅ Adds chain indexes for performance
- ✅ Idempotent (safe to run multiple times)
- ✅ Preserves all existing data

---

## Future Enhancements

### Short-term (Next Sprint)

1. **Multi-chain indexer** - Run separate indexer per chain
2. **API pagination** - Add limit/offset to GET /subscriptions
3. **Event pruning** - Auto-delete events older than N days
4. **Health check enhancements** - Include DB status, indexer status

### Medium-term

1. **More chains** - Arbitrum, Optimism, Polygon
2. **More event types** - Uniswap swaps, Aave borrows, etc.
3. **Advanced aggregations** - Percentiles, standard deviation
4. **Webhook templates** - Slack, Discord, Telegram integrations
5. **Historical backtesting** - Test meta-events on past data

### Long-term

1. **Web dashboard** - React UI for managing subscriptions
2. **User authentication** - API keys, OAuth
3. **Team/organization support** - Share subscriptions
4. **Real-time WebSocket** - Live notifications without webhooks
5. **Rate limiting** - Prevent abuse
6. **Monitoring** - Prometheus metrics, Grafana dashboards

---

## Deployment Considerations

### Environment-specific Configs

**Development:**
```env
INDEXER_MAX_LOOKBACK_BLOCKS=10000
WORKER_INTERVAL_SECONDS=30
INDEXER_USE_CACHE=true
```

**Production:**
```env
INDEXER_MAX_LOOKBACK_BLOCKS=60000
WORKER_INTERVAL_SECONDS=10
INDEXER_USE_CACHE=false
```

---

## Key Files Reference

### Core Source Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/indexer/index.ts` | Event indexing | Fetches head block, streams events, batch insert |
| `src/worker/detector.ts` | Meta-event detection | `detect()`, `parseWindow()`, `evaluateCondition()` |
| `src/worker/webhook.ts` | Webhook delivery | `dispatch()`, retry logic, error handling |
| `src/worker/index.ts` | Worker orchestration | Cron scheduling, cooldown check, batch dispatch |
| `src/api/index.ts` | REST API routes | Express routes, CORS, error handling |
| `src/api/validators.ts` | Request validation | Zod schemas for subscriptions |
| `src/db/repositories/events.ts` | Event queries | `getEventCount()`, `getAggregatedValue()` |
| `src/db/repositories/subscriptions.ts` | Subscription CRUD | `createSubscription()`, `getActiveSubscriptions()` |
| `src/db/repositories/notifications.ts` | Notification tracking | `createNotificationLog()`, `getLastNotificationTime()` |
| `src/config/index.ts` | Configuration | Chain configs, environment variables |
| `src/types/index.ts` | Type definitions | All TypeScript types |

### Database Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Initial schema creation |
| `src/db/migrations/add-chain-and-cooldown.sql` | Multi-chain migration |
| `src/db/migrate-chain.ts` | Migration runner |
| `src/db/clean-db.ts` | Clean all data |
| `src/db/clean-subscriptions.ts` | Clean subscriptions only |
| `src/db/insert-subscriptions.ts` | Insert test subscriptions |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Quick start guide for users |
| `ARCHITECTURE.md` | This file - comprehensive technical reference & AI context |
| `.env.example` | Environment variable template |

---

## AI Assistant Guidelines

**When helping with TellTide:**

1. **Always consider multi-chain context**
   - Events are tagged with `chain`
   - All queries must filter by chain
   - Default is 'ethereum' if not specified

2. **Understand cooldown behavior**
   - Per-subscription, configurable
   - Silent when in cooldown (no logs)
   - Tracked in `notifications_log.triggered_at`

3. **Use block-based lookback for small windows**
   - More efficient than time-based
   - Especially on Base with 2s blocks
   - Formula: `minBlock = maxBlock - lookbackBlocks`

4. **Follow concise log format**
   - `[HH:MM:SS.mmm] LEVEL: message | key=value`
   - Single-line for processing logs
   - Multi-line only for dramatic events (triggers, errors)

5. **Respect type safety**
   - All types defined in `src/types/index.ts`
   - Use Zod for validation
   - No `any` types

6. **Database patterns**
   - Use repositories, not direct queries
   - All filters include chain parameter
   - JSONB for flexible event data
   - Batch operations where possible

7. **Error handling**
   - Graceful degradation (don't crash on errors)
   - Log errors but continue processing
   - Special cases: 404 webhooks, DB connection loss

---

**End of Architecture Document**

*Last Updated: 2025-11-22*
*Version: 1.0 (Multi-chain + Cooldown)*
