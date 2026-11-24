'use strict';
const { getRedis } = require('./redisClient');
const KEYS = require('./keys');
const { writeAuditEntry } = require('../logging/auditLogger');

/** Add a patient to a doctor's waitlist. scope: 'slot' (this slot only) or 'day' (any slot that day). */
async function joinWaitlist({ patientId, doctorId, slotStart, date, scope }) {
  const entry = {
    patient_id: patientId, doctor_id: doctorId, slot_start: slotStart,
    date, scope, attempts: 0, requested_at: new Date().toISOString(),
  };
  return getRedis().rpush(KEYS.waitlist(doctorId), JSON.stringify(entry)); // returns queue length
}

/** Called after a cancellation commits. Failure is logged, not raised: the cancellation already stands. */
async function enqueueSlotFreed({ doctorId, slotStart }) {
  try {
    await getRedis().lpush(KEYS.QUEUE, JSON.stringify({ type: 'slot_freed', doctor_id: doctorId, slot_start: slotStart }));
  } catch (err) {
    await writeAuditEntry({ event: 'enqueue_failed', job: 'slot_freed', doctor_id: doctorId, slot_start: slotStart, error: err.message });
  }
}

/** Called after a booking commits. Confirmation is sent by the worker through the audit log. */
async function enqueueConfirmation(payload) {
  try {
    await getRedis().lpush(KEYS.QUEUE, JSON.stringify({ type: 'confirmation', ...payload }));
  } catch (err) {
    await writeAuditEntry({ event: 'enqueue_failed', job: 'confirmation', appointment_id: payload.appointment_id, error: err.message });
  }
}

module.exports = { joinWaitlist, enqueueSlotFreed, enqueueConfirmation };
