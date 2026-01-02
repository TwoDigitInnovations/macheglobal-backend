const Notification = require('../models/Notification');
const Order = require('../models/Order');
const Product = require('../models/product');
const ErrorResponse = require('../utils/errorResponse');


exports.getUserNotifications = async (req, res, next) => {
  try {
    let notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('order')
      .populate('suggestedProducts');

    // Filter out deleted products from suggestedProducts after population
    notifications = await Promise.all(notifications.map(async (notification) => {
      if (notification.suggestedProducts && notification.suggestedProducts.length > 0) {
        // Double check each product in database to ensure it's not deleted
        const validProducts = [];
        for (const product of notification.suggestedProducts) {
          if (product) {
            const dbProduct = await Product.findById(product._id);
            if (dbProduct && dbProduct.isDeleted !== true) {
              validProducts.push(product);
            }
          }
        }
        notification.suggestedProducts = validProducts;
      }
      return notification;
    }));

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (err) {
    next(err);
  }
};


exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return next(new ErrorResponse('Notification not found', 404));
    }

    // Make sure user owns the notification
    if (notification.user.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this notification', 401));
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (err) {
    next(err);
  }
};


exports.createOrderNotification = async (orderId, userId, session = null) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const order = await Order.findById(orderId).session(session).populate('orderItems.product');
      
      if (!order) {
        // If order not found, wait a bit and try again
        if (retryCount < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          retryCount++;
          continue;
        }
        throw new Error(`Order not found after ${maxRetries} attempts`);
      }

      // If we get here, we found the order
      console.log(`Found order ${orderId} after ${retryCount + 1} attempt(s)`);
      
      // Get 4 random products as suggestions (excluding ordered items and deleted products)
      const suggestedProducts = await Product.aggregate([
        { 
          $match: { 
            _id: { $nin: order.orderItems.map(item => item.product._id) },
            $or: [
              { isDeleted: false },
              { isDeleted: { $exists: false } }
            ]
          } 
        },
        { $sample: { size: 4 } }
      ]);

      // Use orderId from order if available, otherwise use the order's _id
      const displayOrderId = order.orderId || `#${order._id.toString().slice(-6).toUpperCase()}`;
      
      const notification = await Notification.create([{
        user: userId,
        order: orderId,
        title: 'Order Placed Successfully',
        message: `Your order has been placed successfully. Total amount: $${order.totalPrice}`,
        type: 'order',
        suggestedProducts: suggestedProducts.map(p => p._id)
      }], { session });

      // Populate the notification with order and suggested products
      const populatedNotification = await Notification
        .findById(notification[0]._id)
        .populate('order')
        .populate('suggestedProducts');

      console.log('Successfully created notification:', populatedNotification._id);
      return populatedNotification;
      
    } catch (err) {
      if (retryCount === maxRetries - 1) {
        console.error(`Error creating order notification after ${maxRetries} attempts:`, err);
        throw err;
      }
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
    }
  }
};
