# Getting Started with ChaosChain

This guide will help you get ChaosChain up and running in minutes.

## Prerequisites

Make sure you have these installed:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **pnpm** - Install with: `npm install -g pnpm`

Verify installations:
```bash
node --version  # Should be v18 or higher
docker --version
pnpm --version
```

## Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
pnpm install
```

This installs all required packages including the SQD Pipes SDK, Express, PostgreSQL client, and TypeScript tooling.

### Step 2: Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL container. Verify it's running:
```bash
docker compose ps
```

You should see `chaoschain-postgres` with status "Up".

### Step 3: Setup Database

```bash
pnpm db:migrate
```

This creates all necessary tables and indexes. You should see:
```
✅ Database connected: ...
✅ Database migrations completed successfully
```

### Step 4: Start All Services

```bash
pnpm dev
```

This starts three services:
- **Indexer**: Streams Morpho Blue events from Ethereum
- **Worker**: Checks meta-event conditions every 30 seconds
- **API**: REST API on http://localhost:3000

You should see output like:
```
🚀 Starting ChaosChain Indexer...
✅ Database connected
📍 Starting from block: 20000000

🚀 Starting Meta-Event Worker...
⏱️  Check interval: 30 seconds

🚀 Starting ChaosChain API Server...
✅ API Server running on http://localhost:3000
```

## Verify Everything Works

### Check API Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-22T10:30:00.000Z"
}
```

### Check Event Statistics

```bash
curl http://localhost:3000/api/events/stats
```

This shows indexed events. Initially empty, but will populate as the indexer runs.

### View Indexer Progress

Watch the indexer logs - you should see:
```
📦 Processed block 20001234 | Events: 5
✅ Inserted 5 events
```

## Create Your First Subscription

Let's create a subscription that notifies you when there are more than 25 withdrawals in an hour.

### 1. Use webhook.site for testing

Go to https://webhook.site and copy your unique webhook URL.

### 2. Create the subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "name": "High Withdrawal Alert",
    "webhook_url": "https://webhook.site/YOUR-UNIQUE-ID",
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

Replace `YOUR-UNIQUE-ID` with your actual webhook.site ID.

### 3. Check the subscription was created

```bash
curl http://localhost:3000/api/subscriptions?user_id=demo_user
```

You should see your subscription in the response.

### 4. Wait for the condition to trigger

The worker checks every 30 seconds. When the condition is met, you'll see a webhook appear on webhook.site!

## Useful Commands

### Start Services Individually

```bash
# Terminal 1 - Indexer only
pnpm indexer

# Terminal 2 - Worker only
pnpm worker

# Terminal 3 - API only
pnpm api
```

### Database Commands

```bash
# Connect to PostgreSQL
docker exec -it chaoschain-postgres psql -U postgres -d chaoschain

# View events table
SELECT event_type, COUNT(*) FROM events GROUP BY event_type;

# View subscriptions
SELECT * FROM subscriptions;

# Exit psql
\q
```

### Stop Services

```bash
# Stop all services: Ctrl+C in terminal

# Stop PostgreSQL
docker compose down

# Stop and delete all data
docker compose down -v
```

### Reset Everything

```bash
# Stop and delete database
docker compose down -v

# Start fresh
docker compose up -d
pnpm db:migrate
```

## Common Issues & Solutions

### "Database connection failed"

**Problem**: PostgreSQL isn't running

**Solution**:
```bash
docker compose up -d
```

Wait a few seconds and try again.

### "Port 3000 already in use"

**Problem**: Another service is using port 3000

**Solution**: Change `API_PORT` in `.env`:
```
API_PORT=3001
```

### "No events being indexed"

**Possible causes**:
1. **Start block too high**: Lower `INDEXER_START_BLOCK` in `.env` to a block with activity
2. **Network issues**: Check SQD Portal is accessible
3. **No matching events**: Morpho activity might be sparse at your start block

**Solution**: Try a known active block range (e.g., 20000000-20100000)

### Worker not triggering webhooks

