const mongoose = require('mongoose');

const response = require('./../../responses');
const FlashSale = require('@models/sale');

module.exports = {
  createFlashSale: async (req, res) => {
    try {
      const payload = req?.body || {};

      if (payload.products && payload.products.length > 0) {
        payload.product = payload.products[0];
        delete payload.products;
      }

      const existingSale = await FlashSale.findOne({
        product: payload.product,
        status: 'ACTIVE',
        endDateTime: { $gt: new Date() }
      });

      if (existingSale) {
        return response.error(res, {
          message:
            'This product already has an active sale. Please end the existing sale first.'
        });
      }

      let sale = new FlashSale(payload);
      const flashSale = await sale.save();

      return response.ok(res, flashSale, {
        message: 'Flash Sale added successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getFlashSale: async (req, res) => {
    try {
      const { SellerId } = req.query;
      const flashSales = await FlashSale.find({ SellerId: SellerId })
        .populate({
          path: "product",
          select: "name categoryName varients sellerId",
        })
        .sort({ createdAt: -1 });
      return response.ok(res, flashSales);
    } catch (error) {
      return response.error(res, error);
    }
  },


  getActiveFlashSales: async (req, res) => {
    try {
      const now = new Date();
      const activeFlashSales = await FlashSale.find({
        status: 'ACTIVE',
        startDateTime: { $lte: now },
        endDateTime: { $gt: now }
      }).populate('product');

      return response.ok(res, activeFlashSales);
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateFlashSale: async (req, res) => {
    try {
      const { id } = req.params;
      const payload = req.body;

      if (payload.product) {
        const existingSale = await FlashSale.findOne({
          product: payload.product,
          status: 'ACTIVE',
          _id: { $ne: id },
          endDateTime: { $gt: new Date() }
        });

        if (existingSale) {
          return response.error(res, {
            message: 'This product already has an active sale.'
          });
        }
      }

      const updatedFlashSale = await FlashSale.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true
      }).populate('product', 'name categoryName price_slot images');

      if (!updatedFlashSale) {
        return response.error(res, {
          message: 'Flash sale not found'
        });
      }

      return response.ok(res, updatedFlashSale, {
        message: 'Flash Sale updated successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteFlashSale: async (req, res) => {
    try {
      const { id } = req.params;
      const { SellerId } = req.query;

      if (!SellerId) {
        return response.error(res, { message: "SellerId is required" });
      }

      const deletedFlashSale = await FlashSale.findOneAndDelete({
        _id: id,
        SellerId
      });

      if (!deletedFlashSale) {
        return response.error(res, {
          message: 'Flash sale not found for this seller'
        });
      }

      return response.ok(res, {
        message: 'Flash Sale deleted successfully'
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteAllFlashSales: async (req, res) => {
    try {
      const { SellerId } = req.query;

      if (!SellerId) {
        return response.error(res, { message: "SellerId is required" });
      }

      const result = await FlashSale.deleteMany({ SellerId });

      if (result.deletedCount === 0) {
        return response.error(res, {
          message: "No flash sales found to delete for this seller."
        });
      }

      return response.ok(res, {
        message: `${result.deletedCount} flash sales deleted successfully`
      });
    } catch (error) {
      return response.error(res, error);
    }
  },


  toggleFlashSaleStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { SellerId } = req.query; // ✅ query se sellerId le rahe hain

      if (!SellerId) {
        return response.error(res, { message: "SellerId is required" });
      }

      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return response.error(res, {
          message: "Invalid status. Use 'ACTIVE' or 'INACTIVE'"
        });
      }

      const updatedFlashSale = await FlashSale.findOneAndUpdate(
        { _id: id, SellerId },
        { status },
        { new: true, runValidators: true }
      ).populate('product', 'name categoryName price_slot images');

      if (!updatedFlashSale) {
        return response.error(res, {
          message: ' sale not found for this seller'
        });
      }

      return response.ok(res, updatedFlashSale, {
        message: ` Sale ${status.toLowerCase()} successfully`
      });
    } catch (error) {
      return response.error(res, error);
    }
  },


  endExpiredFlashSales: async () => {
    try {
      const now = new Date();
      const result = await FlashSale.updateMany(
        {
          endDateTime: { $lt: now },
          status: 'ACTIVE'
        },
        {
          status: 'EXPIRED'
        }
      );
      console.log(`${result.modifiedCount} flash sales marked as expired.`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error updating expired flash sales:', error);
      return 0;
    }
  },

  getFlashSaleByProduct: async (req, res) => {
    try {
      const { productId } = req.params;
      const now = new Date();

      const flashSale = await FlashSale.findOne({
        product: productId,
        status: 'ACTIVE',
        startDateTime: { $lte: now },
        endDateTime: { $gt: now }
      }).populate('product', 'name categoryName price_slot varients');

      if (!flashSale) {
        return response.error(res, {
          message: 'No active flash sale found for this product'
        });
      }

      return response.ok(res, flashSale);
    } catch (error) {
      return response.error(res, error);
    }
  }
};
