'use strict';
const KEYS = require('./keys');
const { writeAuditEntry } = require('../logging/auditLogger');
const { bookAppointment } = require('../services/appointmentService');
const { AppError } = require('../utils/errors');
const appointmentModel = require('../models/appointmentModel');

const MAX_ATTEMPTS = 3;

// Atomically take one specific entry off a waitlist and park it in INFLIGHT.
// Returns 1 if this worker claimed it, 0 if another worker or a removal got there first.
const CLAIM_SCRIPT = `
if redis.call('LREM', KEYS[1], 1, ARGV[1]) == 1 then
  redis.call('LPUSH', KEYS[2], ARGV[1])
  return 1
end
return 0`;

/** Crash recovery at worker start: anything left in flight goes back to the head of its waitlist. */
async function recoverInflight(redis) {
  const raws = await redis.lrange(KEYS.INFLIGHT, 0, -1);
  for (const raw of raws) {
    const entry = JSON.parse(raw);
    await redis.multi()
      .lpush(KEYS.waitlist(entry.doctor_id), raw)
      .lrem(KEYS.INFLIGHT, 1, raw)
      .exec();
  }
  return raws.length;
}

/** Crash recovery for jobs taken but not acknowledged. */
async function recoverProcessing(redis) {
  const raws = await redis.lrange(KEYS.PROCESSING, 0, -1);
  for (const raw of raws) {
    await redis.multi().lpush(KEYS.QUEUE, raw).lrem(KEYS.PROCESSING, 1, raw).exec();
  }
  return raws.length;
}

/**
 * A cancellation freed doctor X at slot S. Promote the first waitlisted patient who wants S
 * (scope 'slot' with the same time, or scope 'day' on the same date).
 */
async function processSlotFreed(redis, { doctor_id: doctorId, slot_start: slotStart }) {
  const date = slotStart.slice(0, 10);
  const raws = await redis.lrange(KEYS.waitlist(doctorId), 0, -1);
  for (const raw of raws) {
    const entry = JSON.parse(raw);
    const wants = entry.scope === 'slot' ? entry.slot_start === slotStart : entry.date === date;
    if (!wants) continue;
    const claimed = await redis.eval(CLAIM_SCRIPT, 2, KEYS.waitlist(doctorId), KEYS.INFLIGHT, raw);
    if (Number(claimed) !== 1) continue;
    return promote(redis, entry, raw, slotStart);
  }
  await writeAuditEntry({ event: 'slot_freed_no_waitlist_match', doctor_id: doctorId, slot_start: slotStart });
  return null;
}

/**
 * Book the claimed patient into the freed slot. Every outcome keeps the patient somewhere:
 *   success             -> removed from INFLIGHT (they now have an appointment)
 *   already booked      -> treated as success (a previous attempt committed before a crash)
 *   conflict / DB error -> back to the HEAD of the waitlist with attempts+1, up to MAX_ATTEMPTS
 *   permanent error     -> (patient/doctor gone, slot in the past) recorded in waitlist:dead
 */
async function promote(redis, entry, raw, slotStart) {
  try {
    const already = await appointmentModel.findActiveBySlotAndPatient(entry.doctor_id, slotStart, entry.patient_id);
    if (!already) {
      await bookAppointment({
        patientId: entry.patient_id, doctorId: entry.doctor_id, slotStart, source: 'waitlist',
      });
    }
    await redis.lrem(KEYS.INFLIGHT, 1, raw);
    await writeAuditEntry({
      event: 'waitlist_promoted', patient_id: entry.patient_id, doctor_id: entry.doctor_id, slot_start: slotStart,
    });
    return 'promoted';
  } catch (err) {
    const permanent = err instanceof AppError && (err.status === 404 || err.status === 422);
    const attempts = entry.attempts + 1;
    const updated = JSON.stringify({ ...entry, attempts, last_error: err.message, last_slot: slotStart });
    if (!permanent && attempts < MAX_ATTEMPTS) {
      await redis.multi()
        .lrem(KEYS.INFLIGHT, 1, raw)
        .lpush(KEYS.waitlist(entry.doctor_id), updated)
        .exec();
      await writeAuditEntry({ event: 'waitlist_promotion_retry', patient_id: entry.patient_id, attempts, reason: err.message });
      return 'requeued';
    }
    await redis.multi()
      .lrem(KEYS.INFLIGHT, 1, raw)
      .lpush(KEYS.DEAD, updated)
      .exec();
    await writeAuditEntry({ event: 'waitlist_dead', patient_id: entry.patient_id, attempts, reason: err.message });
    return 'dead';
  }
}

/** Confirmation "message" is written to the audit log (no real SMS/email is sent). */
async function sendConfirmation(job) {
  await writeAuditEntry({
    event: 'notification_sent',
    channel: 'email',
    to: job.email,
    appointment_id: job.appointment_id,
    message: `Your appointment ${job.appointment_id} with doctor ${job.doctor_id} is confirmed for ${job.slot_start}.`,
  });
}

module.exports = {
  recoverInflight, recoverProcessing, processSlotFreed, promote, sendConfirmation, MAX_ATTEMPTS,
};
