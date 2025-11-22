import express from 'express';
import { config } from '../config/index.js';
import { testConnection } from '../db/client.js';
import subscriptionsRouter from './routes/subscriptions.js';
import eventsRouter from './routes/events.js';

const app = express();

// Middleware
app.use(express.json());

// CORS middleware (allow all origins for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/events', eventsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  console.log('🚀 Starting ChaosChain API Server...');

  // Test database connection
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Start server
  app.listen(config.api.port, config.api.host, () => {
    console.log(`✅ API Server running on http://${config.api.host}:${config.api.port}`);
    console.log(`📡 Health check: http://${config.api.host}:${config.api.port}/health`);
    console.log(`📋 Subscriptions: http://${config.api.host}:${config.api.port}/api/subscriptions`);
    console.log(`📊 Events: http://${config.api.host}:${config.api.port}/api/events\n`);
  });
}

main().catch((error) => {
  console.error('❌ API Server startup error:', error);
  process.exit(1);
});
