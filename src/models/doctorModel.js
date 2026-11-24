'use strict';
const { query } = require('./db');

const COLUMNS = ['full_name', 'specialty', 'consultation_fee', 'room'];

async function findAll() {
  return query(
    'SELECT doctor_id, full_name, specialty, consultation_fee, room, created_at FROM doctors ORDER BY doctor_id'
  );
}

async function findById(id, conn) {
  const rows = await query(
    'SELECT doctor_id, full_name, specialty, consultation_fee, room, created_at FROM doctors WHERE doctor_id = ?',
    [id], conn
  );
  return rows[0] || null;
}

/** Locking read: serialises all bookings for this doctor until the transaction ends. */
async function findByIdForUpdate(id, conn) {
  const rows = await query(
    'SELECT doctor_id, consultation_fee FROM doctors WHERE doctor_id = ? FOR UPDATE',
    [id], conn
  );
  return rows[0] || null;
}

async function create({ full_name, specialty, consultation_fee, room }) {
  const res = await query(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [full_name, specialty, consultation_fee, room]
  );
  return res.insertId;
}

async function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => COLUMNS.includes(k));
  if (keys.length === 0) return 0;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const res = await query(
    `UPDATE doctors SET ${setClause} WHERE doctor_id = ?`,
    [...keys.map((k) => fields[k]), id]
  );
  return res.affectedRows;
}

async function remove(id) {
  const res = await query('DELETE FROM doctors WHERE doctor_id = ?', [id]);
  return res.affectedRows;
}

module.exports = { findAll, findById, findByIdForUpdate, create, update, remove };
