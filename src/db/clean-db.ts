import { pool } from './client.js';

async function cleanDatabase() {
  console.log('🌊 TellTide Database Cleanup Tool\n');
  console.log('⚠️  WARNING: This will delete ALL data from the database!\n');

  try {
    // Delete all notification logs first (foreign key constraint)
    console.log('🗑️  Deleting notification logs...');
    const notificationsResult = await pool.query('DELETE FROM notifications_log');
    console.log(`   Deleted ${notificationsResult.rowCount ?? 0} notification logs`);

    // Delete all subscriptions
    console.log('🗑️  Deleting subscriptions...');
    const subscriptionsResult = await pool.query('DELETE FROM subscriptions');
    console.log(`   Deleted ${subscriptionsResult.rowCount ?? 0} subscriptions`);

    // Delete all events
    console.log('🗑️  Deleting events...');
    const eventsResult = await pool.query('DELETE FROM events');
    console.log(`   Deleted ${eventsResult.rowCount ?? 0} events`);

    // Reset indexer cursor
    console.log('🗑️  Resetting indexer cursor...');
    const cursorResult = await pool.query('DELETE FROM indexer_cursor');
    console.log(`   Reset ${cursorResult.rowCount ?? 0} cursor(s)`);

    console.log('\n✅ Database cleaned successfully!\n');
    console.log('📝 Database is now empty and ready for fresh data.');
    console.log('🔄 Restart the indexer to begin indexing from the configured start block.\n');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanDatabase().catch((error) => {
  console.error('❌ Cleanup error:', error);
  process.exit(1);
});
