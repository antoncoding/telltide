import { createTarget } from '@subsquid/pipes';
import { evmPortalSource, EvmQueryBuilder, commonAbis } from '@subsquid/pipes/evm';
import { portalSqliteCache } from '@subsquid/pipes/portal-cache/node';
import { config } from '../config/index.js';
import { eventsRepository } from '../db/repositories/events.js';
import { testConnection } from '../db/client.js';
import { events as erc4626Abi } from '../abi/erc4626.js';
import type { EventType } from '../types/index.js';

async function main() {
  console.log('🌊 Starting TellTide Event Indexer...');

  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  console.log(`💡 Fetching current blockchain head...`);

  // Fetch current head block from Portal to calculate dynamic start
  const tempSource = evmPortalSource({
    portal: config.sqd.portalUrl,
    query: new EvmQueryBuilder().addFields({ block: { number: true } }),
  });

  let headBlock = 0;
  for await (const { data } of tempSource.read()) {
    if (data.blocks.length > 0) {
      headBlock = Math.max(...data.blocks.map((b) => b.header.number));
      break; // Just get the latest block
    }
  }

  if (headBlock === 0) {
    console.error('❌ Failed to fetch current head block');
    process.exit(1);
  }

  // Calculate dynamic start block
  const startBlock = Math.max(1, headBlock - config.indexer.maxLookbackBlocks);

  console.log(`📡 Current head block: ${headBlock.toLocaleString()}`);
  console.log(`📍 Starting from block: ${startBlock.toLocaleString()} (${config.indexer.maxLookbackBlocks.toLocaleString()} blocks back)`);
  console.log(`🔍 Indexing: ERC20 Transfers + ERC4626 Deposits/Withdrawals\n`);

  const queryBuilder = new EvmQueryBuilder()
    .addFields({
      block: { number: true, hash: true, timestamp: true },
      log: {
        address: true,
        topics: true,
        data: true,
        transactionHash: true,
        logIndex: true,
      },
    })
    // ERC20 Transfer events
    .addLog({
      request: {
        topic0: [commonAbis.erc20.events.Transfer.topic],
      },
      range: { from: startBlock },
    })
    // ERC4626 Deposit events
    .addLog({
      request: {
        topic0: [erc4626Abi.Deposit.topic],
      },
      range: { from: startBlock },
    })
    // ERC4626 Withdraw events
    .addLog({
      request: {
        topic0: [erc4626Abi.Withdraw.topic],
      },
      range: { from: startBlock },
    });

  const sourceConfig: {
    portal: string;
    query: EvmQueryBuilder;
    cache?: ReturnType<typeof portalSqliteCache>;
  } = {
    portal: config.sqd.portalUrl,
    query: queryBuilder,
  };

  if (config.indexer.useCache) {
    sourceConfig.cache = portalSqliteCache({ path: './portal-cache.sqlite' });
  }

  const source = evmPortalSource(sourceConfig);

  const target = createTarget({
    write: async ({ logger, read }) => {
      for await (const { data } of read()) {
        const eventsToInsert: Array<{
          block_number: number;
          timestamp: Date;
          event_type: EventType;
          contract_address: string;
          from_address: string | null;
          to_address: string | null;
          data: Record<string, unknown>;
          transaction_hash: string;
          log_index: number;
        }> = [];

        for (const block of data.blocks) {
          const blockTimestamp = new Date(block.header.timestamp * 1000);

          for (const log of block.logs) {
            let eventType: EventType | null = null;
            let decodedData: Record<string, unknown> = {};
            let fromAddress: string | null = null;
            let toAddress: string | null = null;

            const topic0 = log.topics[0];

            try {
              if (topic0 === commonAbis.erc20.events.Transfer.topic) {
                // ERC20 Transfer has 3 topics: signature + from + to
                if (log.topics.length !== 3) continue;

                eventType = 'erc20_transfer';
                const decoded = commonAbis.erc20.events.Transfer.decode(log);
                fromAddress = decoded.from;
                toAddress = decoded.to;
                decodedData = {
                  from: decoded.from,
                  to: decoded.to,
                  value: decoded.value.toString(),
                };
              } else if (topic0 === erc4626Abi.Deposit.topic) {
                // ERC4626 Deposit has 3 topics: signature + sender + owner
                if (log.topics.length !== 3) continue;

                eventType = 'erc4626_deposit';
                const decoded = erc4626Abi.Deposit.decode(log);
                fromAddress = decoded.sender;
                toAddress = decoded.owner;
                decodedData = {
                  sender: decoded.sender,
                  owner: decoded.owner,
                  assets: decoded.assets.toString(),
                  shares: decoded.shares.toString(),
                };
              } else if (topic0 === erc4626Abi.Withdraw.topic) {
                // ERC4626 Withdraw has 4 topics: signature + sender + receiver + owner
                if (log.topics.length !== 4) continue;

                eventType = 'erc4626_withdraw';
                const decoded = erc4626Abi.Withdraw.decode(log);
                fromAddress = decoded.sender;
                toAddress = decoded.receiver;
                decodedData = {
                  sender: decoded.sender,
                  receiver: decoded.receiver,
                  owner: decoded.owner,
                  assets: decoded.assets.toString(),
                  shares: decoded.shares.toString(),
                };
              }
            } catch (error) {
              // Skip events that fail to decode (non-standard implementations)
              continue;
            }

            if (eventType) {
              eventsToInsert.push({
                block_number: block.header.number,
                timestamp: blockTimestamp,
                event_type: eventType,
                contract_address: log.address.toLowerCase(),
                from_address: fromAddress?.toLowerCase() ?? null,
                to_address: toAddress?.toLowerCase() ?? null,
                data: decodedData,
                transaction_hash: log.transactionHash,
                log_index: log.logIndex,
              });
            }
          }
        }

        if (eventsToInsert.length > 0) {
          await eventsRepository.insertEventsBatch(eventsToInsert);
          logger.info(`✅ Inserted ${eventsToInsert.length} events`);
        }

        const lastBlock = Math.max(...data.blocks.map((b) => b.header.number));
        logger.info(`📦 Processed block ${lastBlock} | Events: ${eventsToInsert.length}`);
      }
    },
  });

  await source.pipeTo(target);
}

main().catch((error) => {
  console.error('❌ Indexer error:', error);
  process.exit(1);
});
