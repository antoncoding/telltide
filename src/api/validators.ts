import { z } from 'zod';

const eventTypeSchema = z.enum(['erc20_transfer', 'erc4626_deposit', 'erc4626_withdraw']);

const comparisonOperatorSchema = z.enum(['>', '<', '>=', '<=', '=', '!=']);

const aggregationTypeSchema = z.enum(['sum', 'avg', 'count', 'min', 'max']);

const metaEventConfigSchema = z.object({
  type: z.enum(['rolling_aggregate', 'event_count']),
  event_type: eventTypeSchema,
  chain: z.enum(['ethereum', 'base']).optional(),
  contracts: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).optional(),
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  from_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  to_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  window: z.string().regex(/^\d+(m|h|d)$/),
  lookback_blocks: z.number().int().positive().optional(),
  aggregation: aggregationTypeSchema.optional(),
  field: z.string().optional(),
  condition: z.object({
    operator: comparisonOperatorSchema,
    value: z.union([z.number(), z.string()]),
  }),
});

export const createSubscriptionSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().min(1).max(255),
  webhook_url: z.string().url(),
  meta_event_config: metaEventConfigSchema,
  cooldown_minutes: z.number().int().positive().optional(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  webhook_url: z.string().url().optional(),
  meta_event_config: metaEventConfigSchema.optional(),
  cooldown_minutes: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export const queryEventsSchema = z.object({
  event_type: eventTypeSchema.optional(),
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  from_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  to_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  from_block: z.coerce.number().int().positive().optional(),
  to_block: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});
