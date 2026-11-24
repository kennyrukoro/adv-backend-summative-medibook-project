'use strict';
const { validatePatient, validateDoctor, validateBookingBody, parseId } = require('../../src/utils/validators');

describe('input validators', () => {
  test('patient: valid body is normalised (trimmed, lower-case email)', () => {
    expect(validatePatient({ full_name: ' Ama Mensah ', email: 'Ama@Mail.com', phone: '0244-111-222' }))
      .toEqual({ full_name: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' });
  });

  test('patient: missing or bad fields produce a 400 with field details', () => {
    try {
      validatePatient({ full_name: 'A', email: 'nope', phone: '12' });
      throw new Error('should not reach');
    } catch (e) {
      expect(e.status).toBe(400);
      expect(e.details.map((d) => d.field).sort()).toEqual(['email', 'full_name', 'phone']);
    }
  });

  test('doctor: fee must be non-negative with at most two decimals', () => {
    expect(validateDoctor({ full_name: 'Dr. X', specialty: 'Eye', consultation_fee: 99.99, room: 'r-1' }).room).toBe('R-1');
    expect(() => validateDoctor({ full_name: 'Dr. X', specialty: 'Eye', consultation_fee: -5, room: 'R1' })).toThrow();
    expect(() => validateDoctor({ full_name: 'Dr. X', specialty: 'Eye', consultation_fee: 10.555, room: 'R1' })).toThrow();
  });

  test('booking body: ids must be positive integers', () => {
    try { validateBookingBody({ patient_id: '1', doctor_id: 2 }); throw new Error('no throw'); }
    catch (e) { expect(e.status).toBe(400); expect(e.details[0].field).toBe('patient_id'); }
    expect(validateBookingBody({ patient_id: 1, doctor_id: 2 })).toEqual({ patientId: 1, doctorId: 2, waitlist: false });
  });

  test('route ids reject zero, negatives and text', () => {
    expect(parseId('7')).toBe(7);
    expect(() => parseId('0')).toThrow();
    expect(() => parseId('-3')).toThrow();
    expect(() => parseId('abc')).toThrow();
  });
});
