import cron from 'node-cron';
import { config } from '../config/index.js';
import { testConnection } from '../db/client.js';
import { subscriptionsRepository } from '../db/repositories/subscriptions.js';
import { notificationsRepository } from '../db/repositories/notifications.js';
import { MetaEventDetector } from './detector.js';
import { WebhookDispatcher } from './webhook.js';
import type { WebhookPayload } from '../types/index.js';

const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });

class MetaEventWorker {
  private detector: MetaEventDetector;
  private dispatcher: WebhookDispatcher;
  private isRunning = false;

  constructor() {
    this.detector = new MetaEventDetector();
    this.dispatcher = new WebhookDispatcher();
  }

  async processSubscriptions(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const subscriptions = await subscriptionsRepository.getActiveSubscriptions();

      if (subscriptions.length === 0) {
        return; // Silent when no subscriptions
      }

      const notifications: Array<{
        subscriptionId: string;
        webhookUrl: string;
        payload: WebhookPayload;
      }> = [];

      for (const subscription of subscriptions) {
        try {
          const lastNotification = await notificationsRepository.getLastNotificationTime(
            subscription.id
          );

          if (lastNotification) {
            const cooldownMs = (subscription.cooldown_minutes ?? 1) * 60 * 1000;
            const timeSinceLastNotification = Date.now() - lastNotification.getTime();
            if (timeSinceLastNotification < cooldownMs) {
              continue; // Silent cooldown
            }
          }

          const result = await this.detector.detect(subscription);

          if (result.triggered) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🚨 META-EVENT TRIGGERED: "${subscription.name}"`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`   Type: ${subscription.meta_event_config.type}`);
            console.log(`   Window: ${result.window}`);
            if (result.aggregatedValue !== undefined) {
              console.log(`   Value: ${result.aggregatedValue} (threshold: ${result.threshold})`);
            }
            if (result.eventCount !== undefined) {
              console.log(`   Events: ${result.eventCount} (threshold: ${result.threshold})`);
            }
            if (result.triggeredByContract) {
              console.log(`   Contract: ${result.triggeredByContract}`);
            }
            console.log(`   Webhook: ${subscription.webhook_url}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            const payload: WebhookPayload = {
              subscription_id: subscription.id,
              subscription_name: subscription.name,
              triggered_at: new Date().toISOString(),
              meta_event: {
                type: subscription.meta_event_config.type,
                condition_met: true,
                aggregated_value: result.aggregatedValue,
                threshold: result.threshold,
                window: result.window,
                triggered_by_contract: result.triggeredByContract,
              },
            };

            notifications.push({
              subscriptionId: subscription.id,
              webhookUrl: subscription.webhook_url,
              payload,
            });
          }
        } catch (error) {
          console.error(`❌ Error processing subscription ${subscription.id}:`, error);
        }
      }

      if (notifications.length > 0) {
        await this.dispatcher.dispatchBatch(notifications);
      }
    } catch (error) {
      console.error('❌ Worker error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start(): void {
    console.log(`[${timestamp()}] INFO: Worker starting | interval=${config.worker.intervalSeconds}s`);

    const cronExpression = `*/${config.worker.intervalSeconds} * * * * *`;

    cron.schedule(cronExpression, () => {
      this.processSubscriptions().catch(console.error);
    });

    this.processSubscriptions().catch(console.error);
  }
}

async function main() {
  const connected = await testConnection();
  if (!connected) {
    console.error(`[${timestamp()}] ERROR: Failed to connect to database`);
    process.exit(1);
  }

  const worker = new MetaEventWorker();
  worker.start();

  process.on('SIGINT', () => {
    console.log(`\n[${timestamp()}] INFO: Shutting down`);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Worker startup error:', error);
  process.exit(1);
});
