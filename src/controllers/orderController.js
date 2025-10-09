const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/product');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ErrorResponse = require('../utils/errorResponse');
const { v4: uuidv4 } = require('uuid');

// Helper function to process commission for each order item
const processOrderItemCommission = async (orderItem, orderId) => {
    try {
        const seller = await User.findById(orderItem.seller);
        if (!seller) {
            console.error(`Seller not found: ${orderItem.seller}`);
            return;
        }

        const itemTotal = orderItem.price * orderItem.qty;
        const adminCommission = itemTotal * 0.02; // 2% commission
        const sellerEarning = itemTotal - adminCommission;
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        // Update seller's wallet
        seller.wallet.balance += sellerEarning;
        seller.wallet.totalEarnings += sellerEarning;
        
        // Update this month's earnings if the order is from the current month
        const order = await Order.findById(orderId);
        if (order && order.paidAt >= firstDayOfMonth) {
            seller.wallet.thisMonthEarnings += sellerEarning;
        }

        // Create transaction record for seller
        const sellerTransaction = new Transaction({
            user: seller._id,
            order: orderId,
            amount: sellerEarning,
            type: 'CREDIT',
            status: 'COMPLETED',
            description: `Sale of ${orderItem.qty}x ${orderItem.name}`,
            referenceId: `TXN-${uuidv4()}`,
            metadata: {
                itemId: orderItem._id,
                quantity: orderItem.qty,
                pricePerItem: orderItem.price,
                totalAmount: itemTotal,
                commission: adminCommission
            }
        });

        // Find admin user
        const admin = await User.findOne({ role: 'Admin' });
        if (admin) {
            // Update admin's wallet
            admin.wallet.balance += adminCommission;
            
            // Create transaction record for admin
            const adminTransaction = new Transaction({
                user: admin._id,
                order: orderId,
                amount: adminCommission,
                type: 'CREDIT',
                status: 'COMPLETED',
                description: `Commission from sale of ${orderItem.name} by ${seller.name}`,
                referenceId: `TXN-${uuidv4()}`,
                metadata: {
                    sellerId: seller._id,
                    sellerName: seller.name,
                    itemId: orderItem._id,
                    itemName: orderItem.name,
                    quantity: orderItem.qty,
                    commissionRate: 0.02
                }
            });

            await Promise.all([
                seller.save(),
                sellerTransaction.save(),
                admin.save(),
                adminTransaction.save()
            ]);
        } else {
            await Promise.all([
                seller.save(),
                sellerTransaction.save()
            ]);
        }
    } catch (error) {
        console.error('Error processing commission:', error);
        // Don't throw error to prevent order update from failing
    }
};


exports.createOrder = async (req, res, next) => {
    try {
        const {
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        } = req.body;

        if (orderItems && orderItems.length === 0) {
            return next(new ErrorResponse('No order items', 400));
        }

        if (!req.body.user) {
            return next(new ErrorResponse('User ID is required', 400));
        }

        const order = new Order({
            user: req.body.user,
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        const createdOrder = await order.save();
        
        res.status(201).json({
            success: true,
            data: createdOrder
        });
    } catch (error) {
        next(error);
    }
};


exports.getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate({
                path: 'orderItems.product',
                select: 'name price image description vietnamiesName'
            });
        
        if (!order) {
            return next(new ErrorResponse('Order not found', 404));
        }
        
        // Check if user is authorized to view this order
        if (order.user && order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return next(new ErrorResponse('Not authorized to view this order', 401));
        }
        
        // Format the response
        const formattedOrder = {
            _id: order._id,
            orderId: order.orderId,
            user: order.user,
            orderItems: order.orderItems.map(item => ({
                _id: item._id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                image: item.image,
                product: item.product ? {
                    _id: item.product._id,
                    name: item.product.name,
                    vietnamiesName: item.product.vietnamiesName,
                    price: item.product.price,
                    description: item.product.description,
                    image: item.product.image
                } : null
            })),
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            itemsPrice: order.itemsPrice,
            taxPrice: order.taxPrice,
            shippingPrice: order.shippingPrice,
            totalPrice: order.totalPrice,
            isPaid: order.isPaid,
            isDelivered: order.isDelivered,
            paidAt: order.paidAt,
            deliveredAt: order.deliveredAt,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };
        
        res.status(200).json({
            success: true,
            data: formattedOrder
        });
    } catch (error) {
        console.error('Error in getOrderById:', error);
        next(error);
    }
};

