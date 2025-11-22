import axios from 'axios';
import type { WebhookPayload } from '../types/index.js';
import { notificationsRepository } from '../db/repositories/notifications.js';

export class WebhookDispatcher {
  private maxRetries = 3;
  private retryDelayMs = 1000;

  async dispatch(
    subscriptionId: string,
    webhookUrl: string,
    payload: WebhookPayload
  ): Promise<boolean> {
    // Create notification log
    const log = await notificationsRepository.createNotificationLog(
      subscriptionId,
      new Date(payload.triggered_at),
      payload
    );

    let success = false;
    let lastStatus = 0;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TellTide-Webhook/1.0',
          },
        });

        lastStatus = response.status;

        if (response.status >= 200 && response.status < 300) {
          success = true;
          break;
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          lastStatus = error.response?.status ?? 0;

          // Handle 404 specially - don't retry, it's a config issue
          if (lastStatus === 404) {
            console.error(`   ❌ Webhook 404: ${webhookUrl}`);
            break;
          }
        }

        // Wait before retry (skip for 404)
        if (attempt < this.maxRetries - 1 && lastStatus !== 404) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
        }
      }

      await notificationsRepository.updateRetryCount(log.id, attempt + 1);
    }

    // Update final status
    if (lastStatus > 0) {
      await notificationsRepository.updateWebhookResponse(log.id, lastStatus);
    }

    return success;
  }

  async dispatchBatch(
    notifications: Array<{
      subscriptionId: string;
      webhookUrl: string;
      payload: WebhookPayload;
    }>
  ): Promise<{ successful: number; failed: number }> {
    const results = await Promise.allSettled(
      notifications.map((n) => this.dispatch(n.subscriptionId, n.webhookUrl, n.payload))
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;

    return { successful, failed };
  }
}
