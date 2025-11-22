import { pool } from './client.js';

async function cleanSubscriptions() {
  console.log('🌊 TellTide Subscription Cleanup Tool\n');
  console.log('⚠️  WARNING: This will delete ALL subscriptions and notifications!\n');
  console.log('✅ Events will be preserved.\n');

  try {
    // Delete all notification logs first (foreign key constraint)
    console.log('🗑️  Deleting notification logs...');
    const notificationsResult = await pool.query('DELETE FROM notifications_log');
    console.log(`   Deleted ${notificationsResult.rowCount ?? 0} notification logs`);

    // Delete all subscriptions
    console.log('🗑️  Deleting subscriptions...');
    const subscriptionsResult = await pool.query('DELETE FROM subscriptions');
    console.log(`   Deleted ${subscriptionsResult.rowCount ?? 0} subscriptions`);

    console.log('\n✅ Subscriptions and notifications cleaned successfully!\n');
    console.log('📝 Events data is preserved.');
    console.log('🔄 You can now insert new subscriptions for testing.\n');
  } catch (error) {
    console.error('❌ Error cleaning subscriptions:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanSubscriptions().catch((error) => {
  console.error('❌ Cleanup error:', error);
  process.exit(1);
});
