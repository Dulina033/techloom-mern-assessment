// Central place enforcing which order-status transitions are legal.
// Anything not listed here is rejected -> keeps the lifecycle consistent.
const TRANSITIONS = {
  Pending: ['Reserved', 'Cancelled'],
  Reserved: ['Paid', 'Failed', 'Expired', 'Cancelled'],
  Paid: ['Cancelled'],
  Cancelled: [],
  Expired: [],
  Failed: [],
};

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

module.exports = { canTransition, TRANSITIONS };
