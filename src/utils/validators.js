'use strict';
const { AppError } = require('./errors');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\- ]{6,18}[0-9]$/;
const ROOM = /^[A-Za-z0-9-]{1,10}$/;

function fail(details) {
  throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
}

function requireObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail([{ field: 'body', message: 'Request body must be a JSON object' }]);
  }
}

/** Positive integer id from a route parameter. */
function parseId(raw, name = 'id') {
  if (!/^[1-9]\d*$/.test(String(raw))) {
    throw new AppError(400, 'VALIDATION_ERROR', `${name} must be a positive integer`);
  }
  return Number(raw);
}

/**
 * Validate patient input. partial=true for PATCH (only supplied fields checked).
 * Returns a clean object containing only known fields.
 */
function validatePatient(body, { partial = false } = {}) {
  requireObject(body);
  const errors = [];
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('full_name') || !partial) {
    const v = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (v.length < 2 || v.length > 100) errors.push({ field: 'full_name', message: 'full_name must be 2-100 characters' });
    else out.full_name = v;
  }
  if (has('email') || !partial) {
    const v = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(v) || v.length > 255) errors.push({ field: 'email', message: 'email must be a valid address' });
    else out.email = v;
  }
  if (has('phone') || !partial) {
    const v = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!PHONE.test(v)) errors.push({ field: 'phone', message: 'phone must be 8-20 characters: digits, spaces, dashes, optional leading +' });
    else out.phone = v;
  }
  if (partial && Object.keys(out).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields supplied' });
  }
  if (errors.length) fail(errors);
  return out;
}

/** Validate doctor input. consultation_fee is a number >= 0 with at most 2 decimals. */
function validateDoctor(body, { partial = false } = {}) {
  requireObject(body);
  const errors = [];
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('full_name') || !partial) {
    const v = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (v.length < 2 || v.length > 100) errors.push({ field: 'full_name', message: 'full_name must be 2-100 characters' });
    else out.full_name = v;
  }
  if (has('specialty') || !partial) {
    const v = typeof body.specialty === 'string' ? body.specialty.trim() : '';
    if (v.length < 2 || v.length > 80) errors.push({ field: 'specialty', message: 'specialty must be 2-80 characters' });
    else out.specialty = v;
  }
  if (has('consultation_fee') || !partial) {
    const f = body.consultation_fee;
    const ok = typeof f === 'number' && Number.isFinite(f) && f >= 0 && f <= 99999999.99
      && Math.round(f * 100) === f * 100;
    if (!ok) errors.push({ field: 'consultation_fee', message: 'consultation_fee must be a number >= 0 with at most 2 decimals' });
    else out.consultation_fee = f;
  }
  if (has('room') || !partial) {
    const v = typeof body.room === 'string' ? body.room.trim().toUpperCase() : '';
    if (!ROOM.test(v)) errors.push({ field: 'room', message: 'room must be 1-10 letters, digits or dashes' });
    else out.room = v;
  }
  if (partial && Object.keys(out).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields supplied' });
  }
  if (errors.length) fail(errors);
  return out;
}

/** Validate the booking request body (slot rules are checked separately). */
function validateBookingBody(body) {
  requireObject(body);
  const errors = [];
  const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
  if (!isPositiveInt(body.patient_id)) errors.push({ field: 'patient_id', message: 'patient_id must be a positive integer' });
  if (!isPositiveInt(body.doctor_id)) errors.push({ field: 'doctor_id', message: 'doctor_id must be a positive integer' });
  if (body.waitlist !== undefined && typeof body.waitlist !== 'boolean') {
    errors.push({ field: 'waitlist', message: 'waitlist must be true or false' });
  }
  if (errors.length) fail(errors);
  return { patientId: body.patient_id, doctorId: body.doctor_id, waitlist: body.waitlist === true };
}

module.exports = { parseId, validatePatient, validateDoctor, validateBookingBody };
