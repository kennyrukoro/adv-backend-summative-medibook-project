'use strict';
require('dotenv').config();
const path = require('path');

const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};

module.exports = {
  port: num(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'medibook',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medibook',
    connectionLimit: 10,
  },
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  clinicOffsetMinutes: num(process.env.CLINIC_UTC_OFFSET_MINUTES, 0),
  auditLogPath: path.join(__dirname, '..', '..', 'logs', 'audit.log'),
  localesDir: path.join(__dirname, '..', '..', 'locales'),
};
