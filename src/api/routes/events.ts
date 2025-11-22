import { Router } from 'express';
import { query } from '../../db/client.js';
import { queryEventsSchema } from '../validators.js';
import type { Event } from '../../types/index.js';

const router = Router();

// Query events
router.get('/', async (req, res) => {
  try {
    const validatedQuery = queryEventsSchema.parse(req.query);

    let whereClause = 'TRUE';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (validatedQuery.event_type) {
      whereClause += ` AND event_type = $${paramIndex++}`;
      params.push(validatedQuery.event_type);
    }

    if (validatedQuery.market_id) {
      whereClause += ` AND market_id = $${paramIndex++}`;
      params.push(validatedQuery.market_id);
    }

    if (validatedQuery.contract_address) {
      whereClause += ` AND contract_address = $${paramIndex++}`;
      params.push(validatedQuery.contract_address);
    }

    if (validatedQuery.from_block) {
      whereClause += ` AND block_number >= $${paramIndex++}`;
      params.push(validatedQuery.from_block);
    }

    if (validatedQuery.to_block) {
      whereClause += ` AND block_number <= $${paramIndex++}`;
      params.push(validatedQuery.to_block);
    }

    params.push(validatedQuery.limit);

    const result = await query<Event>(
      `SELECT * FROM events
       WHERE ${whereClause}
       ORDER BY block_number DESC, log_index DESC
       LIMIT $${paramIndex}`,
      params
    );

    res.json({
      count: result.rows.length,
      events: result.rows,
    });
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      res.status(400).json({ error: 'Validation error', details: error });
    } else {
      console.error('Error querying events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get event statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        event_type,
        COUNT(*) as count,
        MIN(block_number) as min_block,
        MAX(block_number) as max_block,
        MIN(timestamp) as earliest_event,
        MAX(timestamp) as latest_event
      FROM events
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const result = await query(statsQuery);

    res.json({
      statistics: result.rows,
    });
  } catch (error) {
    console.error('Error getting event statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
