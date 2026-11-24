'use strict';
const { validateSlotStart, DAILY_CAP } = require('../../src/utils/slots');
const { hoursBetween, clinicNow } = require('../../src/utils/time');

const NOW = '2026-11-21 10:00:00';

describe('slot validation (working hours and 30-minute boundaries)', () => {
  test('accepts a valid on-boundary slot and normalises the value', () => {
    expect(validateSlotStart('2026-12-07 09:30', NOW)).toEqual({
      value: '2026-12-07 09:30:00', date: '2026-12-07', time: '09:30',
    });
  });

  test('accepts the first slot 09:00 and the last slot 16:30', () => {
    expect(validateSlotStart('2026-12-07 09:00', NOW).value).toBe('2026-12-07 09:00:00');
    expect(validateSlotStart('2026-12-07 16:30', NOW).value).toBe('2026-12-07 16:30:00');
  });

  test('accepts the stored form with :00 seconds (used when a waitlist entry is promoted)', () => {
    expect(validateSlotStart('2026-12-07 09:30:00', NOW).value).toBe('2026-12-07 09:30:00');
  });

  test('rejects non-zero seconds', () => {
    expect(() => validateSlotStart('2026-12-07 09:30:30', NOW)).toThrow(/YYYY-MM-DD HH:mm/);
  });

  test('rejects 17:00 (clinic closes; a 30-minute slot cannot start there)', () => {
    try { validateSlotStart('2026-12-07 17:00', NOW); throw new Error('no throw'); }
      catch (e) { expect(e.status).toBe(422); expect(e.code).toBe('OUTSIDE_WORKING_HOURS'); }
  });

  test('rejects 09:15 (not on a 30-minute boundary)', () => {
    expect(() => validateSlotStart('2026-12-07 09:15', NOW)).toThrow(/:00 or :30/);
  });

  test('rejects a malformed date with 400', () => {
    expect(() => validateSlotStart('2026-13-40 09:00', NOW)).toThrow(/real calendar date/);
    try { validateSlotStart('07/12/2026 09:00', NOW); throw new Error('no throw'); }
      catch (e) { expect(e.status).toBe(400); }
  });

  test('rejects a date-time that is in the past', () => {
    expect(() => validateSlotStart('2026-11-21 09:00', NOW)).toThrow(/future/);
  });

  test('rejects non-string input', () => {
    expect(() => validateSlotStart(undefined, NOW)).toThrow(/must be a string/);
  });

  test('daily cap constant matches the 09:00-17:00 day in 30-minute slots', () => {
    expect(DAILY_CAP).toBe(12);
  });
});

describe('time helpers', () => {
  test('hoursBetween gives exact differences across the 48h and 24h boundaries', () => {
    expect(hoursBetween('2026-12-01 09:00:00', '2026-12-03 09:00:00')).toBe(48);
    expect(hoursBetween('2026-12-01 09:00:00', '2026-12-02 09:00:00')).toBe(24);
  });

  test('clinicNow applies the clinic offset to UTC', () => {
    const utc = Date.UTC(2026, 10, 21, 8, 0, 0); // 08:00 UTC
    expect(clinicNow(0, utc)).toBe('2026-11-21 08:00:00');
    expect(clinicNow(120, utc)).toBe('2026-11-21 10:00:00');
  });
});
