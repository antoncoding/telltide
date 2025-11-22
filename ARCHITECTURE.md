# ChaosChain Architecture

## System Overview

ChaosChain is a meta-event detection and notification system built on top of the SQD Pipes SDK. It enables developers to create complex, aggregated event conditions ("meta-events") from blockchain data and receive webhook notifications when those conditions are met.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ETHEREUM BLOCKCHAIN                          │
│                     (Morpho Blue Protocol)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Raw blockchain data
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQD PORTAL API                               │
│            (10-50x faster than RPC)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Filtered & decoded events
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INDEXER (SQD Pipes)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Streams Morpho events (Supply, Borrow, Withdraw, etc.) │  │
│  │ • Decodes event data using ABIs                          │  │
│  │ • Handles blockchain forks (onRollback)                  │  │
│  │ • Saves cursor for resumption                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ INSERT events
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   POSTGRESQL DATABASE                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tables:                                                   │  │
│  │ • events - Raw blockchain events with JSONB data         │  │
│  │ • subscriptions - User-defined meta-event configs        │  │
│  │ • notifications_log - Webhook delivery tracking          │  │
│  │ • indexer_cursor - Indexer state management              │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────┬──────────────────────────────────┬──────────────────┘
            │                                  │
            │ Query events                     │ Query subscriptions
            ▼                                  ▼
┌───────────────────────────┐     ┌────────────────────────────────┐
│   META-EVENT WORKER       │     │       REST API                 │
│  ┌─────────────────────┐  │     │  ┌──────────────────────────┐ │
│  │ • Runs every 30s    │  │     │  │ POST /subscriptions      │ │
│  │ • Checks active     │  │     │  │ GET  /subscriptions      │ │
│  │   subscriptions     │  │     │  │ PATCH /subscriptions/:id │ │
│  │ • Evaluates         │  │     │  │ DELETE /subscriptions/:id│ │
│  │   conditions        │  │     │  │ GET  /events             │ │
│  │ • Dispatches        │  │     │  │ GET  /events/stats       │ │
│  │   webhooks          │  │     │  └──────────────────────────┘ │
│  └─────────────────────┘  │     └────────────────────────────────┘
└──────────┬────────────────┘                   ▲
           │                                    │
           │ HTTP POST                          │ HTTP requests
           ▼                                    │
