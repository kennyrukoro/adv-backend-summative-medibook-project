'use strict';
const { query } = require('./db');

const COLUMNS = ['full_name', 'email', 'phone'];

async function findAll() {
  return query(
    'SELECT patient_id, full_name, email, phone, created_at FROM patients ORDER BY patient_id'
  );
}

async function findById(id, conn) {
  const rows = await query(
    'SELECT patient_id, full_name, email, phone, created_at FROM patients WHERE patient_id = ?',
    [id], conn
  );
  return rows[0] || null;
}

async function create({ full_name, email, phone }) {
  const res = await query(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [full_name, email, phone]
  );
  return res.insertId;
}

/** Partial update. Column names come from the fixed whitelist above; values are bound. */
async function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => COLUMNS.includes(k));
  if (keys.length === 0) return 0;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const res = await query(
    `UPDATE patients SET ${setClause} WHERE patient_id = ?`,
    [...keys.map((k) => fields[k]), id]
  );
  return res.affectedRows;
}

async function remove(id) {
  const res = await query('DELETE FROM patients WHERE patient_id = ?', [id]);
  return res.affectedRows;
}

module.exports = { findAll, findById, create, update, remove };
