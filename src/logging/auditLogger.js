'use strict';
const fsp = require('fs/promises');
const path = require('path');
const config = require('../config');

/**
 * Append one JSON line to logs/audit.log. Non-blocking (fs/promises), and it never rejects:
 * a logging failure is reported on stderr and must not fail the user's request.
 */
async function writeAuditEntry(entry, file = config.auditLogPath) {
  try {
    // recursive mkdir is a no-op when the folder exists, so the first write creates logs/
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    await fsp.appendFile(file, line, 'utf8');
  } catch (err) {
    console.error('[audit] could not write audit entry:', err.message);
  }
}

module.exports = { writeAuditEntry };
