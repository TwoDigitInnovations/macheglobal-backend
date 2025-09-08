const express = require('express');
const flashSaleController = require('@controllers/sale');
const { authenticate } = require('@middlewares/authMiddleware');
const router = express.Router();


router.post('/createSale', authenticate, flashSaleController.createFlashSale);
router.get('/getFlashSale', flashSaleController.getFlashSale);
router.get('/getActiveFlashSales', flashSaleController.getActiveFlashSales);
router.get(
    '/getFlashSaleByProduct/:productId',
    flashSaleController.getFlashSaleByProduct
);
router.put(
    '/updateFlashSale/:id',
    authenticate,
    flashSaleController.updateFlashSale
);
router.put(
    '/toggleFlashSaleStatus/:id',
    authenticate,
    flashSaleController.toggleFlashSaleStatus
);
router.delete(
    '/deleteFlashSale/:id',
    authenticate,
    flashSaleController.deleteFlashSale
);
router.delete(
    '/deleteAllFlashSales',
    authenticate,
    flashSaleController.deleteAllFlashSales
);
router.delete(
    '/deleteSale',
    authenticate,
    flashSaleController.deleteAllFlashSales
);
router.post(
    '/deleteFlashSaleProduct',
    authenticate,
    flashSaleController.deleteFlashSale
);



module.exports = router;
