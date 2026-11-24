'use strict';
const { AppError } = require('../utils/errors');

// MySQL error codes that map to HTTP statuses
const MYSQL_MAP = {
  ER_DUP_ENTRY: [409, 'DUPLICATE', 'A record with the same unique value already exists'],
  ER_ROW_IS_REFERENCED_2: [409, 'IN_USE', 'Cannot delete: the record is referenced by appointments'],
  ER_NO_REFERENCED_ROW_2: [422, 'INVALID_REFERENCE', 'A referenced patient or doctor does not exist'],
};

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// Central error handler: every error leaves here as { error: { code, message, details? } }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json({ error: body });
  }
  if (err.code && MYSQL_MAP[err.code]) {
    const [status, code, message] = MYSQL_MAP[err.code];
    return res.status(status).json({ error: { code, message } });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

module.exports = { notFound, errorHandler };
