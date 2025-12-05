const mongoose = require('mongoose');
const { DateTime } = require('luxon');

// Get models using mongoose.model() to avoid recompilation
const Product = require('../models/product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const Favourite = require('../models/Favorite');
const Review = require('../models/Review');

const response = require('../../responses');
const _ = require('lodash');
const { getReview } = require('../helper/user');
const mailNotification = require('../services/mailNotification');

const cleanAndUnique = (data) => {
  return _.uniq(
    data
      .map((item) => item.trim().toLowerCase()) // trim + lowercase
      .filter((item) => item !== '') // remove empty
  );
};

// const Order = require('../models/Order');
// const Product = require('../models/product');
const WithdrawalRequest = require('../models/withdrawReq');
const WalletTransaction = require('../models/WalletTransaction');

module.exports = {
  createProduct: async (req, res) => {
    try {
      const payload = req?.body || {};
      const generateSlug = (name) => {
        let slug = name
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[\s\W-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        slug = `${slug}-abc`;

        return slug;
      };
      payload.slug = generateSlug(payload.name || '');

      const existingProduct = await Product.findOne({
        name: payload.name,
        categoryName: payload.categoryName,
        subCategoryName: payload.subCategoryName
      });

      if (existingProduct) {
        return res.status(400).json({
          status: false,
          message:
            'Product with the same name in this category/subcategory already exists'
        });
      }

      const newProduct = new Product(payload);
      await newProduct.save();

      return response.ok(res, { message: 'Product added successfully' });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProduct: async (req, res) => {
    try {
      const payload = req?.body || {};
      let product = await Product.findByIdAndUpdate(payload?.id, payload, {
        new: true,
        upsert: true
      });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProduct: async (req, res) => {
    try {
      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      let skip = (page - 1) * limit;

      let cond = {};

      if (req.query.searchTerm) {
        cond.$or = [
          { name: { $regex: req.query.searchTerm, $options: 'i' } },
          {
            short_description: { $regex: req.query.searchTerm, $options: 'i' }
          }
        ];
      }

      if (req.query.SellerId) {
        cond.SellerId = req.query.SellerId;
      }

      let products = await Product.find(cond)
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      let totalProducts = await Product.countDocuments(cond);
      const totalPages = Math.ceil(totalProducts / limit);

      return res.status(200).json({
        status: true,
        data: products,
        pagination: {
          totalItems: totalProducts,
          totalPages,
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProductBySlug: async (req, res) => {
    try {
      const product = await Product.findOne({
        slug: req?.query?.slug
      }).populate('category');

      let reviews = await Review.find({ product: product._id }).populate(
        'posted_by',
        'name'
      );

      const favourite = req.query.user
        ? await Favourite.findOne({
            product: product._id,
            user: req.query.user
          })
        : null;

      const productObj = product.toObject();

      const d = {
        ...productObj,
        rating: await getReview(product._id),
        reviews: reviews,
        favourite: !!favourite
      };

      return response.ok(res, d);
    } catch (error) {
      return response.error(res, error);
    }
  },

getProductById: async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id })
      .populate('category Brand SellerId'); // Added SellerId to populate
     
    if (!product) {
      return response.error(res, 'Product not found');
    }
     
    return response.ok(res, product);
  } catch (error) {
    return response.error(res, error);
  }
},

  getProductBycategoryId: async (req, res) => {
    console.log(req.query);
    try {
      let cond = {};

      if (req.query.Category && req.query.Category !== 'All Category') {
        cond.categoryName = { $in: [req.query.Category] };
      }

      if (req.query['Subcategory[]']) {
        const subcategories = Array.isArray(req.query['Subcategory[]'])
          ? req.query['Subcategory[]']
          : [req.query['Subcategory[]']];

        cond.subCategoryName = { $in: subcategories };
      }

      console.log(cond);

      if (req.query.product) {
        cond._id = { $ne: req.query.product };
      }

      if (req.query.brand) {
        cond.brandName = req.query.brand;
      }

      if (req.query.colors) {
        const colors = Array.isArray(req.query.colors)
          ? req.query.colors
          : req.query.colors.split(',');

        cond.varients = {
          $elemMatch: {
            color: { $in: colors }
          }
        };
      }

      if (req.query.minPrice && req.query.maxPrice) {
        cond['varients.selected'] = {
          $elemMatch: {
            offerprice: {
              $gte: parseFloat(req.query.minPrice),
              $lte: parseFloat(req.query.maxPrice)
            }
          }
        };
      }

      console.log(cond);

      let skip = (req.query.page - 1) * req.query.limit;

      const product = await Product.find(cond)
        .populate('category')
        .skip(skip)
        .sort({ createdAt: -1 })
        .limit(parseInt(req.query.limit));

      const total = await Product.countDocuments(cond);

      return response.ok(res, { product, length: total });
    } catch (error) {
      console.error(error);
      return response.error(res, error);
    }
  },

  getColors: async (req, res) => {
    try {
      let product = await Product.aggregate([
        { $unwind: '$varients' },
        {
          $group: {
            _id: null, // We don't need to group by a specific field, so use null
            uniqueColors: { $addToSet: '$varients.color' } // $addToSet ensures uniqueness
          }
        },
        {
          $project: {
            _id: 0, // Exclude _id from the output
            uniqueColors: 1
          }
        }
      ]);
      const d = cleanAndUnique(product[0].uniqueColors);
      return response.ok(res, { uniqueColors: d });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getBrand: async (req, res) => {
    try {
      const product = await Product.aggregate([
        {
          $group: {
            _id: '$brandName'
          }
        },
        {
          $project: {
            _id: 0,
            brandName: '$_id'
          }
        }
      ]);

      // Optional: remove duplicates if needed (though $group already handles it)
      const brandNames = product.map((item) => item.brandName);

      return response.ok(res, { uniqueBrandName: brandNames });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getProductbycategory: async (req, res) => {
    try {
      let product = await Product.find({ category: req.params.id }).populate(
        'category'
      );
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  productSearch: async (req, res) => {
    try {
      let cond = {
        $or: [
          { name: { $regex: req.query.key, $options: 'i' } },
          { brandName: { $regex: req.query.key, $options: 'i' } },
          { categoryName: { $regex: req.query.key, $options: 'i' } },
          { subCategoryName: { $regex: req.query.key, $options: 'i' } }
        ]
      };
      const product = await Product.find(cond).sort({ createdAt: -1 });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  topselling: async (req, res) => {
    try {
      let product = await Product.find({ is_top: true }).sort({
        updatedAt: -1
      });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const productId = req?.params?.id;
      const { confirmFlashSaleDelete } = req?.body || {};

      // Check if product exists in any flash sale
      const FlashSale = require('@models/sale');
      const flashSales = await FlashSale.find({ 
        product: productId,
        status: { $in: ['ACTIVE', 'INACTIVE'] }
      });

      // If product is in flash sale and user hasn't confirmed deletion
      if (flashSales.length > 0 && !confirmFlashSaleDelete) {
        return response.ok(res, {
          requiresConfirmation: true,
          flashSaleCount: flashSales.length,
          message: 'This product is in flash sale. Deleting it will also remove the flash sale.'
        });
      }

      // Delete flash sales associated with this product
      if (flashSales.length > 0) {
        await FlashSale.deleteMany({ product: productId });
      }

      // Delete the product
      await Product.findByIdAndDelete(productId);
      
      return response.ok(res, { 
        message: flashSales.length > 0 
          ? 'Product and associated flash sale(s) deleted successfully' 
          : 'Product deleted successfully' 
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  requestProduct: async (req, res) => {
    try {
      const payload = req?.body || {};
      const storePrefix = 'JASZ';

      const lastOrder = await ProductRequest.findOne()
        .sort({ createdAt: -1 })
        .lean();

      let orderNumber = 1;

      const centralTime = DateTime.now().setZone('America/Chicago');
      const datePart = centralTime.toFormat('yyLLdd'); // e.g., 240612

      if (lastOrder && lastOrder.orderId) {
        const match = lastOrder.orderId.match(/-(\d{2})$/);
        if (match && match[1]) {
          orderNumber = parseInt(match[1], 10) + 1;
        }
      }

      const orderPart = String(orderNumber).padStart(2, '0');
      const generatedOrderId = `${storePrefix}-${datePart}-${orderPart}`;

      payload.orderId = generatedOrderId;
      const newOrder = new ProductRequest(payload);

      newOrder.orderId = generatedOrderId;
      await newOrder.save();

      await Promise.all(
        payload.productDetail.map(async (productItem) => {
          const product = await Product.findById(productItem.product);
          if (!product) return;

          const colorToMatch = productItem.color;
          const quantityToReduce = Number(productItem.qty || 0);

          if (!colorToMatch || !quantityToReduce) return;

          const updatedVariants = product.varients.map((variant) => {
            if (variant.color !== colorToMatch) return variant;

            const updatedSelected = variant.selected.map((sel) => {
              return {
                ...sel,
                qty: Math.max(Number(sel.qty) - quantityToReduce, 0).toString()
              };
            });
            console.log('updatedSelected', updatedSelected);
            return {
              ...variant,
              selected: updatedSelected
            };
          });

          await Product.findByIdAndUpdate(
            product._id,
            {
              variants: updatedVariants,
              $inc: {
                sold_pieces: quantityToReduce,
                pieces: -quantityToReduce
              }
            },
            { new: true }
          );
        })
      );

      await mailNotification.orderDelivered({
        email: req?.body?.Email,
        orderId: newOrder.orderId
      });

      const user = await User.findById(payload.user); // user document milega
      console.log('User shipping address before:', user.shippingAddress);
      user.shippingAddress = payload.ShippingAddress; // update field
      await user.save();
      console.log('User shipping address updated:', user.shippingAddress);

      return response.ok(res, {
        message: 'Product request added successfully',
        orders: newOrder
      });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getrequestProduct: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      console.log(req.user?.id);
      console.log(req.user?._id);
      const product = await ProductRequest.find({ user: req.user?.id })
        .populate('productDetail.product user', '-password -varients')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getHistoryProduct: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const product = await ProductRequest.find({
        user: req.user?.id,
        status: 'Completed'
      })
        .populate('productDetail.product user', '-password -varients')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getOrderBySeller: async (req, res) => {
    try {
      console.log('Request body:', req.body);
      console.log('Request query:', req.query);
      console.log('Authenticated user:', req.user);
      
      const { curentDate, orderId, sellerId: requestedSellerId, search } = req.body || {};
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let skip = (page - 1) * limit;
      
      // If admin is making the request without a specific sellerId, return all seller orders
      if (req.user?.role === 'Admin' && !requestedSellerId) {
        console.log('Admin viewing all seller orders');
        
        // Build base query
        const baseQuery = {};
        
        // Add date filter if provided
        if (curentDate) {
          const date = new Date(curentDate);
          date.setHours(0, 0, 0, 0);
          const nextDay = new Date(date);
          nextDay.setDate(date.getDate() + 1);
          nextDay.setHours(0, 0, 0, 0);
          baseQuery.createdAt = { $gte: date, $lt: nextDay };
        }
        
        // Add order ID filter if provided
        if (orderId) {
          const trimmedOrderId = orderId.trim();
          if (trimmedOrderId.length > 0) {
            baseQuery.orderId = { $regex: trimmedOrderId, $options: 'i' };
          }
        }
        
        // Add search filter for name, email, or order ID
        if (search && search.trim()) {
          const searchRegex = { $regex: search.trim(), $options: 'i' };
          
          // First, find users matching the search
          const matchingUsers = await User.find({
            $or: [
              { name: searchRegex },
              { email: searchRegex }
            ]
          }).select('_id');
          
          const userIds = matchingUsers.map(u => u._id);
          
          // Build search query
          baseQuery.$or = [
            { orderId: searchRegex },
            { user: { $in: userIds } }
          ];
        }
        
        // Get all orders with seller information
        const [orders, totalItems] = await Promise.all([
          Order.find(baseQuery)
            .populate('orderItems.product')
            .populate('orderItems.seller', 'name email phone')
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          Order.countDocuments(baseQuery)
        ]);
        
        return res.status(200).json({
          status: true,
          data: orders.map((order, index) => ({
            ...order.toObject(),
            indexNo: skip + index + 1
          })),
          pagination: {
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            itemsPerPage: limit
          }
        });
      }
      
      // For sellers or admin viewing a specific seller
      const sellerId = requestedSellerId || req.user?.id;
      
      if (!sellerId) {
        return res.status(400).json({
          status: false,
          message: 'Seller ID is required.'
        });
      }
      
      console.log('Viewing orders for seller:', sellerId);
      
      // Get all product IDs for this seller
      const sellerProducts = await Product.find({ SellerId: sellerId }, '_id');
      console.log('Seller products count:', sellerProducts.length);
      
      if (!sellerProducts || sellerProducts.length === 0) {
        return res.status(200).json({
          status: true,
          data: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: page,
            itemsPerPage: limit
          },
          message: 'No products found for this seller'
        });
      }

      const productIds = sellerProducts.map(p => p._id);
      console.log('Product IDs:', productIds);
      
      // Build the query
      const query = {
        'orderItems.product': { $in: productIds },
        status: { $ne: 'cancelled' } // Exclude cancelled orders
      };

      // Add date filter if provided
      if (curentDate) {
        const startDate = new Date(curentDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(curentDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startDate, $lte: endDate };
        console.log('Date range:', { startDate, endDate });
      }

      // Add order ID filter if provided
      if (orderId && orderId.trim()) {
        query.orderId = { $regex: orderId.trim(), $options: 'i' };
        console.log('Order ID filter:', orderId.trim());
      }

      // Add search filter for name, email, or order ID
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        
        // First, find users matching the search
        const matchingUsers = await User.find({
          $or: [
            { name: searchRegex },
            { email: searchRegex }
          ]
        }).select('_id');
        
        const userIds = matchingUsers.map(u => u._id);
        
        // Add to query - search by order ID or user
        if (!query.$or) {
          query.$or = [];
        }
        query.$or.push(
          { orderId: searchRegex },
          { user: { $in: userIds } }
        );
        console.log('Search filter applied:', search.trim());
      }

      // Reuse existing page, limit, skip variables
      console.log('Final query:', JSON.stringify(query, null, 2));

      // First, get the count of matching orders
      const totalItems = await Order.countDocuments(query);
      console.log('Total matching orders:', totalItems);

      if (totalItems === 0) {
        return res.status(200).json({
          status: true,
          data: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: page,
            itemsPerPage: limit
          },
          message: 'No orders found for the given criteria'
        });
      }

      // Get orders with pagination
      const orders = await Order.find(query)
        .populate('user', 'name email phone')
        .populate({
          path: 'orderItems.product',
          select: 'name price image description vietnamiesName SellerId',
          match: { _id: { $in: productIds } }
        })
        .populate({
          path: 'orderItems.seller',
          select: 'name email phone'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      console.log('Raw orders from DB:', JSON.stringify(orders, null, 2));

      // Filter out orders that don't have any products from this seller
      const filteredOrders = orders.filter(order => {
        const hasSellerProducts = order.orderItems.some(item => 
          item.product && productIds.some(id => id.equals(item.product._id))
        );
        if (!hasSellerProducts) {
          console.log('Filtering out order with no matching products:', order._id);
        }
        return hasSellerProducts;
      });

      console.log('Filtered orders count:', filteredOrders.length);

      return res.status(200).json({
        status: true,
        data: filteredOrders,
        pagination: {
          totalItems: filteredOrders.length,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      console.error('Error in getOrderBySeller:', error);
      return res.status(500).json({
        status: false,
        message: error.message || 'An error occurred'
      });
    }
  },

  getrequestProductbyid: async (req, res) => {
    try {
      const product = await ProductRequest.findById(req.params.id)
        .populate('user', '-password')
        .populate('category')
        .populate('productDetail.product');
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getrequestProductbyuser: async (req, res) => {
    try {
      const product = await ProductRequest.find({ user: req.user.id })
        .populate('category product')
        .sort({ createdAt: -1 });
      return response.ok(res, product);
    } catch (error) {
      return response.error(res, error);
    }
  },

  dashboarddetails: async (req, res) => {
    try {
      const allTransactions = await ProductRequest.find({});
      let totalAmount = 0;

      allTransactions.forEach((txn) => {
        totalAmount += Number(txn.total) || 0;
      });

      const allCategories = await Category.countDocuments();
      const totalUsers = await User.countDocuments({ role: 'User' });
      const totalFeedbacks = await ContactUs.countDocuments();

      const details = {
        totalTransactionAmount: totalAmount.toFixed(2),
        totalCategories: allCategories,
        totalUsers: totalUsers,
        totalFeedbacks: totalFeedbacks
      };

      return response.ok(res, details);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getMonthlySales: async (req, res) => {
    const year = parseInt(req.query.year);

    if (!year || isNaN(year)) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    try {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year + 1}-01-01`);

      const sales = await ProductRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end } 
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            totalSales: {
              $sum: { $toDouble: '$total' }
            }
          }
        },
        {
          $project: {
            month: '$_id',
            totalSales: 1,
            _id: 0
          }
        },
        {
          $sort: { month: 1 }
        }
      ]);

      const fullData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const found = sales.find((s) => s.month === month);
        return {
          name: new Date(0, i).toLocaleString('default', { month: 'short' }),
          monthly: found ? found.totalSales : 0
        };
      });

      return response.ok(res, fullData);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getTopSoldProduct: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const products = await Product.find()
        .sort({ sold_pieces: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getLowStockProduct: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const products = await Product.find({ pieces: { $lt: 20 } })
        .sort({ pieces: 1 })
        .limit(Number(limit))
        .skip((page - 1) * limit);

      return response.ok(res, products);
    } catch (error) {
      return response.error(res, error);
    }
  },

  getDashboardStats: async (req, res) => {
    try {
      // Get total sales (sum of all paid orders)
      const [totalSalesData] = await Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]);

      // Get count of pending orders
      const pendingOrdersCount = await Order.countDocuments({ 
        status: { $in: ['pending', 'processing'] } 
      });

      // Get total products in stock
      const [productsInStock] = await Product.aggregate([
        { $group: { _id: null, total: { $sum: '$stock' } } }
      ]);

      // Get total earnings (from admin wallet credits)
      const [earningsData] = await WalletTransaction.aggregate([
        { $match: { walletType: 'admin', type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Get count of refund requests
      const refundRequestsCount = await Order.countDocuments({
        status: 'refund_requested'
      });

      // Get count of completed payouts
      const payoutsCompleted = await WithdrawalRequest.countDocuments({
        status: 'completed'
      });

      const stats = {
        totalSales: totalSalesData?.total || 0,
        pendingOrders: pendingOrdersCount,
        productsInStock: productsInStock?.total || 0,
        earnings: earningsData?.total || 0,
        refundRequests: refundRequestsCount,
        payoutsCompleted: payoutsCompleted
      };

      return response.ok(res, stats);
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      return response.error(res, 'Failed to fetch dashboard statistics');
    }
  },

  getProductByCatgeoryName: async (req, res) => {
    try {
      const { brand, colors, minPrice, maxPrice } = req.query;

      let cond = {};

      if (brand) {
        cond.brandName = brand;
      }

      if (colors) {
        const colorArray = Array.isArray(colors) ? colors : colors.split(',');
        cond['varients.color'] = { $in: colorArray };
      }

      if (minPrice && maxPrice) {
        cond['varients.selected'] = {
          $elemMatch: {
            offerprice: {
              $gte: parseFloat(minPrice),
              $lte: parseFloat(maxPrice)
            }
          }
        };
      }

      // get all categories
      const categories = await Category.find();

      const result = await Promise.all(
        categories.map(async (cat) => {
          const products = await Product.find({
            ...cond,
            category: cat._id
          });

          return {
            categoryName: cat.name,
            products
          };
        })
      );

      return res.status(200).json({
        status: true,
        data: result
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
};

