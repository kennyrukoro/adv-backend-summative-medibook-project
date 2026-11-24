'use strict';
// Separate process: npm run worker
require('dotenv').config();
const KEYS = require('./queue/keys');
const { createRedis, getRedis } = require('./queue/redisClient');
const handlers = require('./queue/handlers');
const { writeAuditEntry } = require('./logging/auditLogger');
const { pool } = require('./models/db');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handleJob(redis, raw) {
  const job = JSON.parse(raw);
  if (job.type === 'slot_freed') return handlers.processSlotFreed(redis, job);
  if (job.type === 'confirmation') return handlers.sendConfirmation(job);
  throw new Error(`unknown job type: ${job.type}`);
}

async function main() {
  const redis = getRedis();
  const popper = createRedis(); // BLMOVE blocks this connection, so it cannot be shared
  let running = true;

  const recovered = await handlers.recoverProcessing(redis) + await handlers.recoverInflight(redis);
  await writeAuditEntry({ event: 'worker_started', recovered_items: recovered });

  const stop = async () => {
    running = false;
    await writeAuditEntry({ event: 'worker_stopping' });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  while (running) {
    let raw;
    try {
      raw = await popper.blmove(KEYS.QUEUE, KEYS.PROCESSING, 'RIGHT', 'LEFT', 5);
    } catch (err) {
      console.error('[worker] queue read failed:', err.message);
      await sleep(1000);
      continue;
    }
    if (!raw) continue;

    try {
      await handleJob(redis, raw);
    } catch (err) {
      // Jobs that fail are recorded, not silently dropped
      await writeAuditEntry({ event: 'job_failed', error: err.message, job: raw.slice(0, 500) });
    }
    await redis.lrem(KEYS.PROCESSING, 1, raw); // acknowledge only after handling
  }

  popper.disconnect();
  redis.disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