**Check**:
1. Is the subscription active? `curl http://localhost:3000/api/subscriptions`
2. Are there enough events? `curl http://localhost:3000/api/events/stats`
3. Is the condition correct? Count events manually
4. Check worker logs for errors

## Next Steps

### 1. Explore Examples

Check out `EXAMPLES.md` for real-world subscription patterns:
- Liquidation cascade detection
- Whale withdrawal alerts
- Supply/borrow surge monitoring

### 2. Query Events

```bash
# Get recent withdrawals
curl "http://localhost:3000/api/events?event_type=morpho_withdraw&limit=10"

# Get events for a specific market
curl "http://localhost:3000/api/events?market_id=0x..."

# Get events in a block range
curl "http://localhost:3000/api/events?from_block=20000000&to_block=20001000"
```

### 3. Manage Subscriptions

```bash
# List all subscriptions
curl http://localhost:3000/api/subscriptions

# Get specific subscription
curl http://localhost:3000/api/subscriptions/{id}

# Update subscription
curl -X PATCH http://localhost:3000/api/subscriptions/{id} \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Delete subscription
curl -X DELETE http://localhost:3000/api/subscriptions/{id}

# View notification history
curl http://localhost:3000/api/subscriptions/{id}/notifications
```

### 4. Read the Documentation

- **README.md** - Full documentation and API reference
- **ARCHITECTURE.md** - System design deep-dive
- **EXAMPLES.md** - Usage patterns and examples
- **PROJECT_SUMMARY.md** - High-level overview

## Development Tips

### Faster Iteration with Cache

Enable Portal caching for faster development:
```bash
# In .env
INDEXER_USE_CACHE=true
```

This caches Portal responses locally in `portal-cache.sqlite`.

### Lower Start Block

For faster testing, use a recent block:
```bash
# In .env
INDEXER_START_BLOCK=21000000  # Recent block
```

### Adjust Worker Interval

For faster testing, reduce the check interval:
```bash
# In .env
WORKER_INTERVAL_SECONDS=10  # Check every 10 seconds
```

### Debug Logging

Enable debug logs:
```bash
# In .env
LOG_LEVEL=debug
```

## Building for Production

```bash
# Build TypeScript
pnpm build

# Run compiled code
pnpm start
```

See README.md for production deployment recommendations.

## Getting Help

### Check Logs

- **Indexer logs**: Shows block processing and event insertion
- **Worker logs**: Shows subscription checks and webhook delivery
- **API logs**: Shows HTTP requests

### Inspect Database

```bash
docker exec -it chaoschain-postgres psql -U postgres -d chaoschain

# Useful queries:
SELECT COUNT(*) FROM events;
SELECT * FROM subscriptions;
SELECT * FROM notifications_log ORDER BY triggered_at DESC LIMIT 10;
```

### Common Queries

**How many events indexed?**
```sql
SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type;
```

**What's the latest block?**
```sql
SELECT MAX(block_number) FROM events;
```

**Which subscriptions are active?**
```sql
SELECT name, webhook_url FROM subscriptions WHERE is_active = true;
```

**Recent webhook deliveries?**
```sql
SELECT s.name, n.triggered_at, n.webhook_response_status
FROM notifications_log n
JOIN subscriptions s ON s.id = n.subscription_id
ORDER BY n.triggered_at DESC
LIMIT 20;
```

## What's Next?

Now that you have ChaosChain running:

1. **Create meaningful subscriptions** - Monitor real Morpho markets
2. **Integrate with your app** - Use webhooks to trigger actions
3. **Explore the codebase** - Understand how it works
4. **Extend functionality** - Add new event types or aggregations
5. **Deploy to production** - See README.md for guidance

## Resources

- **SQD Documentation**: https://beta.docs.sqd.dev/
- **Morpho Blue Docs**: https://docs.morpho.org/
- **webhook.site**: https://webhook.site (for testing webhooks)

---

**Need help?** Check the documentation files or open an issue on GitHub.

**Ready to build?** Start with `EXAMPLES.md` for inspiration!
