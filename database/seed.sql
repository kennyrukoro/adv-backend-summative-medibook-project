-- ============================================================================
-- MediBook sample data (development only - clears existing rows first)
-- Run AFTER schema.sql:   mysql -u root -p medibook < database/seed.sql
-- ============================================================================
USE medibook;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE appointments;
TRUNCATE TABLE doctors;
TRUNCATE TABLE patients;
SET FOREIGN_KEY_CHECKS = 1;

-- 4 patients (Ama, Kojo are from the original spreadsheet)
INSERT INTO patients (patient_id, full_name, email, phone, created_at) VALUES
  (1, 'Ama Mensah',   'ama@mail.com',            '0244-111-222', '2026-07-01 08:00:00'),
  (2, 'Kojo Owusu',   'kojo@mail.com',           '0555-333-444', '2026-07-02 08:00:00'),
  (3, 'Esi Appiah',   'esi.appiah@mail.com',     '0209-555-678', '2026-08-20 10:15:00'),
  (4, 'Yaw Darko',    'yaw.darko@mail.com',      '0271-889-900', '2026-11-15 09:30:00');

-- 3 doctors. Dr. Asante has NO appointments (tests the "zero appointments" report row)
INSERT INTO doctors (doctor_id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng', 'Dermatology',  150.00, 'R-12'),
  (2, 'Dr. Adjei',   'Paediatrics',  100.00, 'R-03'),
  (3, 'Dr. Asante',  'Cardiology',   200.00, 'R-07');

-- Appointments
-- AP-001..AP-003 are the rows from the original spreadsheet (booked_on -> booked_at)
INSERT INTO appointments
  (appointment_id, patient_id, doctor_id, slot_start, status, amount_paid, booked_at,
   cancelled_at, refund_percent, refund_amount)
VALUES
  -- AP-001 / AP-002 / AP-003 (history)
  (1, 1, 1, '2026-08-10 09:00:00', 'booked', 150.00, '2026-07-01 00:00:00', NULL, NULL, NULL),
  (2, 2, 1, '2026-08-10 09:30:00', 'booked', 120.00, '2026-07-02 00:00:00', NULL, NULL, NULL),
  (3, 1, 2, '2026-08-15 10:00:00', 'booked', 100.00, '2026-07-03 00:00:00', NULL, NULL, NULL),
  -- upcoming bookings
  (4, 3, 2, '2026-12-01 10:00:00', 'booked', 100.00, '2026-11-15 12:00:00', NULL, NULL, NULL),
  (5, 1, 1, '2026-12-02 11:00:00', 'booked', 150.00, '2026-11-16 12:00:00', NULL, NULL, NULL),
  -- cancellations (refund history): 48h notice exactly -> 50%; 9.5h notice -> 0%
  (6, 2, 1, '2026-12-03 09:00:00', 'cancelled', 150.00, '2026-11-18 08:00:00',
        '2026-12-01 09:00:00', 50, 75.00),
  (7, 3, 2, '2026-12-06 09:30:00', 'cancelled', 100.00, '2026-11-19 08:00:00',
        '2026-12-06 00:00:00', 0, 0.00);

-- Doctor-day at the 12-slot cap: Dr. Boateng, 2026-12-07, 09:00 to 14:30 (12 slots, all booked)
INSERT INTO appointments
  (appointment_id, patient_id, doctor_id, slot_start, status, amount_paid, booked_at)
VALUES
  (8,  1, 1, '2026-12-07 09:00:00', 'booked', 150.00, '2026-11-20 09:00:00'),
  (9,  2, 1, '2026-12-07 09:30:00', 'booked', 150.00, '2026-11-20 09:01:00'),
  (10, 3, 1, '2026-12-07 10:00:00', 'booked', 150.00, '2026-11-20 09:02:00'),
  (11, 4, 1, '2026-12-07 10:30:00', 'booked', 150.00, '2026-11-20 09:03:00'),
  (12, 1, 1, '2026-12-07 11:00:00', 'booked', 150.00, '2026-11-20 09:04:00'),
  (13, 2, 1, '2026-12-07 11:30:00', 'booked', 150.00, '2026-11-20 09:05:00'),
  (14, 3, 1, '2026-12-07 12:00:00', 'booked', 150.00, '2026-11-20 09:06:00'),
  (15, 4, 1, '2026-12-07 12:30:00', 'booked', 150.00, '2026-11-20 09:07:00'),
  (16, 1, 1, '2026-12-07 13:00:00', 'booked', 150.00, '2026-11-20 09:08:00'),
  (17, 2, 1, '2026-12-07 13:30:00', 'booked', 150.00, '2026-11-20 09:09:00'),
  (18, 3, 1, '2026-12-07 14:00:00', 'booked', 150.00, '2026-11-20 09:10:00'),
  (19, 4, 1, '2026-12-07 14:30:00', 'booked', 150.00, '2026-11-20 09:11:00');
