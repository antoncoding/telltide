# Demo Guide - Vault Withdrawal Monitoring

## 🎯 What Was Built

A complete meta-event detection system that supports:

1. **ERC20 + ERC4626 Event Indexing** (removed all Morpho code)
2. **Vault State Tracking** (RPC polling for totalAssets/totalSupply)
3. **Percentage-based Conditions** (e.g., ">20% of vault assets withdrawn")
4. **Compound Conditions** (check multiple vaults with AND/OR logic)
5. **Webhook Notifications** with automatic retry

## 🚀 Quick Start

### 1. Setup

```bash
# Start PostgreSQL
docker compose up -d

# Migrate database (includes new vault tables)
pnpm db:migrate

# Add vault addresses to track
# Edit .env and add:
VAULT_ADDRESSES=0xVaultA,0xVaultB,0xVaultC
RPC_URL=https://eth.llamarpc.com
```

### 2. Start All Services

```bash
# Start everything
pnpm dev

# Or individually:
pnpm indexer  # Indexes ERC20 + ERC4626 events
pnpm worker   # Detects meta-events + tracks vault state
pnpm api      # REST API on :3000
```

## 📋 Demo Case: "Any of 3 Vaults >20% Withdrawal"

### Step 1: Register Vaults (Automatic)

The worker automatically registers vaults from `.env` on startup:

```env
VAULT_ADDRESSES=0xVaultA,0xVaultB,0xVaultC
```

You'll see:
```
📝 Registered vault: 0xVaultA
📝 Registered vault: 0xVaultB
📝 Registered vault: 0xVaultC
🔍 Tracking 3 vault(s)...
✅ Tracked vault 0xVaultA... | Assets: 1000000 | Supply: 500000
```

### Step 2: Create Subscription

**Option A: Check ANY of 3 vaults** (OR logic - simpler)

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo",
    "name": "3 Vaults - 20% Withdrawal Alert",
    "webhook_url": "https://webhook.site/YOUR-ID",
    "meta_event_config": {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contracts": [
        "0xVaultA",
        "0xVaultB",
        "0xVaultC"
      ],
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": {
        "operator": ">",
        "value": 0.20,
        "value_type": "percentage"
      }
    }
  }'
```

**How it works:**
- Checks each vault independently
- If ANY vault has >20% withdrawal in 1h → triggers
- Webhook includes `triggered_by_contract` showing which vault

**Option B: Compound condition** (explicit OR logic)

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo",
    "name": "Compound: 3 Vaults OR",
    "webhook_url": "https://webhook.site/YOUR-ID",
    "meta_event_config": {
      "type": "compound",
      "operator": "OR",
      "conditions": [
        {
          "type": "rolling_aggregate",
          "event_type": "erc4626_withdraw",
          "contract_address": "0xVaultA",
          "window": "1h",
          "aggregation": "sum",
          "field": "assets",
          "condition": {
            "operator": ">",
            "value": 0.20,
            "value_type": "percentage"
          }
        },
        {
          "type": "rolling_aggregate",
          "event_type": "erc4626_withdraw",
          "contract_address": "0xVaultB",
          "window": "1h",
          "aggregation": "sum",
          "field": "assets",
          "condition": {
            "operator": ">",
            "value": 0.20,
            "value_type": "percentage"
          }
        },
        {
          "type": "rolling_aggregate",
          "event_type": "erc4626_withdraw",
          "contract_address": "0xVaultC",
          "window": "1h",
          "aggregation": "sum",
          "field": "assets",
          "condition": {
            "operator": ">",
            "value": 0.20,
            "value_type": "percentage"
          }
        }
      ]
    }
  }'
```

### Step 3: Wait for Detection

Worker checks every 30s. When triggered:

```
🔍 Checking active subscriptions...
📋 Found 1 active subscription(s)
🎯 Meta-event triggered for "3 Vaults - 20% Withdrawal Alert"!
   Triggered by contract: 0xVaultA
📤 Dispatching 1 webhook(s)...
✅ Successful: 1 | ❌ Failed: 0
```

### Step 4: Webhook Payload

You receive:

```json
{
  "subscription_id": "uuid",
  "subscription_name": "3 Vaults - 20% Withdrawal Alert",
  "triggered_at": "2025-11-22T12:00:00.000Z",
  "meta_event": {
    "type": "rolling_aggregate",
    "condition_met": true,
    "aggregated_value": 0.25,
    "threshold": 0.20,
    "window": "1h",
    "triggered_by_contract": "0xVaultA"
  },
  "events": [
    {
      "block_number": 20500000,
      "timestamp": "2025-11-22T11:30:00.000Z",
      "event_type": "erc4626_withdraw",
      "contract_address": "0xvaulta",
      "data": {
        "sender": "0x...",
        "receiver": "0x...",
        "owner": "0x...",
        "assets": "250000000000000000000",
        "shares": "250000000000000000000"
      }
    }
  ]
}
```

## 📊 More Examples

### Example 1: ERC20 Whale Transfer Alert (Absolute Value)

Detect when >500k USDC leaves a specific address:

```json
{
  "type": "rolling_aggregate",
  "event_type": "erc20_transfer",
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "from_address": "0xWhaleAddress",
  "window": "1h",
  "aggregation": "sum",
  "field": "value",
  "condition": {
    "operator": ">",
    "value": 500000000000,
    "value_type": "absolute"
  }
}
```

