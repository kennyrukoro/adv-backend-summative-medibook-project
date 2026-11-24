'use strict';
const { query } = require('./db');

/** Revenue collected = amount paid minus refunds, across all of a doctor's appointments. */
async function doctorRevenue(doctorId) {
  const rows = await query(
    `SELECT COALESCE(SUM(amount_paid - COALESCE(refund_amount, 0)), 0) AS revenue
       FROM appointments
      WHERE doctor_id = ?`,
    [doctorId]
  );
  return Number(rows[0].revenue);
}

async function doctorUpcomingCount(doctorId, nowLocal) {
  const rows = await query(
    `SELECT COUNT(*) AS n
       FROM appointments
      WHERE doctor_id = ? AND status = 'booked' AND slot_start >= ?`,
    [doctorId, nowLocal]
  );
  return Number(rows[0].n);
}

/**
 * Booked appointments per day for the 7 days starting at `fromDate`.
 * A recursive CTE generates every day, so days with no bookings still return a row (0).
 */
async function doctorNext7Days(doctorId, fromDate, cap) {
  return query(
    `WITH RECURSIVE next_days AS (
         SELECT CAST(? AS DATE) AS day_date
         UNION ALL
         SELECT day_date + INTERVAL 1 DAY
           FROM next_days
          WHERE day_date < CAST(? AS DATE) + INTERVAL 6 DAY
     )
     SELECT nd.day_date AS day,
            COUNT(a.appointment_id) AS booked,
            ROUND(COUNT(a.appointment_id) * 100 / ?, 1) AS utilization_pct
       FROM next_days nd
       LEFT JOIN appointments a
              ON a.doctor_id = ?
             AND a.status = 'booked'
             AND DATE(a.slot_start) = nd.day_date
      GROUP BY nd.day_date
      ORDER BY nd.day_date`,
    [fromDate, fromDate, cap, doctorId]
  );
}

/** Every doctor, including those with zero appointments (LEFT JOIN). */
async function doctorsReport() {
  return query(
    `SELECT d.doctor_id, d.full_name, d.specialty,
            COUNT(a.appointment_id) AS total_appointments,
            SUM(a.status = 'booked') AS active_appointments,
            SUM(a.status = 'cancelled') AS cancelled_appointments,
            ROUND(COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0), 2) AS revenue_collected
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      GROUP BY d.doctor_id, d.full_name, d.specialty
      ORDER BY d.doctor_id`
  );
}

/**
 * (doctor, date) pairs where booked slots are more than `thresholdPct` percent of the cap.
 * Integer arithmetic avoids float error: count * 100 > threshold * cap.
 */
async function busyDays(thresholdPct, cap) {
  return query(
    `SELECT a.doctor_id, d.full_name AS doctor_name,
            DATE(a.slot_start) AS day,
            COUNT(*) AS booked,
            ROUND(COUNT(*) * 100 / ?, 1) AS utilization_pct
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.status = 'booked'
      GROUP BY a.doctor_id, d.full_name, DATE(a.slot_start)
     HAVING COUNT(*) * 100 > ? * ?
      ORDER BY day, a.doctor_id`,
    [cap, thresholdPct, cap]
  );
}

module.exports = { doctorRevenue, doctorUpcomingCount, doctorNext7Days, doctorsReport, busyDays };
