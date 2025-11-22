import { query } from '../client.js';
import type { Event, EventType, AggregationType } from '../../types/index.js';

export const eventsRepository = {
  async insertEvent(event: Omit<Event, 'id' | 'created_at'>): Promise<Event> {
    const result = await query<Event>(
      `INSERT INTO events (
        chain,
        block_number,
        timestamp,
        event_type,
        contract_address,
        from_address,
        to_address,
        data,
        transaction_hash,
        log_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (chain, transaction_hash, log_index) DO NOTHING
      RETURNING *`,
      [
        event.chain ?? 'ethereum',
        event.block_number,
        event.timestamp,
        event.event_type,
        event.contract_address,
        event.from_address,
        event.to_address,
        JSON.stringify(event.data),
        event.transaction_hash,
        event.log_index,
      ]
    );

    return result.rows[0];
  },

  async insertEventsBatch(events: Array<Omit<Event, 'id' | 'created_at'>>): Promise<void> {
    if (events.length === 0) return;

    // PostgreSQL has a limit of ~65535 parameters
    // With 10 params per event (added chain), use 500 batch size to be safe
    const BATCH_SIZE = 500;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);

      const values = batch
        .map(
          (_, idx) =>
            `($${idx * 10 + 1}, $${idx * 10 + 2}, $${idx * 10 + 3}, $${idx * 10 + 4}, $${idx * 10 + 5}, $${idx * 10 + 6}, $${idx * 10 + 7}, $${idx * 10 + 8}, $${idx * 10 + 9}, $${idx * 10 + 10})`
        )
        .join(', ');

      const params = batch.flatMap((e) => [
        e.chain ?? 'ethereum',
        e.block_number,
        e.timestamp,
        e.event_type,
        e.contract_address,
        e.from_address,
        e.to_address,
        JSON.stringify(e.data),
        e.transaction_hash,
        e.log_index,
      ]);

      await query(
        `INSERT INTO events (
          chain,
          block_number,
          timestamp,
          event_type,
          contract_address,
          from_address,
          to_address,
          data,
          transaction_hash,
          log_index
        ) VALUES ${values}
        ON CONFLICT (chain, transaction_hash, log_index) DO NOTHING`,
        params
      );
    }
  },

  async getEventsByTimeWindow(
    eventType: EventType,
    windowMinutes: number,
    contracts?: string[],
    contractAddress?: string,
    fromAddress?: string,
    toAddress?: string,
    chain?: string
  ): Promise<Event[]> {
    let whereClause = 'event_type = $1 AND timestamp >= NOW() - INTERVAL \'1 minute\' * $2';
    const params: unknown[] = [eventType, windowMinutes];

    if (chain) {
      whereClause += ` AND chain = $${params.length + 1}`;
      params.push(chain);
    }

    if (contracts && contracts.length > 0) {
      whereClause += ` AND contract_address = ANY($${params.length + 1})`;
      params.push(contracts.map((c) => c.toLowerCase()));
    } else if (contractAddress) {
      whereClause += ` AND contract_address = $${params.length + 1}`;
      params.push(contractAddress.toLowerCase());
    }

    if (fromAddress) {
      whereClause += ` AND from_address = $${params.length + 1}`;
      params.push(fromAddress.toLowerCase());
    }

    if (toAddress) {
      whereClause += ` AND to_address = $${params.length + 1}`;
      params.push(toAddress.toLowerCase());
    }

    const result = await query<Event>(
      `SELECT * FROM events WHERE ${whereClause} ORDER BY timestamp DESC`,
      params
    );

    return result.rows;
  },

  async getEventCount(
    eventType: EventType,
    windowMinutes: number,
    contracts?: string[],
    contractAddress?: string,
    fromAddress?: string,
    toAddress?: string,
    lookbackBlocks?: number,
    chain?: string
  ): Promise<number> {
    let whereClause: string;
    const params: unknown[] = [eventType];

    // Use block-based lookback if specified, otherwise use time-based
    if (lookbackBlocks !== undefined) {
      // Get current max block number for this chain
      let maxBlockQuery = 'SELECT MAX(block_number) as max_block FROM events WHERE event_type = $1';
      const maxBlockParams: unknown[] = [eventType];

      if (chain) {
        maxBlockQuery += ' AND chain = $2';
        maxBlockParams.push(chain);
      }

      const maxBlockResult = await query<{ max_block: number | null }>(maxBlockQuery, maxBlockParams);
      const maxBlock = maxBlockResult.rows[0].max_block ?? 0;
      const minBlock = Math.max(0, maxBlock - lookbackBlocks);

      whereClause = 'event_type = $1 AND block_number >= $2';
      params.push(minBlock);
    } else {
      whereClause = 'event_type = $1 AND timestamp >= NOW() - INTERVAL \'1 minute\' * $2';
      params.push(windowMinutes);
    }

    if (chain) {
      whereClause += ` AND chain = $${params.length + 1}`;
      params.push(chain);
    }

    if (contracts && contracts.length > 0) {
      whereClause += ` AND contract_address = ANY($${params.length + 1})`;
      params.push(contracts.map((c) => c.toLowerCase()));
    } else if (contractAddress) {
      whereClause += ` AND contract_address = $${params.length + 1}`;
      params.push(contractAddress.toLowerCase());
    }

    if (fromAddress) {
      whereClause += ` AND from_address = $${params.length + 1}`;
      params.push(fromAddress.toLowerCase());
    }

    if (toAddress) {
      whereClause += ` AND to_address = $${params.length + 1}`;
      params.push(toAddress.toLowerCase());
    }

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM events WHERE ${whereClause}`,
      params
    );

    return parseInt(result.rows[0].count, 10);
  },

  async getAggregatedValue(
    eventType: EventType,
    field: string,
    aggregation: Exclude<AggregationType, 'count'>,
    windowMinutes: number,
    contracts?: string[],
    contractAddress?: string,
    fromAddress?: string,
    toAddress?: string,
    lookbackBlocks?: number,
    chain?: string
  ): Promise<number> {
    let whereClause: string;
    const params: unknown[] = [eventType];

    // Use block-based lookback if specified, otherwise use time-based
    if (lookbackBlocks !== undefined) {
      // Get current max block number for this chain
      let maxBlockQuery = 'SELECT MAX(block_number) as max_block FROM events WHERE event_type = $1';
      const maxBlockParams: unknown[] = [eventType];

      if (chain) {
        maxBlockQuery += ' AND chain = $2';
        maxBlockParams.push(chain);
      }

      const maxBlockResult = await query<{ max_block: number | null }>(maxBlockQuery, maxBlockParams);
      const maxBlock = maxBlockResult.rows[0].max_block ?? 0;
      const minBlock = Math.max(0, maxBlock - lookbackBlocks);

      whereClause = 'event_type = $1 AND block_number >= $2';
      params.push(minBlock);
    } else {
      whereClause = 'event_type = $1 AND timestamp >= NOW() - INTERVAL \'1 minute\' * $2';
      params.push(windowMinutes);
    }

    if (chain) {
      whereClause += ` AND chain = $${params.length + 1}`;
      params.push(chain);
    }

    if (contracts && contracts.length > 0) {
      whereClause += ` AND contract_address = ANY($${params.length + 1})`;
      params.push(contracts.map((c) => c.toLowerCase()));
    } else if (contractAddress) {
      whereClause += ` AND contract_address = $${params.length + 1}`;
      params.push(contractAddress.toLowerCase());
    }

    if (fromAddress) {
      whereClause += ` AND from_address = $${params.length + 1}`;
      params.push(fromAddress.toLowerCase());
    }

    if (toAddress) {
      whereClause += ` AND to_address = $${params.length + 1}`;
      params.push(toAddress.toLowerCase());
    }

    const aggFunc = aggregation.toUpperCase();
    const result = await query<{ value: string | null }>(
      `SELECT ${aggFunc}((data->>'${field}')::numeric) as value
       FROM events
       WHERE ${whereClause}`,
      params
    );

    return result.rows[0].value ? parseFloat(result.rows[0].value) : 0;
  },

  async deleteEventsAfterBlock(blockNumber: number): Promise<void> {
    await query('DELETE FROM events WHERE block_number > $1', [blockNumber]);
  },
};
