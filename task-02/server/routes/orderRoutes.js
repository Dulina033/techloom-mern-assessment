const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const paymentCtrl = require('../controllers/paymentController');

router.post('/checkout', ctrl.checkout);
router.get('/history/:userId', ctrl.getOrderHistory);
router.get('/:id', ctrl.getOrder);
router.post('/:id/cancel', ctrl.cancelOrder);
router.post('/:id/refund', ctrl.refundOrder);
router.post('/:id/pay', paymentCtrl.processPayment);

module.exports = router;
