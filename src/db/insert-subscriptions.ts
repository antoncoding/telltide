import { pool } from './client.js';
import { subscriptionsRepository } from './repositories/subscriptions.js';
import type { MetaEventConfig } from '../types/index.js';

type SubscriptionTemplate = {
  name: string;
  description: string;
  config: MetaEventConfig;
};

const WEBHOOK_URL = 'https://webhook.site/unique-url-here'; // Replace with your webhook.site URL

const subscriptionTemplates: SubscriptionTemplate[] = [
  // 1. Monitor high withdrawal volume from a specific ERC4626 vault
  // {
  //   name: 'High Vault Withdrawal - Single Vault',
  //   description: 'Alert when withdrawals exceed 1M USDC in 2 hours from a specific vault',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc4626_withdraw',
  //     contract_address: '0x1234567890123456789012345678901234567890', // Replace with real vault address
  //     window: '1m',
  //     aggregation: 'sum',
  //     field: 'assets',
  //     condition: {
  //       operator: '>',
  //       value: 1000000000000, // 1M USDC (6 decimals)
  //     },
  //   },
  // },

  // 2. Monitor withdrawals from ANY of multiple vaults
  // {
  //   name: 'High Vault Withdrawal - Multi Vault',
  //   description: 'Alert when ANY of 3 vaults exceeds 500K USDC withdrawn in 1 hour',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc4626_withdraw',
  //     contracts: [
  //       '0x1111111111111111111111111111111111111111', // Replace with real vault addresses
  //       '0x2222222222222222222222222222222222222222',
  //       '0x3333333333333333333333333333333333333333',
  //     ],
  //     window: '1h',
  //     aggregation: 'sum',
  //     field: 'assets',
  //     condition: {
  //       operator: '>',
  //       value: 500000000000, // 500K USDC
  //     },
  //   },
  // },

  // // 3. Monitor ERC20 transfer spike (count-based)
  {
    name: 'USDC Transfer Spike',
    description: 'Alert when USDC has more than 5 transfers in recent 100 blocks',
    config: {
      type: 'event_count',
      event_type: 'erc20_transfer',
      contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on mainnet
      window: '1m',
      lookback_blocks: 100, // Only look back 100 blocks for efficiency
      condition: {
        operator: '>',
        value: 50,
      },
    },
  },

  // Base Chain - Vault Withdrawal Volume Monitor
  {
    name: 'Base Vault Withdrawal Volume',
    description: 'Alert when vault on Base has significant withdrawal volume',
    config: {
      chain: 'base',
      type: 'rolling_aggregate',
      event_type: 'erc4626_withdraw',
      contract_address: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183', // Vault on Base
      window: '1h',
      lookback_blocks: 300, // ~10 minutes on Base (2s blocks)
      aggregation: 'sum',
      field: 'assets',
      condition: {
        operator: '>',
        value: 1000000000, // 1000 tokens (assuming 6 decimals)
      },
    },
  },

  // // 4. Monitor deposits to a specific vault
  // {
  //   name: 'Large Deposit Activity',
  //   description: 'Alert when total deposits exceed 2M USDC in 1 hour',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc4626_deposit',
  //     contract_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Replace with real vault
  //     window: '1h',
  //     aggregation: 'sum',
  //     field: 'assets',
  //     condition: {
  //       operator: '>',
  //       value: 2000000000000, // 2M USDC
  //     },
  //   },
  // },

  // Base Chain - Vault Deposit Activity Monitor
  {
    name: 'Base Vault Deposit Activity',
    description: 'Alert when vault on Base has deposit activity',
    config: {
      chain: 'base',
      type: 'event_count',
      event_type: 'erc4626_deposit',
      contract_address: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183', // Vault on Base
      window: '1h',
      lookback_blocks: 300, // ~10 minutes on Base (2s blocks)
      condition: {
        operator: '>',
        value: 5, // More than 5 deposits
      },
    },
  },

  // // 5. Monitor average withdrawal size
  // {
  //   name: 'Large Average Withdrawal',
  //   description: 'Alert when average withdrawal size exceeds 100K USDC in 30 minutes',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc4626_withdraw',
  //     contract_address: '0x4444444444444444444444444444444444444444', // Replace with real vault
  //     window: '30m',
  //     aggregation: 'avg',
  //     field: 'assets',
  //     condition: {
  //       operator: '>',
  //       value: 100000000000, // 100K USDC
  //     },
  //   },
  // },

  // // 6. Monitor withdrawal event count
  // {
  //   name: 'Withdrawal Event Spike',
  //   description: 'Alert when more than 20 withdrawal events occur in 1 hour',
  //   config: {
  //     type: 'event_count',
  //     event_type: 'erc4626_withdraw',
  //     contract_address: '0x5555555555555555555555555555555555555555', // Replace with real vault
  //     window: '1h',
  //     condition: {
  //       operator: '>',
  //       value: 20,
  //     },
  //   },
  // },

  // // 7. Monitor transfers FROM specific address (whale tracking)
  // {
  //   name: 'Whale Outflow',
  //   description: 'Alert when a whale address transfers out more than 5M USDC in 24 hours',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc20_transfer',
  //     contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  //     from_address: '0x6666666666666666666666666666666666666666', // Replace with whale address
  //     window: '24h',
  //     aggregation: 'sum',
  //     field: 'value',
  //     condition: {
  //       operator: '>',
  //       value: 5000000000000, // 5M USDC
  //     },
  //   },
  // },

  // // 8. Monitor transfers TO specific address (accumulation tracking)
  // {
  //   name: 'Whale Accumulation',
  //   description: 'Alert when a whale address receives more than 3M USDC in 12 hours',
  //   config: {
  //     type: 'rolling_aggregate',
  //     event_type: 'erc20_transfer',
  //     contract_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  //     to_address: '0x7777777777777777777777777777777777777777', // Replace with whale address
  //     window: '12h',
  //     aggregation: 'sum',
  //     field: 'value',
  //     condition: {
  //       operator: '>',
  //       value: 3000000000000, // 3M USDC
  //     },
  //   },
  // },
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
  console.log('🌊 TellTide Subscription Insertion Tool\n');
  console.log('This script inserts example meta-event subscriptions into the database.');
  console.log('Update WEBHOOK_URL and contract addresses before running!\n');

  const userId = 'demo-user';

  console.log('📝 Creating subscriptions...\n');

  let successCount = 0;
  for (const template of subscriptionTemplates) {
    const result = await insertSubscription(template, userId);
    if (result) successCount++;
  }

  console.log('─'.repeat(60));
  console.log(`\n✨ Successfully created ${successCount}/${subscriptionTemplates.length} subscriptions\n`);
  console.log('🔧 Next steps:');
  console.log('   1. Update WEBHOOK_URL in this script with your webhook.site URL');
  console.log('   2. Update contract addresses to real vault/token addresses');
  console.log('   3. Run the indexer: pnpm indexer');
  console.log('   4. Run the worker: pnpm worker');
  console.log('   5. Check your webhook.site for notifications!\n');

  await pool.end();
  console.log('👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
