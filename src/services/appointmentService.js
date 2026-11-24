'use strict';
const { withTransaction } = require('../models/db');
const patientModel = require('../models/patientModel');
const doctorModel = require('../models/doctorModel');
const appointmentModel = require('../models/appointmentModel');
const { AppError } = require('../utils/errors');
const { validateSlotStart, DAILY_CAP } = require('../utils/slots');
const { clinicNow, hoursBetween } = require('../utils/time');
const { calculateRefund } = require('../utils/refund');
const { writeAuditEntry } = require('../logging/auditLogger');
const config = require('../config');
const producer = require('../queue/producer');

const now = () => clinicNow(config.clinicOffsetMinutes);

/** Thrown inside the booking transaction; mapped to 409 or to a waitlist offer. */
class BookingConflict extends Error {
  constructor(scope, code) {
    super(code);
    this.scope = scope; // 'slot' or 'day'
    this.code = code;   // 'SLOT_TAKEN' or 'DAILY_CAP_REACHED'
  }
}

/**
 * Book a slot. Safe under concurrency:
 *  1. Lock the doctor row (FOR UPDATE) so bookings for one doctor run one at a time.
 *  2. Count that day's active bookings (cap 12) under the same lock.
 *  3. Insert; the UNIQUE(doctor_id, active_slot) key is the final guard for the slot.
 * Returns { appointment, waitlisted:false } or { waitlisted:true, position, scope } when waitlist was requested.
 */
async function bookAppointment({ patientId, doctorId, slotStart, waitlist = false, source = 'api' }) {
  const slot = validateSlotStart(slotStart, now());

  let result;
  try {
    result = await withTransaction(async (conn) => {
      const doctor = await doctorModel.findByIdForUpdate(doctorId, conn);
      if (!doctor) throw new AppError(404, 'DOCTOR_NOT_FOUND', `Doctor ${doctorId} does not exist`);
      const patient = await patientModel.findById(patientId, conn);
      if (!patient) throw new AppError(404, 'PATIENT_NOT_FOUND', `Patient ${patientId} does not exist`);

      const booked = await appointmentModel.countBookedOnDay(doctorId, slot.date, conn);
      if (booked >= DAILY_CAP) throw new BookingConflict('day', 'DAILY_CAP_REACHED');

      let appointmentId;
      try {
        appointmentId = await appointmentModel.insert({
          patientId, doctorId, slotStart: slot.value, amountPaid: doctor.consultation_fee,
        }, conn);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new BookingConflict('slot', 'SLOT_TAKEN');
        throw err;
      }
      return appointmentModel.findDetailById(appointmentId, conn);
    });
  } catch (err) {
    if (err instanceof BookingConflict) {
      if (!waitlist) {
        const message = err.code === 'SLOT_TAKEN'
          ? 'This slot is already booked'
          : 'This doctor has reached the daily limit of 12 appointments';
        throw new AppError(409, err.code, message);
      }
      const position = await producer.joinWaitlist({
        patientId, doctorId, slotStart: slot.value, date: slot.date, scope: err.scope,
      });
      return { waitlisted: true, position, scope: err.scope };
    }
    throw err;
  }

  // Only reached after a successful commit
  writeAuditEntry({
    event: 'booking_confirmed', source, appointment_id: result.appointment_id,
    patient_id: patientId, doctor_id: doctorId, slot_start: slot.value, amount_paid: Number(result.amount_paid),
  });
  producer.enqueueConfirmation({
    appointment_id: result.appointment_id, patient_id: patientId, doctor_id: doctorId,
    slot_start: slot.value, email: result.patient_email,
  });
  return { waitlisted: false, appointment: result };
}

/**
 * Cancel an appointment. The status change and the refund record are one transaction.
 * Refund tier is based on the notice between now and the slot start.
 */
async function cancelAppointment(appointmentId) {
  const cancelledAt = now();
  const outcome = await withTransaction(async (conn) => {
    const appt = await appointmentModel.findByIdForUpdate(appointmentId, conn);
    if (!appt) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} does not exist`);
    if (appt.status === 'cancelled') throw new AppError(409, 'ALREADY_CANCELLED', 'Appointment is already cancelled');

    const notice = hoursBetween(cancelledAt, appt.slot_start);
    const refund = calculateRefund(appt.amount_paid, notice);
    const updated = await appointmentModel.markCancelled(appointmentId, {
      cancelledAt, refundPercent: refund.percent, refundAmount: refund.amount,
    }, conn);
    if (updated !== 1) throw new AppError(409, 'ALREADY_CANCELLED', 'Appointment is already cancelled');

    return {
      appointment: await appointmentModel.findDetailById(appointmentId, conn),
      refund, notice,
    };
  });

  writeAuditEntry({
    event: 'appointment_cancelled', appointment_id: appointmentId,
    doctor_id: outcome.appointment.doctor_id, slot_start: outcome.appointment.slot_start,
    notice_hours: Number(outcome.notice.toFixed(2)), refund_percent: outcome.refund.percent,
    refund_amount: outcome.refund.amount,
  });
  producer.enqueueSlotFreed({ doctorId: outcome.appointment.doctor_id, slotStart: outcome.appointment.slot_start });
  return outcome;
}

module.exports = { bookAppointment, cancelAppointment, BookingConflict };