// New endpoint to get order details by ID (public endpoint for order tracking)
exports.getOrderDetails = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate({
                path: 'orderItems.product',
                select: 'name price image description vietnamiesName'
            });
        
        if (!order) {
            return next(new ErrorResponse('Order not found', 404));
        }
        
        // Format the response
        const formattedOrder = {
            _id: order._id,
            orderId: order.orderId,
            status: order.status,
            orderItems: order.orderItems.map(item => ({
                _id: item._id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                image: item.image,
                product: item.product ? {
                    _id: item.product._id,
                    name: item.product.name,
                    vietnamiesName: item.product.vietnamiesName,
                    price: item.product.price,
                    description: item.product.description,
                    image: item.product.image
                } : null
            })),
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            itemsPrice: order.itemsPrice,
            taxPrice: order.taxPrice,
            shippingPrice: order.shippingPrice,
            totalPrice: order.totalPrice,
            isPaid: order.isPaid,
            isDelivered: order.isDelivered,
            paidAt: order.paidAt,
            deliveredAt: order.deliveredAt,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };
        
        res.status(200).json({
            success: true,
            data: formattedOrder
        });
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        next(error);
    }
};


exports.getMyOrders = async (req, res, next) => {
    try {
       
        if (!req.user || !req.user.id) {
            console.error('No user ID found in request');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated or invalid token'
            });
        }

        const userId = req.user.id; // Changed from req.user._id to req.user.id
        console.log('Fetching orders for user ID:', userId);
        
        // Try with both ObjectId and string comparison
        const orders = await Order.find({ 
            $or: [
                { user: userId },
                { user: { $eq: userId } }
            ]
        })
        .populate('user', 'name email')
        .populate('orderItems.product', 'name price image')
        .lean();
            
        console.log('Found orders count:', orders.length);
        
        // If no orders found, check if user exists
        if (orders.length === 0) {
            console.log('No orders found for user ID:', userId);
            const userExists = await User.findById(userId);
            if (!userExists) {
                console.log('User with ID does not exist:', userId);
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            return res.status(200).json({
                success: true,
                count: 0,
                message: 'No orders found for this user',
                data: []
            });
        }
        
        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        console.error('Error in getMyOrders:', error);
        next(error);
    }
};

exports.updateOrderToPaid = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse('Order not found', 404));
        }

        if (order.isPaid) {
            await session.abortTransaction();
            session.endSession();
            return res.json({
                success: true,
                data: order,
                message: 'Order was already paid'
            });
        }

        // Mark order as paid
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.payer?.email_address,
        };

        const updatedOrder = await order.save({ session });

        // Process commission for each order item in parallel
        await Promise.all(
            order.orderItems.map(item => 
                processOrderItemCommission(item, order._id)
            )
        );

        await session.commitTransaction();
        session.endSession();
        
        res.json({
            success: true,
            data: updatedOrder,
            message: 'Order marked as paid and commissions processed'
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

exports.getOrdersBySeller = async (req, res, next) => {
    try {
        const pageSize = 10;
        const page = Number(req.query.pageNumber) || 1;
        const sellerId = req.params.sellerId;
        const { date, orderId } = req.query;

        console.log(`Fetching orders for seller: ${sellerId}, page: ${page}, date: ${date}, orderId: ${orderId}`);

        // First, verify if seller exists
        const seller = await User.findById(sellerId);
        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }

        // Find all products by this seller
        const sellerProducts = await Product.find({ SellerId: sellerId }, '_id');
        console.log(`Found ${sellerProducts.length} products for seller ${sellerId}`);
        
        if (sellerProducts.length === 0) {
            console.log(`No products found for seller: ${sellerId}`);
            return res.status(200).json({
                success: true,
                data: [],
                page,
                pages: 0,
                count: 0,
                message: 'No products found for this seller'
            });
        }

        const productIds = sellerProducts.map(p => p._id);
        console.log(`Found ${productIds.length} products for seller`);

        // Build the query to find orders containing any of these products
        const orderQuery = {
            'orderItems.product': { $in: productIds }
        };

        // Add date filter if provided
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            orderQuery.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }

        // Add order ID filter if provided
        if (orderId) {
            orderQuery._id = orderId;
        }

        // First, get all order IDs that match our criteria
        const matchingOrderIds = await Order.distinct('_id', orderQuery);
        console.log(`Found ${matchingOrderIds.length} matching orders`);

        // Then get the full order details with pagination
        const orders = await Order.find({ _id: { $in: matchingOrderIds } })
            .populate('user', 'id name email')
            .populate({
                path: 'orderItems.product',
                select: 'name image price SellerId',
                populate: {
                    path: 'SellerId',
                    select: 'name email',
                    model: 'User' // Explicitly specify the model
                }
            })
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        const count = matchingOrderIds.length;
        const pages = Math.ceil(count / pageSize);

        console.log(`Returning ${orders.length} orders out of ${count} total`);

        res.json({
            success: true,
            data: orders,
            page,
            pages,
            count
        });
    } catch (error) {
        next(error);
    }
};