### Example 2: Vault Deposit Surge (Percentage)

Alert when deposits exceed 10% of vault in 15min:

```json
{
  "type": "rolling_aggregate",
  "event_type": "erc4626_deposit",
  "contract_address": "0xVaultAddress",
  "window": "15m",
  "aggregation": "sum",
  "field": "assets",
  "condition": {
    "operator": ">",
    "value": 0.10,
    "value_type": "percentage"
  }
}
```

### Example 3: AND Condition (Both Must Trigger)

Alert only if BOTH vaults have >15% withdrawal:

```json
{
  "type": "compound",
  "operator": "AND",
  "conditions": [
    {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contract_address": "0xVaultA",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": { "operator": ">", "value": 0.15, "value_type": "percentage" }
    },
    {
      "type": "rolling_aggregate",
      "event_type": "erc4626_withdraw",
      "contract_address": "0xVaultB",
      "window": "1h",
      "aggregation": "sum",
      "field": "assets",
      "condition": { "operator": ">", "value": 0.15, "value_type": "percentage" }
    }
  ]
}
```

## 🔍 How Percentage Calculation Works

1. **Indexer** streams ERC4626 Withdraw events from Portal
2. **Vault Tracker** polls RPC every 60s:
   ```
   totalAssets() → 1,000,000 USDC
   totalSupply() → 500,000 shares
   ```
3. **Detector** calculates on each check:
   ```typescript
   withdrawnAmount = SUM(withdraw.assets) in last 1h  // e.g., 250,000
   percentage = withdrawnAmount / totalAssets         // 250,000 / 1,000,000 = 0.25
   triggered = percentage > 0.20                      // 0.25 > 0.20 ✓
   ```

## ⚙️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Ethereum Mainnet                       │
│     (ERC20 Transfers + ERC4626 Vaults)             │
└───────────────┬─────────────────────────────────────┘
                │
      ┌─────────┴──────────┐
      │                    │
      ▼                    ▼
┌──────────┐         ┌──────────┐
│  Portal  │         │   RPC    │
│  (Events)│         │ (State)  │
└─────┬────┘         └────┬─────┘
      │                   │
      ▼                   ▼
┌──────────┐         ┌──────────────┐
│ Indexer  │         │Vault Tracker │
└─────┬────┘         └────┬─────────┘
      │                   │
      │    PostgreSQL     │
      ├───────────────────┤
      │  events           │
      │  vault_state      │
      │  subscriptions    │
      └──────┬────────────┘
             │
             ▼
      ┌─────────────┐
      │   Worker    │
      │  (Detector) │
      └──────┬──────┘
             │
             ▼
        Webhook POST
```

## 🧪 Testing Locally

### 1. Use webhook.site

```bash
# Get a test webhook URL
open https://webhook.site

# Copy the unique URL and use in subscription
webhook_url: "https://webhook.site/abc123"
```

### 2. Check vault state

```sql
-- View vault state snapshots
SELECT * FROM vault_state ORDER BY timestamp DESC LIMIT 10;

-- View events
SELECT event_type, COUNT(*) FROM events GROUP BY event_type;
```

### 3. Manual trigger test

```sql
-- Insert test withdrawal (simulate 30% withdrawal)
INSERT INTO events (
  block_number, timestamp, event_type, contract_address,
  from_address, to_address, data, transaction_hash, log_index
) VALUES (
  20000000,
  NOW(),
  'erc4626_withdraw',
  '0xvaulta',
  '0xsender',
  '0xreceiver',
  '{"assets": "300000000000000000000", "shares": "300000"}'::jsonb,
  '0xtest123',
  1
);

-- Worker will detect on next check (30s)
```

## 📝 Key Features Implemented

✅ **ERC20 + ERC4626 Support** - Removed all Morpho code
✅ **Vault State Tracking** - RPC polling for totalAssets/totalSupply
✅ **Percentage Conditions** - Compare against vault state
✅ **Absolute Conditions** - Direct value comparisons
✅ **Multiple Contracts** - Check array of addresses (OR logic)
✅ **Compound Conditions** - Explicit AND/OR operators
✅ **from_address/to_address** - Filter ERC20 by sender/receiver
✅ **Webhook Retries** - 3 attempts with backoff
✅ **Fork Handling** - Automatic rollback on chain reorgs

## 🐛 Troubleshooting

**Vault state not updating?**
- Check RPC_URL is accessible
- Verify vault addresses in .env
- Check worker logs for RPC errors

**Percentage always 0?**
- Ensure vault is registered (check vault_registry table)
- Check vault_state table has recent entries
- Verify RPC is returning valid data

**Webhook not firing?**
- Check subscription is active
- Verify condition threshold is realistic
- Check worker logs for detection attempts
- Test webhook URL is accessible

## 🚀 Next Steps

1. **Add real vault addresses** to `.env`
2. **Lower start block** if needed for recent data
3. **Test with mainnet vaults** that have actual activity
4. **Deploy to production** with proper RPC (Alchemy/Infura)

---

**Note**: The project uses "ChaosChain" as a placeholder name in database/config - feel free to rename!
