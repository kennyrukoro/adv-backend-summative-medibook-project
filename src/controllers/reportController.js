'use strict';
const reportModel = require('../models/reportModel');
const { DAILY_CAP } = require('../utils/slots');

const BUSY_THRESHOLD_PCT = 80; // "more than 80% of the 12-slot capacity"

/** Every doctor, including those with no appointments. */
async function doctors(req, res) {
  const rows = await reportModel.doctorsReport();
  res.json({
    data: rows.map((r) => ({
      doctor_id: r.doctor_id,
      full_name: r.full_name,
      specialty: r.specialty,
      total_appointments: Number(r.total_appointments),
      active_appointments: Number(r.active_appointments),
      cancelled_appointments: Number(r.cancelled_appointments),
      revenue_collected: Number(r.revenue_collected),
    })),
  });
}

/** Every (doctor, date) with more than 80% of the daily cap booked. */
async function busyDays(req, res) {
  const rows = await reportModel.busyDays(BUSY_THRESHOLD_PCT, DAILY_CAP);
  res.json({
    data: rows.map((r) => ({
      doctor_id: r.doctor_id,
      doctor_name: r.doctor_name,
      date: r.day,
      booked: Number(r.booked),
      capacity: DAILY_CAP,
      utilization_pct: Number(r.utilization_pct),
    })),
  });
}

module.exports = { doctors, busyDays };
