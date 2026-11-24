'use strict';
const doctorModel = require('../models/doctorModel');
const reportModel = require('../models/reportModel');
const { parseId, validateDoctor } = require('../utils/validators');
const { AppError } = require('../utils/errors');
const { DAILY_CAP } = require('../utils/slots');
const { clinicNow } = require('../utils/time');
const config = require('../config');

const notFound = (id) => new AppError(404, 'DOCTOR_NOT_FOUND', `Doctor ${id} does not exist`);

async function list(req, res) {
  res.json({ data: await doctorModel.findAll() });
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'doctor id');
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw notFound(id);
  res.json({ data: doctor });
}

async function create(req, res) {
  const input = validateDoctor(req.body);
  const id = await doctorModel.create(input);
  res.status(201).location(`/api/doctors/${id}`).json({ data: await doctorModel.findById(id) });
}

async function update(req, res) {
  const id = parseId(req.params.id, 'doctor id');
  const input = validateDoctor(req.body, { partial: true });
  if (!(await doctorModel.findById(id))) throw notFound(id);
  await doctorModel.update(id, input);
  res.json({ data: await doctorModel.findById(id) });
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'doctor id');
  const affected = await doctorModel.remove(id);
  if (affected === 0) throw notFound(id);
  res.status(204).end();
}

/**
 * Doctor statistics. Every figure comes from SQL in reportModel; this function only shapes the response.
 */
async function stats(req, res) {
  const id = parseId(req.params.id, 'doctor id');
  if (!(await doctorModel.findById(id))) throw notFound(id);

  const now = clinicNow(config.clinicOffsetMinutes);
  const today = now.slice(0, 10);
  const [revenue, upcoming, days] = await Promise.all([
    reportModel.doctorRevenue(id),
    reportModel.doctorUpcomingCount(id, now),
    reportModel.doctorNext7Days(id, today, DAILY_CAP),
  ]);

  res.json({
    data: {
      doctor_id: id,
      revenue_collected: revenue,
      upcoming_appointments: upcoming,
      daily_cap: DAILY_CAP,
      next_7_days: days.map((d) => ({
        date: d.day,
        booked: Number(d.booked),
        utilization_pct: Number(d.utilization_pct),
      })),
    },
  });
}

module.exports = { list, getOne, create, update, remove, stats };
