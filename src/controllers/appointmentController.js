'use strict';
const appointmentModel = require('../models/appointmentModel');
const { parseId, validateBookingBody } = require('../utils/validators');
const { AppError } = require('../utils/errors');
const { bookAppointment, cancelAppointment } = require('../services/appointmentService');

function shape(a) {
  return {
    appointment_id: a.appointment_id,
    patient_id: a.patient_id,
    patient_name: a.patient_name,
    doctor_id: a.doctor_id,
    doctor_name: a.doctor_name,
    doctor_room: a.doctor_room,
    slot_start: a.slot_start,
    status: a.status,
    amount_paid: Number(a.amount_paid),
    booked_at: a.booked_at,
    cancelled_at: a.cancelled_at,
    refund_percent: a.refund_percent === null ? null : Number(a.refund_percent),
    refund_amount: a.refund_amount === null ? null : Number(a.refund_amount),
  };
}

/**
 * POST /api/appointments
 *  201 booked, with Location header
 *  202 waitlisted (only when body.waitlist = true and the slot or day is full)
 *  409 slot taken or daily cap reached (when no waitlist requested)
 *  422 outside hours / not on a slot boundary / in the past
 */
async function book(req, res) {
  const { patientId, doctorId, waitlist } = validateBookingBody(req.body);
  const result = await bookAppointment({
    patientId, doctorId, slotStart: req.body.slot_start, waitlist,
  });
  if (result.waitlisted) {
    return res.status(202).json({
      data: {
        status: 'waitlisted',
        position: result.position,
        scope: result.scope === 'slot' ? 'this_slot' : 'any_slot_that_day',
        message: 'The slot is full. You have been added to the waitlist and will be booked if a place frees up.',
      },
    });
  }
  res.status(201).location(`/api/appointments/${result.appointment.appointment_id}`)
    .json({ data: shape(result.appointment) });
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'appointment id');
  const row = await appointmentModel.findDetailById(id);
  if (!row) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', `Appointment ${id} does not exist`);
  res.json({ data: shape(row) });
}

/** POST /api/appointments/:id/cancel - the response states the refund (the cancellation record). */
async function cancel(req, res) {
  const id = parseId(req.params.id, 'appointment id');
  const { appointment, refund, notice } = await cancelAppointment(id);
  res.json({
    data: {
      ...shape(appointment),
      notice_hours: Number(notice.toFixed(2)),
      refund: { percent: refund.percent, amount: refund.amount },
    },
  });
}

module.exports = { book, getOne, cancel };
