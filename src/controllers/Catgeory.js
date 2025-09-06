'use strict';

const Category = require('@models/Category');
const mongoose = require('mongoose');
const response = require('../../responses');

module.exports = {
  createCategory: async (req, res) => {
    try {
      const { name, Attribute, notAvailableSubCategory } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      const slug = name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      const category = new Category({
        name,
        slug,
        Attribute,
        notAvailableSubCategory
      });
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

      // if (!mongoose.Types.ObjectId.isValid(id)) {
      //   return res.status(400).json({ message: 'Invalid category ID' });
      // }

      const deletedCategory = await Category.findByIdAndDelete(id);
      if (!deletedCategory) {
        return res.status(404).json({ message: 'Category not found' });
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

      // if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      //   return res.status(400).json({ message: 'Invalid category ID' });
      // }
      if (!name) {
        return res
          .status(400)
          .json({ message: 'Subcategory name is required' });
      }

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      category.Subcategory.push({ name });
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

      // if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      //   return res.status(400).json({ message: 'Invalid category ID' });
      // }

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

      // if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      //   return res.status(400).json({ message: 'Invalid category ID' });
      // }

      // if (!mongoose.Types.ObjectId.isValid(subId)) {
      //   return res.status(400).json({ message: 'Invalid subcategory ID' });
      // }

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
      const { name, _id, Attribute, notAvailableSubCategory } = req.body;
      const slug = name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      const updatedCategory = await Category.findByIdAndUpdate(
        _id,
        { name, slug, Attribute, notAvailableSubCategory },
        { new: true }
      );

      if (!updatedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }

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
      const { name, categoryId, Attribute } = req.body;

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      const subcategory = category.Subcategory.id(req.body._id);
      if (!subcategory) {
        return res.status(404).json({ message: 'Subcategory not found' });
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
