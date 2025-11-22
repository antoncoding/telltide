import * as dotenv from 'dotenv';

dotenv.config();

export type ChainConfig = {
  name: string;
  rpcUrl: string;
  sqdPortalUrl: string;
  morphoAddress: string; // Morpho Blue contract address
};

export type Config = {
  database: {
    url: string;
  };
  api: {
    port: number;
    host: string;
  };
  worker: {
    intervalSeconds: number;
  };
  chains: {
    ethereum: ChainConfig;
    base: ChainConfig;
  };
  indexer: {
    maxLookbackBlocks: number; // Maximum blocks to look back from chain head
    useCache: boolean;
    enabledChains: string[]; // Which chains to index
  };
  logging: {
    level: string;
  };
};

export const config: Config = {
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/telltide',
  },
  api: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    host: process.env.API_HOST ?? 'localhost',
  },
  worker: {
    intervalSeconds: parseInt(process.env.WORKER_INTERVAL_SECONDS ?? '30', 10),
  },
  chains: {
    ethereum: {
      name: 'ethereum',
      rpcUrl: process.env.ETHEREUM_RPC_URL ?? 'https://eth.llamarpc.com',
      sqdPortalUrl: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
      morphoAddress: '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb', // Morpho Blue (lowercase for SQD!)
    },
    base: {
      name: 'base',
      rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
      sqdPortalUrl: 'https://portal.sqd.dev/datasets/base-mainnet',
      morphoAddress: '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb', // Morpho Blue (lowercase for SQD!)
    },
  },
  indexer: {
    maxLookbackBlocks: parseInt(process.env.INDEXER_MAX_LOOKBACK_BLOCKS ?? '10000', 10),
    useCache: process.env.INDEXER_USE_CACHE === 'true',
    enabledChains: (process.env.INDEXER_ENABLED_CHAINS ?? 'ethereum,base').split(','),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};
