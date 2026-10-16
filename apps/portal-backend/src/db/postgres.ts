// ====================================================================
// NexusHub Portal Backend: PostgreSQL Database Client
// ====================================================================

import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgrespassword',
  database: process.env.PG_DATABASE || 'portal_db',
  max: 15,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected client error:', err.message);
});

