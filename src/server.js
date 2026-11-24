'use strict';
require('dotenv').config();
const config = require('./config');
const { createApp } = require('./app');
const { pool } = require('./models/db');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`MediBook API listening on http://localhost:${config.port}`);
  console.log('Start the waitlist/notification worker in another terminal: npm run worker');
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
