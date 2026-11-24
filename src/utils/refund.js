'use strict';

/**
 * Refund policy (documented in README):
 *   notice  > 48 hours           -> 100 %
 *   24 <= notice <= 48 hours     ->  50 %   (both boundaries are 50 %)
 *   notice  < 24 hours           ->   0 %   (includes late or no-show cancellations)
 */
function refundPercentForNotice(hoursNotice) {
  if (hoursNotice > 48) return 100;
  if (hoursNotice >= 24) return 50;
  return 0;
}

/** Refund amount in money units, rounded to cents (half up). */
function calculateRefund(amountPaid, hoursNotice) {
  const percent = refundPercentForNotice(hoursNotice);
  const paidCents = Math.round(Number(amountPaid) * 100);
  const refundCents = Math.round((paidCents * percent) / 100);
  return { percent, amount: refundCents / 100 };
}

module.exports = { refundPercentForNotice, calculateRefund };
