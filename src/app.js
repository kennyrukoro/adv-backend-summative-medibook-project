'use strict';
const express = require('express');
const { api, feedback } = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', api);
  app.use('/feedback', feedback);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
