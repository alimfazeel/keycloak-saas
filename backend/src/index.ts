import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Pool } from 'pg';

const app = Fastify({ logger: true });

// Middleware
await app.register(cors, { origin: true });
await app.register(helmet);

// Database
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'keycloak',
  user: process.env.DB_USER || 'keycloak',
  password: process.env.DB_PASSWORD || 'keycloak-password-dev'
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Ready check (includes DB)
app.get('/health/ready', async () => {
  try {
    const res = await pool.query('SELECT 1');
    return { status: 'ready', database: 'connected', timestamp: new Date().toISOString() };
  } catch (e) {
    return app.httpErrors.serviceUnavailable('Database connection failed');
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  app.log.info('Shutting down gracefully...');
  await pool.end();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start
const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3000');
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;
