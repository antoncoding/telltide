import { query } from '../client.js';

export const cursorRepository = {
  async getCursor(id = 'main'): Promise<number> {
    const result = await query<{ block_number: string }>(
      'SELECT block_number FROM indexer_cursor WHERE id = $1',
      [id]
    );

    return result.rows[0] ? parseInt(result.rows[0].block_number, 10) : 0;
  },

  async updateCursor(blockNumber: number, id = 'main'): Promise<void> {
    await query(
      `INSERT INTO indexer_cursor (id, block_number, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (id)
       DO UPDATE SET block_number = $2, updated_at = NOW()`,
      [id, blockNumber]
    );
  },
};
