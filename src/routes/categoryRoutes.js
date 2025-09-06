const express = require('express');
const Category = require('@controllers/Catgeory');
const router = express.Router();

router.post('/createCategory', Category.createCategory);
router.get('/getCategories', Category.getCategories);
router.delete('/deleteCategory', Category.deleteCategory);
router.post('/addSubcategory', Category.addSubcategory);
router.get('/getSubcategories', Category.getSubcategories);
router.delete('/deleteSubcategory', Category.deleteSubcategory);
router.post('/updateCategory', Category.updateCategory);
router.post('/updateSubcategory', Category.updateSubcategory);

module.exports = router;
