'use strict';
const Redis = require('ioredis');
const config = require('../config');

/** New connection. Workers need their own connection because BRPOP blocks it. */
function createRedis() {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: 3, enableOfflineQueue: true });
}

let shared = null;
/** Shared connection for ordinary commands (producers, worker bookkeeping). */
function getRedis() {
  if (!shared) shared = createRedis();
  return shared;
}

module.exports = { createRedis, getRedis };
