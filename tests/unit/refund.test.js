'use strict';
const { refundPercentForNotice, calculateRefund } = require('../../src/utils/refund');

describe('refund policy tiers', () => {
  test('more than 48 hours notice gives 100%', () => {
    expect(refundPercentForNotice(72)).toBe(100);
    expect(refundPercentForNotice(48.01)).toBe(100);
  });

  test('exactly 48 hours is in the 50% tier (48 is not "more than 48")', () => {
    expect(refundPercentForNotice(48)).toBe(50);
  });

  test('between 24 and 48 hours gives 50%', () => {
    expect(refundPercentForNotice(36)).toBe(50);
  });

  test('exactly 24 hours is in the 50% tier (inclusive lower bound)', () => {
    expect(refundPercentForNotice(24)).toBe(50);
  });

  test('just under 24 hours gives 0%', () => {
    expect(refundPercentForNotice(23.99)).toBe(0);
    expect(refundPercentForNotice(2)).toBe(0);
  });

  test('cancelling after the slot has started (negative notice) gives 0%', () => {
    expect(refundPercentForNotice(-1)).toBe(0);
  });

  test('calculateRefund returns the amount rounded to cents', () => {
    expect(calculateRefund(150, 72)).toEqual({ percent: 100, amount: 150 });
    expect(calculateRefund(150, 30)).toEqual({ percent: 50, amount: 75 });
    expect(calculateRefund(150, 1)).toEqual({ percent: 0, amount: 0 });
    expect(calculateRefund(0.05, 30)).toEqual({ percent: 50, amount: 0.03 });
  });
});
