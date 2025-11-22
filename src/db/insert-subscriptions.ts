import { pool } from './client.js';
import { subscriptionsRepository } from './repositories/subscriptions.js';
import type { MetaEventConfig } from '../types/index.js';

type SubscriptionTemplate = {
  name: string;
  description: string;
  config: MetaEventConfig;
};

const WEBHOOK_URL = 'http://localhost:3000/api/demo-callback';

const subscriptionTemplates: SubscriptionTemplate[] = [
  // 1. Morpho Net Withdrawal Alert (Base - USDC/cbBTC Market)
  {
    name: 'Morpho Net Withdrawal Alert',
    description: 'Detects when more is withdrawn than supplied from USDC/cbBTC market',
    config: {
      chain: 'base',
      type: 'net_aggregate',
      event_type: 'morpho_supply',
      positive_event_type: 'morpho_supply',
      negative_event_type: 'morpho_withdraw',
      market_id: '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836', // USDC/cbBTC on Base
      window: '1h',
      aggregation: 'sum',
      field: 'assets',
      condition: {
        operator: '<',
        value: -1000000, // -1 USDC (6 decimals) - low threshold for testing
      },
    },
  },

  // 2. USDC Transfer Spike (Ethereum)
  // {
  //   name: 'USDC Transfer Spike',
  //   description: 'Alert when USDC has high transfer activity',
  //   config: {
  //     chain: 'ethereum',
  //     type: 'event_count',
  //     event_type: 'erc20_transfer',
  //     contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
  //     window: '5m',
  //     condition: {
  //       operator: '>',
  //       value: 10, // More than 10 transfers in 5 minutes
  //     },
  //   },
  // },

  // 3. Morpho Supply Event Count (Base)
  {
    name: 'Morpho Supply Event Count',
    description: 'Count supply events to USDC/cbBTC market',
    config: {
      chain: 'base',
      type: 'event_count',
      event_type: 'morpho_supply',
      market_id: '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836',
      window: '15m',
      condition: {
        operator: '>',
        value: 2, // More than 2 supply events
      },
    },
  },
];

async function insertSubscription(template: SubscriptionTemplate, userId: string) {
  try {
    const subscription = await subscriptionsRepository.createSubscription(
      userId,
      template.name,
      WEBHOOK_URL,
      template.config
    );

    console.log(`✅ Created: ${template.name}`);
    console.log(`   ID: ${subscription.id}`);
    console.log(`   ${template.description}\n`);

    return subscription;
  } catch (error) {
    console.error(`❌ Failed to create: ${template.name}`, error);
    return null;
  }
}

async function main() {
  console.log('🌊 TellTide Subscription Setup\n');
  console.log('This script creates example subscriptions for testing.\n');
  console.log('⚠️  IMPORTANT: Update WEBHOOK_URL in this file first!');
  console.log('   Get your webhook URL from: https://webhook.site\n');

  if (WEBHOOK_URL.includes('YOUR-UNIQUE-URL')) {
    console.error('❌ ERROR: Please replace WEBHOOK_URL with your webhook.site URL!');
    console.error('   Edit src/db/insert-subscriptions.ts and update WEBHOOK_URL\n');
    process.exit(1);
  }

  const userId = 'demo-user';

  console.log('📝 Creating subscriptions...\n');

  let successCount = 0;
  for (const template of subscriptionTemplates) {
    const result = await insertSubscription(template, userId);
    if (result) successCount++;
  }

  console.log('─'.repeat(60));
  console.log(`\n✨ Successfully created ${successCount}/${subscriptionTemplates.length} subscriptions\n`);

  if (successCount > 0) {
    console.log('📋 Created subscriptions:');
    subscriptionTemplates.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} - ${t.description}`);
    });
    console.log('\n🔧 Next steps:');
    console.log('   1. Make sure indexer is running: pnpm indexer');
    console.log('   2. Make sure worker is running: pnpm worker');
    console.log('   3. Watch worker logs for subscription checks');
    console.log('   4. Check your webhook.site for notifications!\n');
  }

  await pool.end();
  console.log('👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
