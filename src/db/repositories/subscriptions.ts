import { query } from '../client.js';
import type { Subscription, MetaEventConfig } from '../../types/index.js';

export const subscriptionsRepository = {
  async createSubscription(
    userId: string,
    name: string,
    webhookUrl: string,
    metaEventConfig: MetaEventConfig
  ): Promise<Subscription> {
    const result = await query<Subscription>(
      `INSERT INTO subscriptions (user_id, name, webhook_url, meta_event_config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, webhookUrl, JSON.stringify(metaEventConfig)]
    );

    return result.rows[0];
  },

  async getSubscriptionById(id: string): Promise<Subscription | null> {
    const result = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE id = $1',
      [id]
    );

    return result.rows[0] ?? null;
  },

  async getActiveSubscriptions(): Promise<Subscription[]> {
    const result = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE is_active = TRUE'
    );

    return result.rows;
  },

  async getSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
    const result = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows;
  },

  async updateSubscription(
    id: string,
    updates: Partial<Pick<Subscription, 'name' | 'webhook_url' | 'meta_event_config' | 'is_active'>>
  ): Promise<Subscription | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.webhook_url !== undefined) {
      fields.push(`webhook_url = $${paramIndex++}`);
      values.push(updates.webhook_url);
    }

    if (updates.meta_event_config !== undefined) {
      fields.push(`meta_event_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.meta_event_config));
    }

    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return this.getSubscriptionById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<Subscription>(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  },

  async deleteSubscription(id: string): Promise<boolean> {
    const result = await query('DELETE FROM subscriptions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
