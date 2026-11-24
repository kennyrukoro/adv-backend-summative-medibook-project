'use strict';
const { query } = require('./db');

/**
 * Count the doctor's active appointments on a clinic-local date.
 * FOR UPDATE makes this a locking read, so it always sees the latest committed state.
 */
async function countBookedOnDay(doctorId, date, conn) {
  const rows = await query(
    `SELECT COUNT(*) AS n
       FROM appointments
      WHERE doctor_id = ?
        AND status = 'booked'
        AND slot_start >= ?
        AND slot_start < DATE_ADD(?, INTERVAL 1 DAY)
      FOR UPDATE`,
    [doctorId, `${date} 00:00:00`, date], conn
  );
  return Number(rows[0].n);
}

/** Inserts a booking. Throws ER_DUP_ENTRY if the doctor's slot is already held. */
async function insert({ patientId, doctorId, slotStart, amountPaid }, conn) {
  const res = await query(
    `INSERT INTO appointments (patient_id, doctor_id, slot_start, amount_paid)
     VALUES (?, ?, ?, ?)`,
    [patientId, doctorId, slotStart, amountPaid], conn
  );
  return res.insertId;
}

const DETAIL_SELECT = `
  SELECT a.appointment_id, a.patient_id, a.doctor_id, a.slot_start, a.status,
         a.amount_paid, a.booked_at, a.cancelled_at, a.refund_percent, a.refund_amount,
         p.full_name AS patient_name, p.email AS patient_email,
         d.full_name AS doctor_name, d.room AS doctor_room
    FROM appointments a
    JOIN patients p ON p.patient_id = a.patient_id
    JOIN doctors  d ON d.doctor_id  = a.doctor_id`;

async function findDetailById(id, conn) {
  const rows = await query(`${DETAIL_SELECT} WHERE a.appointment_id = ?`, [id], conn);
  return rows[0] || null;
}

/** Locking read of one appointment, used when cancelling. */
async function findByIdForUpdate(id, conn) {
  const rows = await query(
    'SELECT appointment_id, doctor_id, slot_start, status, amount_paid FROM appointments WHERE appointment_id = ? FOR UPDATE',
    [id], conn
  );
  return rows[0] || null;
}

/** Writes the cancellation and refund record onto the appointment row. */
async function markCancelled(id, { cancelledAt, refundPercent, refundAmount }, conn) {
  const res = await query(
    `UPDATE appointments
        SET status = 'cancelled', cancelled_at = ?, refund_percent = ?, refund_amount = ?
      WHERE appointment_id = ? AND status = 'booked'`,
    [cancelledAt, refundPercent, refundAmount, id], conn
  );
  return res.affectedRows;
}

/** Is this patient already booked into this doctor slot? Used to make waitlist promotion idempotent. */
async function findActiveBySlotAndPatient(doctorId, slotStart, patientId) {
  const rows = await query(
    `SELECT appointment_id FROM appointments
      WHERE doctor_id = ? AND slot_start = ? AND patient_id = ? AND status = 'booked'`,
    [doctorId, slotStart, patientId]
  );
  return rows[0] || null;
}

module.exports = {
  findActiveBySlotAndPatient,
  countBookedOnDay, insert, findDetailById, findByIdForUpdate, markCancelled,
};
