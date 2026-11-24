'use strict';

/** Parse 'YYYY-MM-DD HH:mm[:ss]' as UTC milliseconds (used only for differences). */
function toUtcMs(stamp) {
  const [date, time = '00:00:00'] = stamp.split(' ');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s = 0] = time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/** Hours from `from` to `to` (both 'YYYY-MM-DD HH:mm:ss' clinic-local strings). */
function hoursBetween(from, to) {
  return (toUtcMs(to) - toUtcMs(from)) / 3600000;
}

/**
 * Current clinic-local time as 'YYYY-MM-DD HH:mm:ss'.
 * The clinic keeps one local clock; offsetMinutes shifts UTC onto it.
 */
function clinicNow(offsetMinutes, nowMs = Date.now()) {
  return new Date(nowMs + offsetMinutes * 60000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

module.exports = { toUtcMs, hoursBetween, clinicNow };
