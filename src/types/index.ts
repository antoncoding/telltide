// Event Types
export type EventType =
  | 'erc20_transfer'
  | 'erc4626_deposit'
  | 'erc4626_withdraw'
  | 'morpho_supply'
  | 'morpho_withdraw'
  | 'morpho_borrow'
  | 'morpho_repay';

// Database Models
export type Event = {
  id: string;
  chain: string; // ethereum, base, etc.
  block_number: number;
  timestamp: Date;
  event_type: EventType;
  contract_address: string;
  from_address: string | null;
  to_address: string | null;
  data: Record<string, unknown>;
  transaction_hash: string;
  log_index: number;
  created_at: Date;
};

export type MetaEventConditionType = 'rolling_aggregate' | 'event_count' | 'net_aggregate';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

// Simplified meta-event config (absolute values only)
export type MetaEventConfig = {
  type: MetaEventConditionType;
  event_type: EventType;
  chain?: string; // ethereum, base, etc. (defaults to ethereum)
  contracts?: string[]; // Multiple contracts to check (OR logic)
  contract_address?: string; // Single contract (backwards compat)
  market_id?: string; // For Morpho markets: filter by market ID (bytes32)
  from_address?: string; // For ERC20 transfers from specific address
  to_address?: string; // For ERC20 transfers to specific address
  window: string; // e.g., "1h", "15m", "24h"
  lookback_blocks?: number; // Optional: How many blocks back to look (overrides time-based lookback)
  aggregation?: AggregationType;
  field?: string;
  // For net_aggregate type: calculate difference between two event types
  positive_event_type?: EventType; // e.g., morpho_supply, morpho_borrow
  negative_event_type?: EventType; // e.g., morpho_withdraw, morpho_repay
  condition: {
    operator: ComparisonOperator;
    value: number | string; // Absolute value only
  };
};

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  meta_event_config: MetaEventConfig;
  cooldown_minutes?: number; // Optional: minimum minutes between notifications (default: 1)
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type NotificationLog = {
  id: string;
  subscription_id: string;
  triggered_at: Date;
  payload: Record<string, unknown>;
  webhook_response_status: number | null;
  retry_count: number;
  created_at: Date;
};

// API Request/Response Types
export type CreateSubscriptionRequest = {
  user_id: string;
  name: string;
  webhook_url: string;
  meta_event_config: MetaEventConfig;
  cooldown_minutes?: number; // Optional: minimum minutes between notifications (default: 1)
};

export type SubscriptionResponse = {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  meta_event_config: MetaEventConfig;
  cooldown_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookPayload = {
  subscription_id: string;
  subscription_name: string;
  triggered_at: string;
  meta_event: {
    type: string;
    aggregated_value?: number;
    threshold?: number;
    window: string;
    triggered_by_contract?: string; // Which contract triggered (if multiple)
  };
  events: Event[];
};
