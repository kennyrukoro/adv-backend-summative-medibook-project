'use strict';
// Redis keys used by the application
module.exports = {
  QUEUE: 'jobs:queue',                // slot_freed and confirmation jobs (FIFO: LPUSH + BLMOVE)
  PROCESSING: 'jobs:processing',      // jobs a worker has taken but not finished (crash recovery)
  waitlist: (doctorId) => `waitlist:doctor:${doctorId}`, // waiting patients (RPUSH join, scan from head)
  INFLIGHT: 'waitlist:inflight',      // waitlist entries being promoted right now (crash recovery)
  DEAD: 'waitlist:dead',              // entries that could not be promoted after MAX_ATTEMPTS
};
