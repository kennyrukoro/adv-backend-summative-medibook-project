-- ============================================================================
-- MediBook clinic appointment system - MySQL 8.0+ DDL
-- Run on a fresh server:   mysql -u root -p < database/schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS medibook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medibook;

-- ----------------------------------------------------------------------------
-- 1. patients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  patient_id  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_id),
  UNIQUE KEY uq_patients_email (email),
  CONSTRAINT chk_patients_name  CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT chk_patients_email CHECK (email LIKE '_%@_%._%')
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. doctors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  full_name         VARCHAR(100)   NOT NULL,
  specialty         VARCHAR(80)    NOT NULL,
  consultation_fee  DECIMAL(10,2)  NOT NULL,
  room              VARCHAR(10)    NOT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (doctor_id),
  CONSTRAINT chk_doctors_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT chk_doctors_fee  CHECK (consultation_fee >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. appointments (links patient and doctor; holds the cancellation/refund record)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  patient_id      INT UNSIGNED   NOT NULL,
  doctor_id       INT UNSIGNED   NOT NULL,
  slot_start      DATETIME       NOT NULL,                       -- clinic local time
  status          ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  amount_paid     DECIMAL(10,2)  NOT NULL,                       -- snapshot of fee at booking
  booked_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- cancellation / refund record (filled only when status = 'cancelled')
  cancelled_at    DATETIME       NULL,
  refund_percent  TINYINT UNSIGNED NULL,
  refund_amount   DECIMAL(10,2)  NULL,
  -- a slot is "held" only while the appointment is booked; NULL releases it
  active_slot     DATETIME GENERATED ALWAYS AS
                  (CASE WHEN status = 'booked' THEN slot_start END) STORED,

  PRIMARY KEY (appointment_id),

  -- a doctor can never hold two active appointments at the same date/time
  -- (cancelled rows have active_slot NULL, so the slot becomes bookable again)
  UNIQUE KEY uq_doctor_active_slot (doctor_id, active_slot),
  KEY idx_appointments_doctor_slot (doctor_id, slot_start),
  KEY idx_appointments_patient (patient_id),

  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id)
    REFERENCES patients (patient_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_doctor  FOREIGN KEY (doctor_id)
    REFERENCES doctors (doctor_id)   ON DELETE RESTRICT ON UPDATE CASCADE,

  -- 30-minute slot boundaries: :00 or :30, no seconds
  CONSTRAINT chk_appointments_slot_boundary CHECK (
    SECOND(slot_start) = 0 AND MINUTE(slot_start) IN (0, 30)
  ),
  -- working hours 09:00-17:00; a 30-minute slot must end by 17:00, so last start is 16:30
  CONSTRAINT chk_appointments_working_hours CHECK (
    TIME(slot_start) BETWEEN '09:00:00' AND '16:30:00'
  ),
  CONSTRAINT chk_appointments_amount CHECK (amount_paid >= 0),
  -- booked rows carry no cancellation data; cancelled rows must carry a full refund record
  CONSTRAINT chk_appointments_cancellation CHECK (
    (status = 'booked'
       AND cancelled_at IS NULL AND refund_percent IS NULL AND refund_amount IS NULL)
    OR
    (status = 'cancelled'
       AND cancelled_at IS NOT NULL
       AND refund_percent IN (0, 50, 100)
       AND refund_amount IS NOT NULL
       AND refund_amount >= 0
       AND refund_amount <= amount_paid)
  )
) ENGINE=InnoDB;
