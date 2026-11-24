'use strict';
const patientModel = require('../models/patientModel');
const { parseId, validatePatient } = require('../utils/validators');
const { AppError } = require('../utils/errors');

const notFound = (id) => new AppError(404, 'PATIENT_NOT_FOUND', `Patient ${id} does not exist`);

async function list(req, res) {
  res.json({ data: await patientModel.findAll() });
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'patient id');
  const patient = await patientModel.findById(id);
  if (!patient) throw notFound(id);
  res.json({ data: patient });
}

async function create(req, res) {
  const input = validatePatient(req.body);
  const id = await patientModel.create(input);
  const patient = await patientModel.findById(id);
  res.status(201).location(`/api/patients/${id}`).json({ data: patient });
}

async function update(req, res) {
  const id = parseId(req.params.id, 'patient id');
  const input = validatePatient(req.body, { partial: true });
  if (!(await patientModel.findById(id))) throw notFound(id);
  await patientModel.update(id, input);
  res.json({ data: await patientModel.findById(id) });
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'patient id');
  const affected = await patientModel.remove(id); // FK RESTRICT -> 409 if appointments exist
  if (affected === 0) throw notFound(id);
  res.status(204).end();
}

module.exports = { list, getOne, create, update, remove };
