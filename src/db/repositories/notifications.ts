import { query } from '../client.js';
import type { NotificationLog } from '../../types/index.js';

export const notificationsRepository = {
  async createNotificationLog(
    subscriptionId: string,
    triggeredAt: Date,
    payload: Record<string, unknown>,
    webhookResponseStatus?: number
  ): Promise<NotificationLog> {
    const result = await query<NotificationLog>(
      `INSERT INTO notifications_log (subscription_id, triggered_at, payload, webhook_response_status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [subscriptionId, triggeredAt, JSON.stringify(payload), webhookResponseStatus ?? null]
    );

    return result.rows[0];
  },

  async updateRetryCount(id: string, retryCount: number): Promise<void> {
    await query('UPDATE notifications_log SET retry_count = $1 WHERE id = $2', [retryCount, id]);
  },

  async updateWebhookResponse(id: string, status: number): Promise<void> {
    await query('UPDATE notifications_log SET webhook_response_status = $1 WHERE id = $2', [
      status,
      id,
    ]);
  },

  async getRecentNotifications(subscriptionId: string, limit = 50): Promise<NotificationLog[]> {
    const result = await query<NotificationLog>(
      `SELECT * FROM notifications_log
       WHERE subscription_id = $1
       ORDER BY triggered_at DESC
       LIMIT $2`,
      [subscriptionId, limit]
    );

    return result.rows;
  },

  async getLastNotificationTime(subscriptionId: string): Promise<Date | null> {
    const result = await query<{ triggered_at: Date }>(
      `SELECT triggered_at FROM notifications_log
       WHERE subscription_id = $1
       ORDER BY triggered_at DESC
       LIMIT 1`,
      [subscriptionId]
    );

    return result.rows[0]?.triggered_at ?? null;
  },
};
