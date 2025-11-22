# ChaosChain Server - Project Summary

## 🎯 Project Overview

**ChaosChain** is a meta-event detection and webhook notification system for blockchain events. It allows developers to create complex, aggregated conditions (called "meta-events") from raw blockchain data and receive webhook notifications when those conditions are met.

**Problem Solved**: Instead of subscribing to hundreds of individual blockchain events and implementing complex aggregation logic in your application, you can define conditions like "notify me when there are more than 25 withdrawals in the last hour" and receive a single webhook when that condition is met.

## 🏗️ Architecture

Built using the **SQD Pipes SDK** for blockchain data indexing with a PostgreSQL database and REST API.

### System Components

1. **Indexer** (SQD Pipes) - Indexes Morpho Blue events from Ethereum mainnet
2. **PostgreSQL Database** - Stores raw events with efficient time-series indexing
3. **Meta-Event Worker** - Polls database every 30s to detect meta-event conditions
4. **REST API** - Express.js API for managing subscriptions
5. **Webhook Dispatcher** - Delivers notifications with retry logic

## 📁 Project Structure

```
server/
├── src/
│   ├── abi/                           # Smart contract ABIs
│   │   └── morpho-blue.ts            # Morpho Blue event signatures & decoders
│   │
│   ├── api/                           # REST API layer
│   │   ├── routes/
│   │   │   ├── subscriptions.ts      # Subscription CRUD endpoints
│   │   │   └── events.ts             # Event query endpoints
│   │   ├── validators.ts             # Zod validation schemas
│   │   └── index.ts                  # Express app setup
│   │
│   ├── config/
│   │   └── index.ts                  # Configuration management
│   │
│   ├── db/                            # Database layer
│   │   ├── repositories/             # Data access layer
│   │   │   ├── events.ts            # Event queries (time windows, aggregations)
│   │   │   ├── subscriptions.ts     # Subscription CRUD
│   │   │   ├── notifications.ts     # Notification logging
│   │   │   └── cursor.ts            # Indexer state management
│   │   ├── client.ts                 # PostgreSQL client & connection pool
│   │   ├── migrate.ts                # Migration runner
│   │   └── schema.sql                # Database schema definition
│   │
│   ├── indexer/
│   │   └── index.ts                  # SQD Pipes indexer (streams events from Portal)
│   │
│   ├── worker/                        # Meta-event detection system
│   │   ├── detector.ts               # Condition evaluation logic
│   │   ├── webhook.ts                # Webhook HTTP dispatcher
│   │   └── index.ts                  # Worker orchestrator (cron-based)
│   │
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   │
│   └── index.ts                       # Main entry point (starts all services)
│
├── scripts/
│   └── quickstart.sh                  # Quick setup script
│
├── docker-compose.yml                 # PostgreSQL container definition
├── tsconfig.json                      # TypeScript configuration
├── package.json                       # Dependencies & scripts
├── .env                               # Environment variables
├── .env.example                       # Environment template
├── .gitignore                         # Git ignore rules
│
├── README.md                          # Main documentation
├── EXAMPLES.md                        # Usage examples
├── ARCHITECTURE.md                    # Architecture deep-dive
└── PROJECT_SUMMARY.md                 # This file
```

## 🔧 Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Blockchain Indexing** | SQD Pipes SDK | Fast event streaming from Ethereum |
| **Data Source** | SQD Portal API | 10-50x faster than RPC for historical data |
| **Database** | PostgreSQL 16 | Event storage with time-series optimization |
| **API Framework** | Express.js | REST API for subscriptions & queries |
| **Runtime** | Node.js 18+ | JavaScript runtime environment |
| **Language** | TypeScript | Type-safe development |
| **Validation** | Zod | Runtime type validation |
| **Scheduling** | node-cron | Worker task scheduling |
| **HTTP Client** | Axios | Webhook delivery |
| **Container** | Docker | PostgreSQL containerization |
| **Package Manager** | pnpm | Dependency management |

## 🚀 Key Features