┌───────────────────────────┐     ┌────────────┴──────────────────┐
│   WEBHOOK ENDPOINT        │     │   DEVELOPER                   │
│  (User's server)          │     │  (Your application)           │
└───────────────────────────┘     └───────────────────────────────┘
```

## Component Details

### 1. Indexer (SQD Pipes)

**Location**: `src/indexer/index.ts`

**Responsibilities**:
- Connects to SQD Portal API for fast blockchain data access
- Filters for Morpho Blue events (Supply, Borrow, Withdraw, Repay, Liquidation)
- Decodes raw event data using event signatures
- Batch inserts events into PostgreSQL
- Handles blockchain reorganizations (forks)
- Manages cursor for resumable indexing

**Technology**:
- `@subsquid/pipes` - SQD Pipes SDK
- `EvmQueryBuilder` - Type-safe query construction
- `evmPortalSource` - Portal data streaming
- Optional SQLite caching for development

**Data Flow**:
```
Portal → QueryBuilder → Source → Decoder → Batch Insert → PostgreSQL
                                              ↓
                                        Update Cursor
```

### 2. Database Layer

**Location**: `src/db/`

**Schema Design**:

```sql
-- Events table (time-series optimized)
events (
  id UUID,
  block_number BIGINT,          -- Indexed for time queries
  timestamp TIMESTAMP,           -- Indexed for window queries
  event_type VARCHAR(50),        -- Indexed for filtering
  contract_address VARCHAR(66),
  market_id VARCHAR(66),         -- Indexed for market filtering
  data JSONB,                    -- Flexible event data
  transaction_hash VARCHAR(66),
  log_index INTEGER,
  UNIQUE(transaction_hash, log_index)  -- Prevent duplicates
)

-- Subscriptions table
subscriptions (
  id UUID,
  user_id VARCHAR(255),
  name VARCHAR(255),
  webhook_url TEXT,
  meta_event_config JSONB,       -- Stores condition definitions
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Notifications log
notifications_log (
  id UUID,
  subscription_id UUID,
  triggered_at TIMESTAMP,
  payload JSONB,
  webhook_response_status INTEGER,
  retry_count INTEGER
)
```

**Repositories**:
- `eventsRepository` - Event CRUD and time-window queries
- `subscriptionsRepository` - Subscription management
- `notificationsRepository` - Notification tracking
- `cursorRepository` - Indexer state

### 3. Meta-Event Detection Worker

**Location**: `src/worker/`

**Components**:

#### Detector (`detector.ts`)
- Parses time window strings (1h, 15m, 24h)
- Evaluates conditions (>, <, >=, <=, =, !=)
- Supports three detection types:
  - `event_count`: Count events in time window
  - `rolling_aggregate`: Aggregate field values (sum, avg, min, max)
  - `threshold`: Similar to rolling_aggregate

**Detection Algorithm**:
```typescript
1. Parse window duration (e.g., "1h" → 60 minutes)
2. Query events in time window from database
3. Apply aggregation function if needed
4. Evaluate condition (actual value vs threshold)
5. Return detection result
```

#### Webhook Dispatcher (`webhook.ts`)
- Sends HTTP POST to webhook URLs
- Implements retry logic (3 attempts with backoff)
- Logs delivery status to database
- Supports batch dispatching

**Webhook Flow**:
```
Detect Meta-Event → Build Payload → Send HTTP POST → Log Result
                                         ↓ (if failed)
                                    Retry with backoff
```

#### Worker Orchestrator (`index.ts`)
- Runs on cron schedule (configurable, default 30s)
- Fetches active subscriptions
- Checks cooldown period (1 min between notifications)
- Coordinates detection and dispatch
- Handles errors gracefully

### 4. REST API

**Location**: `src/api/`

**Framework**: Express.js with TypeScript

**Endpoints**:

```
POST   /api/subscriptions          - Create subscription
GET    /api/subscriptions          - List subscriptions
GET    /api/subscriptions/:id      - Get subscription
PATCH  /api/subscriptions/:id      - Update subscription
DELETE /api/subscriptions/:id      - Delete subscription
GET    /api/subscriptions/:id/notifications - Get notification history

GET    /api/events                 - Query events
GET    /api/events/stats           - Get event statistics
GET    /health                     - Health check
```

**Validation**: Zod schemas for type-safe request validation

**CORS**: Enabled for all origins (development mode)

## Data Flow Examples

### Example 1: Event Indexing Flow

```
1. Morpho user calls withdraw() on Ethereum
   ↓
2. Transaction mined in block N
   ↓
3. SQD Portal ingests block N
   ↓
4. Indexer queries Portal with filters
   ↓
5. Portal returns matching Withdraw event
   ↓
6. Indexer decodes event using ABI
   ↓
7. Event inserted into PostgreSQL
   {
     event_type: 'morpho_withdraw',
     market_id: '0x...',
     data: { onBehalf: '0x...', assets: '1000000' },
     block_number: N,
     timestamp: ...
   }
   ↓
8. Cursor updated to block N
```

### Example 2: Meta-Event Detection Flow

```
1. Worker wakes up (every 30s)
   ↓
2. Fetch active subscriptions from DB
   ↓
3. For each subscription:
   a. Check cooldown period
   b. Parse meta-event config
   c. Query events in time window
   d. Evaluate condition
   ↓
4. If condition met:
   a. Fetch related events (last 50)
   b. Build webhook payload
   c. Send HTTP POST to webhook URL
   d. Log notification in DB
   ↓
5. Sleep until next interval
```

### Example 3: User Creates Subscription

```
1. User sends POST to /api/subscriptions
   {
     "user_id": "alice",
     "webhook_url": "https://...",
     "meta_event_config": {
       "type": "event_count",
       "event_type": "morpho_withdraw",
       "window": "1h",
       "condition": { "operator": ">", "value": 25 }
     }
   }
   ↓
2. API validates request with Zod schema
   ↓
3. Repository creates subscription in DB
   ↓
4. API returns subscription with ID
   ↓
5. Worker picks up subscription on next cycle
   ↓
6. When condition met, webhook is triggered
```

## Meta-Event Types

### 1. Event Count

**Purpose**: Detect when event frequency exceeds threshold

**Config**:
```json
{
  "type": "event_count",
  "event_type": "morpho_withdraw",
  "window": "1h",
  "condition": { "operator": ">", "value": 25 }
}
```

**SQL Query**:
```sql
SELECT COUNT(*)
FROM events
WHERE event_type = 'morpho_withdraw'
  AND timestamp >= NOW() - INTERVAL '1 hour'
```

### 2. Rolling Aggregate

**Purpose**: Detect when aggregated values exceed threshold

**Config**:
```json
{
  "type": "rolling_aggregate",
  "event_type": "morpho_withdraw",
  "aggregation": "sum",
  "field": "assets",
  "window": "1h",
  "condition": { "operator": ">", "value": 1000000 }
}
```

**SQL Query**:
```sql
SELECT SUM((data->>'assets')::numeric)
FROM events
WHERE event_type = 'morpho_withdraw'
  AND timestamp >= NOW() - INTERVAL '1 hour'
```

### 3. Threshold

**Purpose**: Similar to rolling_aggregate, may have specialized logic

**Implementation**: Currently aliases to rolling_aggregate

## Performance Optimizations

### Database Indexes

```sql
-- Time-series queries
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- Event type filtering
CREATE INDEX idx_events_event_type ON events(event_type);

-- Market-specific queries
CREATE INDEX idx_events_market_id ON events(market_id);

-- Composite index for common query pattern
CREATE INDEX idx_events_composite ON events(event_type, timestamp, market_id);
```

### Query Optimizations

1. **Batch Inserts**: Events inserted in batches, not individually
2. **JSONB Storage**: Flexible schema without additional columns
3. **Window Functions**: PostgreSQL window functions for aggregations
4. **Cursor Management**: Avoid re-processing blocks

### Caching

- **Portal Cache**: Optional SQLite cache for Portal responses (development)
- **Connection Pooling**: PostgreSQL connection pool for efficiency

## Scalability Considerations

### Current Limitations (MVP)

- Single-threaded worker (30s polling interval)
- No horizontal scaling
- All events stored (no pruning)
- Simple retry logic (3 attempts)

### Future Improvements

- **Worker**: Use job queue (Bull, BullMQ) for parallel processing
- **Database**: Partition events table by timestamp
- **Caching**: Add Redis for hot path queries
- **Webhooks**: Implement exponential backoff, dead letter queue
- **Monitoring**: Add Prometheus metrics, Grafana dashboards
- **Rate Limiting**: Prevent abuse of API endpoints

## Security Considerations

### Current State (Development)

- ✅ Input validation with Zod
- ✅ PostgreSQL parameterized queries (SQL injection prevention)
- ⚠️ No authentication/authorization
- ⚠️ No rate limiting
- ⚠️ CORS wide open
- ⚠️ No webhook signature verification

### Production Requirements

- [ ] Add API key authentication
- [ ] Implement rate limiting (per user/IP)
- [ ] Configure CORS properly
- [ ] Add webhook signature (HMAC)
- [ ] Use HTTPS only
- [ ] Add input sanitization
- [ ] Implement request logging/audit trail

## Deployment Architecture

### Development

```
┌─────────────────────────────────────┐
│  Developer Machine                  │
│  ┌────────────┐  ┌────────────┐    │
│  │  Indexer   │  │   Worker   │    │
│  └────────────┘  └────────────┘    │
│  ┌────────────┐                     │
│  │    API     │                     │
│  └────────────┘                     │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Docker Container                   │
│  PostgreSQL                         │
└─────────────────────────────────────┘
```

### Production (Recommended)

```
┌─────────────────────────────────────────────────────┐
│  Load Balancer                                      │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│  API Server  │  │  API Server  │  (Horizontal scaling)
└──────────────┘  └──────────────┘
       │                │
       └────────┬───────┘
                ▼
┌─────────────────────────────────────┐
│  Managed PostgreSQL                 │
│  (AWS RDS, GCP Cloud SQL, etc.)     │
└─────────────────────────────────────┘
                ▲
                │
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Indexer    │  │    Worker    │
│  (Dedicated) │  │  (Dedicated) │
└──────────────┘  └──────────────┘
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Blockchain Data | SQD Portal API | Fast blockchain data access |
| Indexing | SQD Pipes SDK | Event streaming & processing |
| Database | PostgreSQL 16 | Event storage & queries |
| API | Express.js | REST API endpoints |
| Validation | Zod | Type-safe request validation |
| Runtime | Node.js 18+ | JavaScript runtime |
| Language | TypeScript | Type safety |
| Scheduling | node-cron | Worker scheduling |
| HTTP Client | Axios | Webhook delivery |
| Container | Docker | PostgreSQL containerization |

## Monitoring & Observability

### Current Logging

- Console logs with timestamps
- Request logging in API
- Worker execution logs
- Webhook delivery logs

### Recommended Additions

- **Structured Logging**: Use Pino or Winston
- **Metrics**: Prometheus metrics
  - Events indexed per second
  - Webhook success/failure rate
  - Detection latency
  - API request rate
- **Tracing**: OpenTelemetry for distributed tracing
- **Alerting**: PagerDuty/Opsgenie for critical failures

## Future Enhancements

1. **Web Dashboard**: React UI for managing subscriptions
2. **Multi-Chain Support**: Extend to other EVM chains
3. **Advanced Aggregations**: Percentiles, standard deviation, etc.
4. **Event Replay**: Historical backtesting of meta-events
5. **Webhook Templates**: Pre-built integrations (Slack, Discord, Telegram)
6. **API Keys**: User authentication system
7. **Subscription Sharing**: Team/organization management
8. **Event Filtering**: More granular filtering options
9. **Real-time Updates**: WebSocket support for live notifications
10. **Factory Pattern**: Auto-discover new Morpho markets
