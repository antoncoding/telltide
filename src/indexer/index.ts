import { createTarget } from '@subsquid/pipes';
import { evmPortalSource, EvmQueryBuilder, commonAbis } from '@subsquid/pipes/evm';
import { portalSqliteCache } from '@subsquid/pipes/portal-cache/node';
import axios from 'axios';
import { config } from '../config/index.js';
import { eventsRepository } from '../db/repositories/events.js';
import { testConnection } from '../db/client.js';
import { events as erc4626Abi } from '../abi/erc4626.js';
import { events as morphoAbi } from '../abi/morpho.js';
import type { EventType } from '../types/index.js';

const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });

async function main() {
  const connected = await testConnection();
  if (!connected) {
    console.error(`[${timestamp()}] ERROR: Failed to connect to database`);
    process.exit(1);
  }

  // Use ethereum chain for indexing (Base support coming soon)
  const chainName = 'ethereum';
  const chainConfig = config.chains.ethereum;

  // Fetch current head block via RPC
  let headBlock = 0;
  try {
    const response = await axios.post(chainConfig.rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    });

    if (response.data?.result) {
      headBlock = parseInt(response.data.result, 16);
    } else {
      throw new Error('Invalid RPC response');
    }
  } catch (error) {
    console.error(`[${timestamp()}] ERROR: Failed to fetch head block from RPC, using fallback`);
    headBlock = 21200000;
  }

  // Calculate dynamic start block
  const startBlock = Math.max(1, headBlock - config.indexer.maxLookbackBlocks);

  console.log(`[${timestamp()}] INFO: Indexer starting | chain=${chainName} blocks=${startBlock.toLocaleString()}-${headBlock.toLocaleString()} events=ERC20+ERC4626+Morpho`);
  console.log(`[${timestamp()}] INFO: Morpho contract: ${chainConfig.morphoAddress}`);

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
    })
    // Morpho Supply events (filtered by Morpho contract address)
    .addLog({
      request: {
        address: [chainConfig.morphoAddress],
        topic0: [morphoAbi.Supply.topic],
      },
      range: { from: startBlock },
    })
    // Morpho Withdraw events (filtered by Morpho contract address)
    .addLog({
      request: {
        address: [chainConfig.morphoAddress],
        topic0: [morphoAbi.Withdraw.topic],
      },
      range: { from: startBlock },
    })
    // Morpho Borrow events (filtered by Morpho contract address)
    .addLog({
      request: {
        address: [chainConfig.morphoAddress],
        topic0: [morphoAbi.Borrow.topic],
      },
      range: { from: startBlock },
    })
    // Morpho Repay events (filtered by Morpho contract address)
    .addLog({
      request: {
        address: [chainConfig.morphoAddress],
        topic0: [morphoAbi.Repay.topic],
      },
      range: { from: startBlock },
    });

  const sourceConfig: {
    portal: string;
    query: EvmQueryBuilder;
    cache?: ReturnType<typeof portalSqliteCache>;
  } = {
    portal: chainConfig.sqdPortalUrl,
    query: queryBuilder,
  };

  if (config.indexer.useCache) {
    sourceConfig.cache = portalSqliteCache({ path: './portal-cache.sqlite' });
  }

  const source = evmPortalSource(sourceConfig);

  const target = createTarget({
    logLevel: 'error', // Suppress verbose SQD logs
    write: async ({ logger, read }) => {
      for await (const { data } of read()) {
        const eventsToInsert: Array<{
          chain: string;
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
              } else if (topic0 === morphoAbi.Supply.topic) {
                // Morpho Supply has 4 topics: signature + id + caller + onBehalf
                if (log.topics.length !== 4) continue;

                eventType = 'morpho_supply';
                const decoded = morphoAbi.Supply.decode(log);
                fromAddress = decoded.caller;
                toAddress = decoded.onBehalf;
                decodedData = {
                  market_id: decoded.id,
                  caller: decoded.caller,
                  onBehalf: decoded.onBehalf,
                  assets: decoded.assets.toString(),
                  shares: decoded.shares.toString(),
                };
              } else if (topic0 === morphoAbi.Withdraw.topic) {
                // Morpho Withdraw has 4 topics: signature + id + onBehalf + receiver
                if (log.topics.length !== 4) continue;

                eventType = 'morpho_withdraw';
                const decoded = morphoAbi.Withdraw.decode(log);
                fromAddress = decoded.onBehalf;
                toAddress = decoded.receiver;
                decodedData = {
                  market_id: decoded.id,
                  caller: decoded.caller,
                  onBehalf: decoded.onBehalf,
                  receiver: decoded.receiver,
                  assets: decoded.assets.toString(),
                  shares: decoded.shares.toString(),
                };
              } else if (topic0 === morphoAbi.Borrow.topic) {
                // Morpho Borrow has 4 topics: signature + id + onBehalf + receiver
                if (log.topics.length !== 4) continue;

                eventType = 'morpho_borrow';
                const decoded = morphoAbi.Borrow.decode(log);
                fromAddress = decoded.onBehalf;
                toAddress = decoded.receiver;
                decodedData = {
                  market_id: decoded.id,
                  caller: decoded.caller,
                  onBehalf: decoded.onBehalf,
                  receiver: decoded.receiver,
                  assets: decoded.assets.toString(),
                  shares: decoded.shares.toString(),
                };
              } else if (topic0 === morphoAbi.Repay.topic) {
                // Morpho Repay has 4 topics: signature + id + caller + onBehalf
                if (log.topics.length !== 4) continue;

                eventType = 'morpho_repay';
                const decoded = morphoAbi.Repay.decode(log);
                fromAddress = decoded.caller;
                toAddress = decoded.onBehalf;
                decodedData = {
                  market_id: decoded.id,
                  caller: decoded.caller,
                  onBehalf: decoded.onBehalf,
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
                chain: chainName,
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
        }

        const lastBlock = Math.max(...data.blocks.map((b) => b.header.number));
        const blockRange = `${Math.min(...data.blocks.map((b) => b.header.number))}-${lastBlock}`;
        logger.info(`block=${blockRange} events=${eventsToInsert.length}`);
      }
    },
  });

  await source.pipeTo(target);
}

main().catch((error) => {
  console.error('❌ Indexer error:', error);
  process.exit(1);
});
