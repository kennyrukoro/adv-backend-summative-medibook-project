'use strict';
const mysql = require('mysql2/promise');
const config = require('../config');

// dateStrings: DATE/DATETIME come back as 'YYYY-MM-DD HH:mm:ss' strings, so no timezone
// conversion happens between the DB (clinic local time) and the application.
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  dateStrings: true,
  namedPlaceholders: false,
});

/**
 * Run fn(conn) inside a transaction. Commits if fn resolves, rolls back if it throws.
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* original error is more useful */ }
    throw err;
  } finally {
    conn.release();
  }
}

/** Run a statement with parameters; optional conn for use inside a transaction. */
function query(sql, params = [], conn = pool) {
  return conn.execute(sql, params).then(([rows]) => rows);
}

module.exports = { pool, withTransaction, query };
