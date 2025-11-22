# Migration Guide: Adding Multi-Chain Support

## What Changed

This migration adds:
1. **`chain` column** to events table (ethereum, base, etc.)
2. **`cooldown_minutes` column** to subscriptions table
3. Updated unique constraints and indexes

## How to Migrate

Run the migration script:

```bash
pnpm db:migrate:chain
```

This will:
- ✅ Add `chain` column to events (defaults to 'ethereum')
- ✅ Add `cooldown_minutes` to subscriptions (defaults to 1)
- ✅ Update unique constraint to include chain
- ✅ Add chain indexes for performance
- ✅ Preserve all existing data

## Verification

After migration, verify:

```bash
# Connect to database
docker exec -it telltide-postgres psql -U postgres -d telltide

# Check new columns exist
\d events
\d subscriptions
```

You should see:
- `chain` column in events table
- `cooldown_minutes` column in subscriptions table

## Safe to Run

- ✅ Non-destructive: Preserves all existing data
- ✅ Idempotent: Safe to run multiple times
- ✅ Uses IF NOT EXISTS checks
- ✅ Defaults existing events to 'ethereum'

## Next Steps

After migration:
1. Update your `.env` with new RPC URLs (see `.env.example`)
2. Restart your services
3. Create subscriptions with optional `chain` field

```json
{
  "meta_event_config": {
    "chain": "base",  // 👈 Optional, defaults to ethereum
    "event_type": "erc20_transfer",
    ...
  }
}
```
