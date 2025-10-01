'use strict';

const Category = require('@models/Category');
const response = require('../../responses');
const { uploadToCloudinary, deleteFromCloudinary } = require('../helper/cloudinary');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
}).single('image');

// Middleware to handle file uploads
const handleFileUpload = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'Error uploading file' 
      });
    }
    // Everything went fine
    next();
  });
};

module.exports = {
  handleFileUpload, // Export the middleware
  
  createCategory: async (req, res) => {
    try {
      console.log('Request body:', req.body); // Debug log
      console.log('Request file:', req.file); // Debug log
      
      const { name, Attribute, notAvailableSubCategory, currentImage } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          success: false,
          message: 'Category name is required' 
        });
      }

      const slug = name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      // Handle image upload if file exists
      let imageData = {};
      if (req.file) {
        try {
          console.log('Uploading file to Cloudinary...');
          console.log('File details:', {
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype
          });
          
          const result = await uploadToCloudinary(req.file);
          console.log('Cloudinary upload result:', result);
          
          imageData = {
            public_id: result.public_id,
            url: result.url
          };
        } catch (uploadError) {
          console.error('Error uploading to Cloudinary:', uploadError);
          // Clean up the temporary file if upload fails
          if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
              console.error('Error deleting temp file:', unlinkError);
            }
          }
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to Cloudinary',
            error: uploadError.message
          });
        }
      } else if (currentImage && currentImage !== 'null' && currentImage !== 'undefined') {
        // If no new image but currentImage exists, use the current image
        try {
          imageData = typeof currentImage === 'string' ? JSON.parse(currentImage) : currentImage;
        } catch (e) {
          console.warn('Error parsing currentImage:', e);
          // If currentImage is not a valid JSON string, treat it as a URL
          if (typeof currentImage === 'string' && (currentImage.startsWith('http') || currentImage.startsWith('/'))) {
            imageData = { url: currentImage };
          }
        }
      }

      const categoryData = {
        name,
        slug,
        notAvailableSubCategory: notAvailableSubCategory === 'true' || notAvailableSubCategory === true,
      };

      // Add attributes if they exist
      if (Attribute) {
        categoryData.Attribute = typeof Attribute === 'string' ? JSON.parse(Attribute) : Attribute;
      } else {
        categoryData.Attribute = [];
      }

      // Only add image if we have image data
      if (Object.keys(imageData).length > 0) {
        categoryData.image = imageData;
      }

      console.log('Creating category with data:', categoryData);
      const category = new Category(categoryData);
      const savedCategory = await category.save();

      return response.ok(res, savedCategory, {
        message: 'Category added successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getCategories: async (req, res) => {
    try {
      const categories = await Category.find({});
      return response.ok(res, categories);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const { id } = req.body;

      const deletedCategory = await Category.findByIdAndDelete(id);
      if (!deletedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Delete category image from Cloudinary if exists
      if (deletedCategory.image && deletedCategory.image.public_id) {
        await deleteFromCloudinary(deletedCategory.image.public_id);
      }

      // Delete all subcategory images
      const subImagesToDelete = deletedCategory.Subcategory
        .filter(sub => sub.image && sub.image.public_id)
        .map(sub => sub.image.public_id);
      
      if (subImagesToDelete.length > 0) {
        await Promise.all(subImagesToDelete.map(publicId => 
          deleteFromCloudinary(publicId)
        ));
      }

      return response.ok(res, null, {
        message: 'Category deleted successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  addSubcategory: async (req, res) => {
    try {
      const { name, categoryId, Attribute } = req.body;

      if (!name) {
        return res
          .status(400)
          .json({ message: 'Subcategory name is required' });
      }

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Handle image upload for subcategory
      let imageData = {};
      if (req.file) {
        const result = await uploadToCloudinary(req.file, 'macheglobal/subcategories');
        imageData = {
          public_id: result.public_id,
          url: result.url
        };
      }

      const newSubcategory = {
        name,
        Attribute,
        ...(Object.keys(imageData).length > 0 && { image: imageData })
      };

      category.Subcategory.push(newSubcategory);
      category.Attribute = Attribute;
      await category.save();

      return res.status(201).json({
        message: 'Subcategory added successfully',
        subcategories: category.Subcategory
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getSubcategories: async (req, res) => {
    try {
      const { categoryId } = req.params;

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      return res.status(200).json(category.Subcategory);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteSubcategory: async (req, res) => {
    try {
      const { categoryId, subId } = req.body;

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      const subcategoryIndex = category.Subcategory.findIndex(
        (sub) => sub._id.toString() === subId
      );
      if (subcategoryIndex === -1) {
        return res.status(404).json({ message: 'Subcategory not found' });
      }

      // Delete subcategory image from Cloudinary if exists
      const subcategory = category.Subcategory[subcategoryIndex];
      if (subcategory.image && subcategory.image.public_id) {
        await deleteFromCloudinary(subcategory.image.public_id);
      }

      category.Subcategory.splice(subcategoryIndex, 1);
      await category.save();

      return res
        .status(200)
        .json({ message: 'Subcategory deleted successfully' });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { name, _id, Attribute, notAvailableSubCategory, currentImage } = req.body;
      const slug = name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      // Get current category to check for existing image
      const currentCategory = await Category.findById(_id);
      if (!currentCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }

      let imageData = currentCategory.image || {};
      
      // Handle new image upload
      if (req.file) {
        // Delete old image if exists
        if (currentCategory.image && currentCategory.image.public_id) {
          await deleteFromCloudinary(currentCategory.image.public_id);
        }
        
        // Upload new image
        const result = await uploadToCloudinary(req.file, 'macheglobal/categories');
        imageData = {
          public_id: result.public_id,
          url: result.url
        };
      } else if (currentImage === 'null' || currentImage === '') {
        // If image was removed by the user
        if (currentCategory.image && currentCategory.image.public_id) {
          await deleteFromCloudinary(currentCategory.image.public_id);
        }
        imageData = {};
      }

      const updateData = { 
        name, 
        slug, 
        Attribute, 
        notAvailableSubCategory,
        image: Object.keys(imageData).length > 0 ? imageData : undefined
      };

      const updatedCategory = await Category.findByIdAndUpdate(
        _id,
        updateData,
        { new: true }
      );

      return response.ok(res, updatedCategory, {
        message: 'Category updated successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  // New method: updateSubcategory - update a subcategory name within a category
  updateSubcategory: async (req, res) => {
    try {
      const { name, categoryId, Attribute, currentImage } = req.body;

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      const subcategory = category.Subcategory.id(req.body._id);
      if (!subcategory) {
        return res.status(404).json({ message: 'Subcategory not found' });
      }

      // Handle image upload for subcategory
      if (req.file) {
        // Delete old image if exists
        if (subcategory.image && subcategory.image.public_id) {
          await deleteFromCloudinary(subcategory.image.public_id);
        }
        
        // Upload new image
        const result = await uploadToCloudinary(req.file, 'macheglobal/subcategories');
        subcategory.image = {
          public_id: result.public_id,
          url: result.url
        };
      } else if (currentImage === 'null' || currentImage === '') {
        // If image was removed by the user
        if (subcategory.image && subcategory.image.public_id) {
          await deleteFromCloudinary(subcategory.image.public_id);
          subcategory.image = undefined;
        }
      }

      subcategory.name = name;
      subcategory.Attribute = Attribute;
      
      await category.save();

      return response.ok(res, subcategory, {
        message: 'Subcategory updated successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  }
};