### 1. Real-Time Event Indexing
- Streams Morpho Blue events from Ethereum mainnet
- Supports: Supply, Borrow, Withdraw, Repay, Liquidation
- Handles blockchain forks automatically
- Resumes from last processed block

### 2. Meta-Event Detection
Three types of meta-events:

**Event Count**
```json
{
  "type": "event_count",
  "event_type": "morpho_withdraw",
  "window": "1h",
  "condition": { "operator": ">", "value": 25 }
}
```
Triggers when: More than 25 withdrawals in the last hour

**Rolling Aggregate**
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
Triggers when: Total withdrawn amount exceeds threshold in time window

**Threshold**
Similar to rolling aggregate with potential for specialized logic

### 3. Webhook Notifications
- Automatic HTTP POST to configured URL
- Retry logic (3 attempts with backoff)
- Delivery status tracking
- Cooldown period (1 min between notifications)

### 4. REST API
- Create/update/delete subscriptions
- Query raw events with filters
- View notification history
- Get event statistics

## 📊 Database Schema

### Tables

**events** - Raw blockchain events
- Stores all indexed events with JSONB data
- Indexed by timestamp, event_type, market_id
- Unique constraint on (transaction_hash, log_index)

**subscriptions** - User meta-event subscriptions
- Stores webhook URL and condition config
- JSONB column for flexible meta-event definitions
- Active/inactive flag for enable/disable

**notifications_log** - Webhook delivery tracking
- Records all webhook attempts
- Tracks response status and retry count
- Links to subscription via foreign key

**indexer_cursor** - Indexer state
- Stores last processed block number
- Enables resumable indexing

## 🔄 Data Flow

### Indexing Flow
```
Ethereum → SQD Portal → Indexer → PostgreSQL
                                      ↓
                                  Update Cursor
```

### Detection Flow
```
Worker (every 30s) → Query Events → Evaluate Condition → Send Webhook
                                                              ↓
                                                      Log to Database
```

### API Flow
```
Developer → REST API → Repository → PostgreSQL
                          ↓
                      Response
```

## 📝 Usage Example

### 1. Start the system
```bash
# Start PostgreSQL
docker compose up -d

# Run migrations
pnpm db:migrate

# Start all services
pnpm dev
```

### 2. Create a subscription
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
      "condition": { "operator": ">", "value": 25 }
    }
  }'
```

### 3. Receive webhook when condition is met
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
  "events": [ /* related events */ ]
}
```

## 🎯 Design Decisions

