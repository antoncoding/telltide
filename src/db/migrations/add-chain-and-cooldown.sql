-- Migration: Add chain column to events and cooldown_minutes to subscriptions

-- Add chain column to events table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'events' AND column_name = 'chain') THEN
        ALTER TABLE events ADD COLUMN chain VARCHAR(20) NOT NULL DEFAULT 'ethereum';
    END IF;
END $$;

-- Add cooldown_minutes column to subscriptions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'subscriptions' AND column_name = 'cooldown_minutes') THEN
        ALTER TABLE subscriptions ADD COLUMN cooldown_minutes INTEGER DEFAULT 1;
    END IF;
END $$;

-- Drop old unique constraint if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'events_transaction_hash_log_index_key') THEN
        ALTER TABLE events DROP CONSTRAINT events_transaction_hash_log_index_key;
    END IF;
END $$;

-- Add new unique constraint with chain
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'events_chain_tx_log_key') THEN
        ALTER TABLE events ADD CONSTRAINT events_chain_tx_log_key
            UNIQUE(chain, transaction_hash, log_index);
    END IF;
END $$;

-- Create chain index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_events_chain ON events(chain);

-- Drop old composite index if it exists
DROP INDEX IF EXISTS idx_events_composite;

-- Create new composite index with chain
CREATE INDEX IF NOT EXISTS idx_events_composite ON events(chain, event_type, timestamp, contract_address);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$;
