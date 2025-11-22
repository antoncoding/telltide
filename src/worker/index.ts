import cron from 'node-cron';
import { config } from '../config/index.js';
import { testConnection } from '../db/client.js';
import { subscriptionsRepository } from '../db/repositories/subscriptions.js';
import { notificationsRepository } from '../db/repositories/notifications.js';
import { MetaEventDetector } from './detector.js';
import { WebhookDispatcher } from './webhook.js';
import type { WebhookPayload } from '../types/index.js';

class MetaEventWorker {
  private detector: MetaEventDetector;
  private dispatcher: WebhookDispatcher;
  private isRunning = false;
  private minNotificationIntervalMs = 60 * 1000;

  constructor() {
    this.detector = new MetaEventDetector();
    this.dispatcher = new WebhookDispatcher();
  }

  async processSubscriptions(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️  Previous check still running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔍 Checking active subscriptions...');

      const subscriptions = await subscriptionsRepository.getActiveSubscriptions();

      if (subscriptions.length === 0) {
        console.log('📭 No active subscriptions found');
        return;
      }

      console.log(`📋 Found ${subscriptions.length} active subscription(s)`);

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
            const timeSinceLastNotification = Date.now() - lastNotification.getTime();
            if (timeSinceLastNotification < this.minNotificationIntervalMs) {
              console.log(
                `⏰ Skipping ${subscription.name} - notified ${Math.round(timeSinceLastNotification / 1000)}s ago`
              );
              continue;
            }
          }

          const result = await this.detector.detect(subscription);

          if (result.triggered) {
            console.log(`🎯 Meta-event triggered for "${subscription.name}"!`);
            if (result.triggeredByContract) {
              console.log(`   Triggered by contract: ${result.triggeredByContract}`);
            }

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
          } else {
            console.log(`⚪ No trigger for "${subscription.name}"`);
          }
        } catch (error) {
          console.error(`❌ Error processing subscription ${subscription.id}:`, error);
        }
      }

      if (notifications.length > 0) {
        console.log(`📤 Dispatching ${notifications.length} webhook(s)...`);
        const { successful, failed } = await this.dispatcher.dispatchBatch(notifications);
        console.log(`✅ Successful: ${successful} | ❌ Failed: ${failed}`);
      }

      const duration = Date.now() - startTime;
      console.log(`✨ Check completed in ${duration}ms\n`);
    } catch (error) {
      console.error('❌ Worker error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start(): void {
    console.log('🌊 Starting TellTide Meta-Event Worker...');
    console.log(`⏱️  Check interval: ${config.worker.intervalSeconds} seconds\n`);

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
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  const worker = new MetaEventWorker();
  worker.start();

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down worker...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Worker startup error:', error);
  process.exit(1);
});
