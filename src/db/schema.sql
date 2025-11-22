-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table - stores recent blockchain events (rolling window)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  UNIQUE(transaction_hash, log_index)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_events_block_number ON events(block_number);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_contract_address ON events(contract_address);
CREATE INDEX IF NOT EXISTS idx_events_from_address ON events(from_address) WHERE from_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_composite ON events(event_type, timestamp, contract_address);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  webhook_url TEXT NOT NULL,
  meta_event_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);

-- Notifications log table
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP NOT NULL,
  payload JSONB NOT NULL,
  webhook_response_status INTEGER,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id ON notifications_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_triggered_at ON notifications_log(triggered_at);

-- Cursor table for indexer state management
CREATE TABLE IF NOT EXISTS indexer_cursor (
  id VARCHAR(50) PRIMARY KEY,
  block_number BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default cursor
INSERT INTO indexer_cursor (id, block_number) VALUES ('main', 0) ON CONFLICT (id) DO NOTHING;
