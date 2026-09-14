const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const paymentCtrl = require('../controllers/paymentController');

router.post('/', ctrl.createOrder);
router.get('/', ctrl.getOrders);
router.get('/:id', ctrl.getOrder);
router.post('/:id/cancel', ctrl.cancelOrder);
router.post('/:id/pay', paymentCtrl.processPayment);

module.exports = router;
