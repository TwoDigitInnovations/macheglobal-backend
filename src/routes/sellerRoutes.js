const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware'); // Assuming you have a role middleware
const {
  createSellerStore,
  getSellerStore,
  updateSellerStore,
  deleteSellerStore,
  getAllSellerStores,
  updateStoreStatus,
  getActiveSellers
} = require('../controllers/sellerController');

// Configure multer to use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images and pdfs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image and PDF files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Max 10 files
  },
  fileFilter: fileFilter
});

// Validation middleware
const validateStore = [
  body('storeName').trim().notEmpty().withMessage('Store name is required'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('pincode').trim().notEmpty().withMessage('Pincode is required')
];

// Public routes
router.get('/active', getActiveSellers);

// Apply authentication middleware to all other routes
router.use(authenticate);

// Protected routes

router.route('/')
  .post(
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'documents', maxCount: 10 }
    ]),
    validateStore,
    createSellerStore
  )
  .get(authorize('Admin','User'), getAllSellerStores);

router.route('/:id')
  .get(getSellerStore)
  .put(
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'documents', maxCount: 10 }
    ]),
    updateSellerStore
  )
  .delete(authorize('admin'), deleteSellerStore);

router.route('/:id/status')
  .put(authorize('admin'), updateStoreStatus);

module.exports = router;