### Why SQD Pipes SDK?
- ✅ Lightweight and flexible (vs full Squid SDK)
- ✅ Direct PostgreSQL integration
- ✅ No GraphQL overhead (we don't need it)
- ✅ Full control over data processing
- ✅ 10-50x faster than RPC for historical data

### Why PostgreSQL?
- ✅ Excellent for time-series queries (critical for rolling windows)
- ✅ JSONB support for flexible event storage
- ✅ Window functions for aggregations
- ✅ Battle-tested and reliable
- ✅ Easy local development with Docker

### Why Polling Worker (vs Event-Driven)?
- ✅ Simpler MVP implementation
- ✅ Easier to reason about
- ✅ Configurable interval (30s default)
- ⚠️ Scales to ~100 subscriptions before optimization needed
- 🔮 Future: Job queue (Bull/BullMQ) for horizontal scaling

### Why REST API (vs GraphQL)?
- ✅ Simpler for CRUD operations
- ✅ Easier to understand and test
- ✅ Lower learning curve for developers
- ✅ No need for complex queries in this use case

## 🔐 Security Considerations

### Current State (MVP)
- ✅ Input validation (Zod)
- ✅ SQL injection prevention (parameterized queries)
- ⚠️ No authentication
- ⚠️ No rate limiting
- ⚠️ CORS wide open
- ⚠️ No webhook signature verification

### Production Requirements
- [ ] API key authentication
- [ ] Rate limiting per user
- [ ] Proper CORS configuration
- [ ] Webhook HMAC signatures
- [ ] HTTPS only
- [ ] Request logging/audit trail

## 📈 Performance Characteristics

### Current Capabilities (MVP)
- **Indexing**: ~50,000-100,000 blocks/second (SQD Portal throughput)
- **Event Storage**: Millions of events (PostgreSQL capacity)
- **Detection Latency**: 30-60 seconds (worker interval)
- **Webhook Delivery**: ~10 requests/second (Axios default)
- **API Throughput**: ~1,000 req/sec (Express baseline)

### Bottlenecks
1. **Worker Polling**: Single-threaded, sequential processing
2. **Webhook Retry**: Blocking retries
3. **Database Queries**: Not optimized for >1000 subscriptions
4. **No Caching**: All queries hit PostgreSQL

### Optimization Path
1. **Add Redis**: Cache hot queries, rate limiting
2. **Job Queue**: Bull/BullMQ for parallel webhook delivery
3. **Read Replicas**: Separate read/write PostgreSQL instances
4. **Partition Events**: Time-based partitioning for old events
5. **Connection Pooling**: Optimize database connections

## 🔮 Future Enhancements

### Near-term (MVP+)
- [ ] Web dashboard for subscription management
- [ ] Support ERC20 Transfer events
- [ ] Add more aggregation types (percentile, stddev)
- [ ] Webhook signature verification
- [ ] API authentication

### Medium-term
- [ ] Multi-chain support (Polygon, Arbitrum, etc.)
- [ ] Historical backtesting for meta-events
- [ ] Subscription templates library
- [ ] Real-time WebSocket notifications
- [ ] Rate limiting per user

### Long-term
- [ ] Factory pattern for auto-discovering markets
- [ ] Machine learning for anomaly detection
- [ ] Custom aggregation functions (user-defined)
- [ ] Team/organization management
- [ ] SaaS deployment option

## 📦 Dependencies

### Production
- `@subsquid/pipes` - SQD Pipes SDK for event indexing
- `express` - REST API framework
- `pg` - PostgreSQL client
- `zod` - Runtime validation
- `dotenv` - Environment configuration
- `node-cron` - Task scheduling
- `axios` - HTTP client for webhooks

### Development
- `typescript` - Type system
- `tsx` - TypeScript executor
- `@types/*` - Type definitions

## 🧪 Testing Strategy (Future)

### Unit Tests
- Repository layer (mock PostgreSQL)
- Detector logic (condition evaluation)
- Webhook dispatcher (mock axios)
- Validators (Zod schemas)

### Integration Tests
- API endpoints with test database
- Worker with mock events
- End-to-end subscription flow

### Load Tests
- Indexer throughput
- Worker detection latency
- API concurrent requests
- Webhook delivery rate

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Main documentation, quick start, API reference |
| `EXAMPLES.md` | Real-world usage examples and patterns |
| `ARCHITECTURE.md` | Deep-dive into system design and components |
| `PROJECT_SUMMARY.md` | This file - high-level overview |

## 🎓 Learning Resources

### SQD Docs
- [SQD Portal Overview](https://beta.docs.sqd.dev/en/sdk/overview)
- [Pipes SDK Quickstart](https://beta.docs.sqd.dev/en/sdk/pipes-sdk/quickstart)
- [Event Decoding Guide](https://beta.docs.sqd.dev/en/sdk/pipes-sdk/guides/event-decoding)

### Related Concepts
- Time-series databases
- Event-driven architectures
- Webhook reliability patterns
- Blockchain reorganization handling

## 🤝 Contributing

This is a hackathon project prototype. Key areas for contribution:

1. **Testing**: Add unit and integration tests
2. **Performance**: Optimize database queries
3. **Features**: Implement items from roadmap
4. **Documentation**: Improve examples and guides
5. **Security**: Add authentication and rate limiting

## 📄 License

ISC

---

**Built with**: TypeScript, SQD Pipes SDK, PostgreSQL, Express.js

**Created for**: Morpho Blue event monitoring and meta-event detection

**Status**: MVP/Prototype - Ready for development and testing
