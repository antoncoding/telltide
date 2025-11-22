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
        console.log(
          `📤 Sending webhook to ${webhookUrl} (attempt ${attempt + 1}/${this.maxRetries})`
        );

        const response = await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ChaosChain-Webhook/1.0',
          },
        });

        lastStatus = response.status;

        if (response.status >= 200 && response.status < 300) {
          console.log(`✅ Webhook delivered successfully (${response.status})`);
          success = true;
          break;
        } else {
          console.warn(`⚠️  Webhook returned non-2xx status: ${response.status}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          lastStatus = error.response?.status ?? 0;
          console.error(
            `❌ Webhook delivery failed (attempt ${attempt + 1}):`,
            error.message
          );
        } else {
          console.error(`❌ Unexpected error sending webhook:`, error);
        }

        // Wait before retry
        if (attempt < this.maxRetries - 1) {
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
