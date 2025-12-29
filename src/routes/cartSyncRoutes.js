const express = require('express');
const router = express.Router();
const cartSyncController = require('../controllers/cartSyncController');
const { authenticate } = require('../middlewares/authMiddleware');


router.post('/cart/sync', authenticate, cartSyncController.syncCartProducts);

router.post('/wishlist/sync', authenticate, cartSyncController.syncWishlistProducts);

module.exports = router;
