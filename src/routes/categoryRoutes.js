const express = require('express');
const Category = require('@controllers/Catgeory');
const router = express.Router();

// Apply file upload middleware to routes that handle file uploads
router.post('/createCategory', Category.handleFileUpload, Category.createCategory);
router.get('/getCategories', Category.getCategories);
router.delete('/deleteCategory', Category.deleteCategory);
router.post('/addSubcategory', Category.handleFileUpload, Category.addSubcategory);
router.get('/getSubcategories', Category.getSubcategories);
router.delete('/deleteSubcategory', Category.deleteSubcategory);
router.post('/updateCategory', Category.handleFileUpload, Category.updateCategory);
router.post('/updateSubcategory', Category.handleFileUpload, Category.updateSubcategory);

module.exports = router;
