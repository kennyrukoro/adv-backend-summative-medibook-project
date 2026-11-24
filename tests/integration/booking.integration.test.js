'use strict';
// Requires running MySQL (schema + seed loaded) and Redis. Run with: npm run test:integration
const http = require('http');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/models/db');
const { getRedis } = require('../../src/queue/redisClient');

let server;
let base;

beforeAll(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  getRedis().disconnect();
});

async function post(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

// Use a date far in the future so the test does not collide with seed or manual data
const DAY = '2031-05-06';

describe('booking integrity', () => {
  test('20 simultaneous requests for one slot yield exactly one 201, the rest 409', async () => {
    const slot = `${DAY} 10:00`;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => post('/appointments', { patient_id: 1 + (i % 4), doctor_id: 2, slot_start: slot }))
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);
  });

  test('the daily cap of 12 holds under concurrent requests', async () => {
    const day = '2031-05-07';
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];
    const results = await Promise.all(times.map((t, i) => post('/appointments', { patient_id: 1 + (i % 4), doctor_id: 3, slot_start: `${day} ${t}` })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const extra = await post('/appointments', { patient_id: 1, doctor_id: 3, slot_start: `${day} 15:00` });
    expect(extra.status).toBe(409);
    expect(extra.body.error.code).toBe('DAILY_CAP_REACHED');
  });

  test('cancellation returns the refund and frees the slot for rebooking', async () => {
    const slot = `${DAY} 12:00`;
    const booked = await post('/appointments', { patient_id: 1, doctor_id: 1, slot_start: slot });
    expect(booked.status).toBe(201);
    const cancelled = await post(`/appointments/${booked.body.data.appointment_id}/cancel`, {});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.refund).toEqual({ percent: 100, amount: 150 });
    const rebooked = await post('/appointments', { patient_id: 2, doctor_id: 1, slot_start: slot });
    expect(rebooked.status).toBe(201);
  });
});
