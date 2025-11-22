// Event Types
export type EventType = 'erc20_transfer' | 'erc4626_deposit' | 'erc4626_withdraw';

// Database Models
export type Event = {
  id: string;
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

export type MetaEventConditionType = 'rolling_aggregate' | 'event_count';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

// Simplified meta-event config (absolute values only)
export type MetaEventConfig = {
  type: MetaEventConditionType;
  event_type: EventType;
  contracts?: string[]; // Multiple contracts to check (OR logic)
  contract_address?: string; // Single contract (backwards compat)
  from_address?: string; // For ERC20 transfers from specific address
  to_address?: string; // For ERC20 transfers to specific address
  window: string; // e.g., "1h", "15m", "24h"
  aggregation?: AggregationType;
  field?: string;
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
};

export type SubscriptionResponse = {
  id: string;
  user_id: string;
  name: string;
  webhook_url: string;
  meta_event_config: MetaEventConfig;
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
    condition_met: boolean;
    aggregated_value?: number;
    threshold?: number;
    window: string;
    triggered_by_contract?: string; // Which contract triggered (if multiple)
  };
  events: Array<{
    block_number: number;
    timestamp: string;
    event_type: EventType;
    contract_address: string;
    data: Record<string, unknown>;
  }>;
};
