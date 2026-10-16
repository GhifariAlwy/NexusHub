// ====================================================================
// NexusHub Portal Backend: DragonFly Cache Client
// ====================================================================

import Redis from 'ioredis';

const DRAGONFLY_HOST = process.env.DRAGONFLY_HOST || 'localhost';
const DRAGONFLY_PORT = parseInt(process.env.DRAGONFLY_PORT || '6379', 10);

export const redis = new Redis({
  host: DRAGONFLY_HOST,
  port: DRAGONFLY_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 100, 2000);
  }
});

redis.on('connect', () => {
  console.log(`[DragonFly] Portal Backend connected at ${DRAGONFLY_HOST}:${DRAGONFLY_PORT}`);
});

redis.on('error', (err) => {
  console.warn(`[DragonFly] Portal Backend cache error: ${err.message}`);
});

