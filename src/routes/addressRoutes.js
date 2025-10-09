const express = require('express');
const router = express.Router();
const {
    getAddresses,
    getAddress,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} = require('../controllers/addressController');
const { authenticate } = require('../middlewares/authMiddleware');


router.use(authenticate);


router.route('/')
    .get(getAddresses)
    .post(createAddress);

router.route('/:id')
    .get(getAddress)
    .put(updateAddress)
    .delete(deleteAddress);

router.put('/:id/set-default', setDefaultAddress);

module.exports = router;
