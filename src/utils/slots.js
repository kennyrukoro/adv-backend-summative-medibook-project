'use strict';
const { AppError } = require('./errors');

const SLOT_MINUTES = 30;
const OPEN_MINUTES = 9 * 60;        // 09:00
const CLOSE_MINUTES = 17 * 60;      // 17:00 (clinic closes; last slot starts 16:30)
const DAILY_CAP = 12;               // (17:00 - 09:00) / 30 min

// Accepts 'YYYY-MM-DD HH:mm' or the stored form 'YYYY-MM-DD HH:mm:00' (only :00 seconds).
const SLOT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::00)?$/;

/**
 * Validate a requested slot start, given as 'YYYY-MM-DD HH:mm' (or 'T' separator, or ':00' seconds).
 * Format and calendar errors -> 400; rule violations -> 422.
 * Returns { value, date, time } where value is 'YYYY-MM-DD HH:mm:00' (clinic local).
 */
function validateSlotStart(input, nowLocal) {
  if (typeof input !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'slot_start must be a string like "2026-12-07 09:30"');
  }
  const m = SLOT_PATTERN.exec(input.trim());
  if (!m) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slot_start must be in "YYYY-MM-DD HH:mm" format');
  }
  const [, y, mo, d, h, mi] = m.map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    throw new AppError(400, 'VALIDATION_ERROR', 'slot_start is not a real calendar date');
  }
  const minutes = h * 60 + mi;
  if (mi !== 0 && mi !== SLOT_MINUTES) {
    throw new AppError(422, 'SLOT_NOT_ALIGNED', 'slot_start must start on :00 or :30');
  }
  if (minutes < OPEN_MINUTES || minutes > CLOSE_MINUTES - SLOT_MINUTES) {
    throw new AppError(422, 'OUTSIDE_WORKING_HOURS',
      'slot_start must be between 09:00 and 16:30 (a 30-minute slot must end by 17:00)');
  }
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = `${m[4]}:${m[5]}`;
  const value = `${date} ${time}:00`;
  if (nowLocal && value <= nowLocal) {
    throw new AppError(422, 'SLOT_IN_PAST', 'slot_start must be in the future');
  }
  return { value, date, time };
}

module.exports = {
  SLOT_MINUTES, OPEN_MINUTES, CLOSE_MINUTES, DAILY_CAP, validateSlotStart,
};
