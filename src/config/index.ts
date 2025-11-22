import * as dotenv from 'dotenv';

dotenv.config();

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
  sqd: {
    portalUrl: string;
  };
  indexer: {
    maxLookbackBlocks: number; // Maximum blocks to look back from chain head
    useCache: boolean;
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
  sqd: {
    portalUrl: process.env.SQD_PORTAL_URL ?? 'https://portal.sqd.dev/datasets/ethereum-mainnet',
  },
  indexer: {
    maxLookbackBlocks: parseInt(process.env.INDEXER_MAX_LOOKBACK_BLOCKS ?? '60000', 10), // ~7 days
    useCache: process.env.INDEXER_USE_CACHE === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};
