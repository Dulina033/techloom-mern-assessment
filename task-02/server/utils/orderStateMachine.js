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
