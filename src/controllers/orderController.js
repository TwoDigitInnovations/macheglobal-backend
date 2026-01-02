const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/product');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { createOrderNotification } = require('./notificationController');
const AdminWallet = require('../models/AdminWallet');
const SellerWallet = require('../models/SellerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const ErrorResponse = require('../utils/errorResponse');
const CreditTransaction = require('../models/CreditTransaction');
const { v4: uuidv4 } = require('uuid');

// Helper function to process commission for each order item
const processOrderItemCommission = async (orderItem, orderId, session) => {
    try {
        // Generate a temporary ID if orderItem._id is not available
        const itemId = orderItem._id || new mongoose.Types.ObjectId();
        
        console.log('Processing commission for order item:', {
            orderItemId: itemId,
            productId: orderItem.product,
            sellerId: orderItem.seller,
            price: orderItem.price,
            quantity: orderItem.qty
        });

        // Convert seller ID to string for consistent comparison
        const sellerId = orderItem.seller && orderItem.seller.toString();
        
        if (!sellerId) {
            throw new Error('No seller ID provided for order item');
        }

        // First try to find the seller by ID without checking isActive or role case
        let seller = await User.findOne({
            _id: sellerId,
            $or: [
                { role: 'seller' },
                { role: 'Seller' },
                { role: 'SELLER' }
            ]
        }).session(session);
        
        // If not found, try to find any active seller
        if (!seller) {
            console.log(`Seller with ID ${sellerId} not found, looking for any active seller`);
            seller = await User.findOne({
                $or: [
                    { role: 'seller', isActive: true },
                    { role: 'Seller', isActive: true },
                    { role: 'SELLER', isActive: true }
                ]
            }).session(session);
            
            if (!seller) {
                console.error('No active seller found in the system');
                // As a last resort, try to find any seller regardless of status
                seller = await User.findOne({
                    $or: [
                        { role: 'seller' },
                        { role: 'Seller' },
                        { role: 'SELLER' }
                    ]
                }).session(session);
                
                if (!seller) {
                    throw new Error('No seller account exists in the system');
                }
                
                console.log(`Found inactive seller: ${seller._id} (${seller.email}) - using as fallback`);
            } else {
                console.log(`Using active fallback seller: ${seller._id} (${seller.email})`);
            }
            
            // Update the order item with the found seller ID
            orderItem.seller = seller._id;
        } else if (seller && !seller.isActive) {
            console.warn(`Seller ${seller._id} is not active but will be used`);
        }

        const itemTotal = orderItem.price * orderItem.qty;
        const adminCommission = parseFloat((itemTotal * 0.02).toFixed(2)); // 2% commission
        const sellerEarning = parseFloat((itemTotal - adminCommission).toFixed(2));
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        console.log(`Processing commission for order item ${orderItem._id}:`);
        console.log(`- Item Total: ${itemTotal}`);
        console.log(`- Admin Commission (2%): ${adminCommission}`);
        console.log(`- Seller Earning: ${sellerEarning}`);

        // Find or create seller's wallet
        let sellerWallet = await SellerWallet.findOne({ sellerId: seller._id });
        if (!sellerWallet) {
            sellerWallet = new SellerWallet({
                sellerId: seller._id,
                balance: 0,
                totalEarnings: 0,
                thisMonthEarnings: 0,
                transactions: []
            });
        }

        // Update seller's wallet
        sellerWallet.balance = parseFloat((sellerWallet.balance + sellerEarning).toFixed(2));
        sellerWallet.totalEarnings = parseFloat((sellerWallet.totalEarnings + sellerEarning).toFixed(2));
        
        // Update this month's earnings if the order is from the current month
        const order = await Order.findById(orderId);
        if (order && order.paidAt && new Date(order.paidAt) >= firstDayOfMonth) {
            sellerWallet.thisMonthEarnings = parseFloat((sellerWallet.thisMonthEarnings + sellerEarning).toFixed(2));
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
                commission: adminCommission,
                transactionType: 'SALE'
            }
        });
        
        // Create wallet transaction for seller earnings
        const sellerWalletTransaction = new WalletTransaction({
            walletType: 'Seller',
            sellerId: seller._id,
            sellerName: seller.name,
            orderId: orderId,
            type: 'credit',
            amount: sellerEarning,
            description: `Earnings from sale of ${orderItem.qty}x ${orderItem.name}`,
            status: 'completed',
            metadata: {
                orderId: orderId || 'N/A',
                itemId: orderItem._id,
                itemName: orderItem.name || 'Unknown Product',
                quantity: orderItem.qty || 1,
                pricePerItem: orderItem.price,
                totalAmount: itemTotal,
                transactionType: 'SALE_EARNING'
            }
        });

        // Find admin user (case-insensitive check)
        const admin = await User.findOne({
            $or: [
                { role: 'admin' },
                { role: 'Admin' },
                { role: 'ADMIN' }
            ]
        });
        
        if (!admin) {
            console.error('Admin user not found');
            throw new Error('Admin user not found');
        }

        // Find or create admin's wallet
        let adminWallet = await AdminWallet.findOne({});
        if (!adminWallet) {
            adminWallet = new AdminWallet({
                balance: 0,
                totalEarnings: 0,
                transactions: []
            });
        }

        // Update admin's wallet
        adminWallet.balance = parseFloat((adminWallet.balance + adminCommission).toFixed(2));
        adminWallet.totalEarnings = parseFloat((adminWallet.totalEarnings + adminCommission).toFixed(2));
        
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
                commissionRate: 0.02,
                transactionType: 'COMMISSION'
            }
        });

        // Create wallet transaction for admin commission
        const walletTransaction = new WalletTransaction({
            walletType: 'Admin',
            type: 'credit',
            amount: adminCommission,
            description: `Commission from order #${orderId ? orderId.toString().substring(18) : 'N/A'} - ${orderItem.name || 'Unknown Product'}`,
            status: 'completed',
            adminId: admin._id, // Add adminId to make it queryable
            metadata: {
                orderId: orderId || 'N/A',
                itemId: itemId,
                itemName: orderItem.name || 'Unknown Product',
                quantity: orderItem.qty || 1,
                sellerId: seller._id,
                sellerName: seller.name || 'Unknown Seller',
                transactionType: 'COMMISSION'
            }
        });
        
        // Safe logging with null checks
        const safeLogData = {
            walletType: 'Admin',
            type: 'credit',
            amount: adminCommission,
            description: `Commission from order #${orderId ? orderId.toString().substring(0, 8) : 'N/A'} - ${orderItem?.name || 'Unknown Product'}`,
            status: 'completed',
            metadata: {
                orderId: orderId ? orderId.toString() : 'N/A',
                itemId: itemId ? itemId.toString() : 'N/A',
                sellerId: seller?._id ? seller._id.toString() : 'N/A'
            }
        };
        console.log('Created wallet transaction:', JSON.stringify(safeLogData, null, 2));

        // Add transaction to admin wallet
        adminWallet.transactions.push(walletTransaction._id);

        // Add transaction to seller wallet
        sellerWallet.transactions.push(sellerWalletTransaction._id);

        // Save all changes in a single transaction
        console.log('Saving all transactions...');
        const results = await Promise.all([
            sellerWallet.save({ session }),
            sellerTransaction.save({ session }),
            adminWallet.save({ session }),
            adminTransaction.save({ session }),
            walletTransaction.save({ session }),
            sellerWalletTransaction.save({ session })
        ]);
        
        const savedAdminWalletTransaction = results[4];
        const savedSellerWalletTransaction = results[5];
        
        console.log('Admin wallet transaction saved successfully:', {
            id: savedAdminWalletTransaction._id,
            walletType: savedAdminWalletTransaction.walletType,
            type: savedAdminWalletTransaction.type,
            amount: savedAdminWalletTransaction.amount,
            status: savedAdminWalletTransaction.status
        });
        
        console.log('Seller wallet transaction saved successfully:', {
            id: savedSellerWalletTransaction._id,
            walletType: savedSellerWalletTransaction.walletType,
            type: savedSellerWalletTransaction.type,
            amount: savedSellerWalletTransaction.amount,
            status: savedSellerWalletTransaction.status
        });

        console.log(`Successfully processed commission for order item ${orderItem._id}`);
        return { success: true, sellerEarning, adminCommission };
    } catch (error) {
        console.error('Error processing commission:', error);
        throw error; // Re-throw to trigger transaction rollback
    }
};


exports.createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log('Received order request with data:', JSON.stringify({
            body: req.body,
            user: req.user ? req.user.id : 'No user in request'
        }, null, 2));

        let {
            orderItems,
            shippingAddress,
            paymentMethod = 'card',
            itemsPrice,
            taxPrice = 0,
            shippingPrice = 0,
            totalPrice,
            creditUsed = 0,
            couponCode,
            user: userId
        } = req.body;

        // If user is authenticated via JWT, use that instead of the one from the body
        if (req.user && req.user.id) {
            userId = req.user.id;
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        // Handle coupon if provided
        if (couponCode) {
            const Coupon = require('../models/Coupon');
            const coupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase(),
                isActive: true 
            }).session(session);

            if (!coupon) {
                throw new Error('Invalid coupon code');
            }

            // Check if user has already used this coupon
            const userUsage = coupon.usedBy.filter(
                usage => usage.userId.toString() === userId
            );
            
            if (userUsage.length >= coupon.userUsageLimit) {
                throw new Error('You have already used this coupon');
            }

            // Check if coupon is expired
            const currentDate = new Date();
            if (coupon.endDate < currentDate) {
                throw new Error('Coupon has expired');
            }

            // Check if coupon has started
            if (coupon.startDate > currentDate) {
                throw new Error('Coupon is not yet active');
            }

            // Check usage limit
            if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
                throw new Error('Coupon usage limit reached');
            }

            console.log(`Applying coupon ${couponCode} to order`);
        }

        // Handle credit balance deduction if used
        if (creditUsed > 0) {
            const CreditTransaction = require('../models/CreditTransaction');
            const user = await User.findById(userId).session(session);
            
            if (!user) {
                throw new Error('User not found');
            }

            if (user.creditBalance < creditUsed) {
                throw new Error('Insufficient credit balance');
            }

            const balanceBefore = user.creditBalance;
            const balanceAfter = balanceBefore - creditUsed;

            // Deduct credit balance
            user.creditBalance = balanceAfter;
            await user.save({ session });

            console.log(`Deducted ${creditUsed} from user ${userId} credit balance`);
        }

        // Validate order items
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            throw new Error('Order must contain at least one item');
        }

        // Log order items with seller information
        console.log('Order items with seller info:');
        orderItems.forEach((item, index) => {
            console.log(`Item ${index + 1}:`, {
                product: item.product,
                seller: item.seller || 'No seller ID',
                price: item.price,
                qty: item.qty
            });
        });

        if (!orderItems || orderItems.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse('No order items', 400));
        }

        if (!req.body.user) {
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse('User ID is required', 400));
        }

        // Create the order
        const order = new Order({
            user: req.body.user,
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            couponCode: couponCode || null,
            isPaid: true, // Mark as paid immediately since we're processing payment
            paidAt: Date.now(),
            paymentResult: {
                id: `manual-${Date.now()}`,
                status: 'COMPLETED',
                update_time: new Date().toISOString(),
                email_address: shippingAddress?.email || 'customer@example.com'
            }
        });

        const createdOrder = await order.save({ session });

        // Deduct stock for ordered items
        const Product = require('../models/product');
        for (const item of orderItems) {
            const product = await Product.findById(item.product).session(session);
            
            if (product) {
                // Check if it's a variable product with variants
                if (product.productType === 'variable' && item.selectedAttributes) {
                    // Find the matching variant
                    const variantIndex = product.variants.findIndex(v => 
                        JSON.stringify(v.attributes) === JSON.stringify(item.selectedAttributes)
                    );
                    
                    if (variantIndex !== -1 && product.variants[variantIndex]) {
                        // Deduct stock from variant
                        product.variants[variantIndex].stock -= item.qty;
                        console.log(`Deducted ${item.qty} from variant stock. New stock: ${product.variants[variantIndex].stock}`);
                    }
                } else {
                    // Simple product - deduct from simpleProduct.stock or pieces
                    if (product.simpleProduct && product.simpleProduct.stock !== undefined) {
                        product.simpleProduct.stock -= item.qty;
                        console.log(`Deducted ${item.qty} from simpleProduct stock. New stock: ${product.simpleProduct.stock}`);
                    } else if (product.pieces !== undefined) {
                        product.pieces -= item.qty;
                        console.log(`Deducted ${item.qty} from pieces. New pieces: ${product.pieces}`);
                    }
                }
                
                await product.save({ session });
            }
        }

        // Mark coupon as used if provided
        if (couponCode) {
            const Coupon = require('../models/Coupon');
            const coupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase() 
            }).session(session);

            if (coupon) {
                coupon.usedBy.push({
                    userId: userId,
                    orderId: createdOrder._id,
                    usedAt: new Date()
                });
                coupon.usageCount += 1;
                await coupon.save({ session });
                console.log(`Coupon ${couponCode} marked as used by user ${userId}`);
            }
        }

        // Create credit transaction if credit was used
        if (creditUsed > 0) {
            const CreditTransaction = require('../models/CreditTransaction');
            const user = await User.findById(userId).session(session);
            
            const creditTransaction = new CreditTransaction({
                user: userId,
                order: createdOrder._id,
                amount: creditUsed,
                type: 'debit',
                reason: 'order_payment',
                description: `Payment for order #${createdOrder.orderId}`,
                balanceBefore: user.creditBalance + creditUsed,
                balanceAfter: user.creditBalance
            });
            await creditTransaction.save({ session });
            
            console.log(`Created credit transaction for ${creditUsed} deduction`);
        }

        // Create order notification
        try {
            await createOrderNotification(createdOrder._id, req.body.user, session);
            console.log('Order notification created for order:', createdOrder._id);
        } catch (notificationErr) {
            console.error('Error creating order notification:', notificationErr);
            // Don't fail the order if notification fails
        }

        const commissionResults = [];

        for (const item of orderItems) {
            try {
                const result = await processOrderItemCommission(item, createdOrder._id, session);
                console.log('Commission processed successfully:', result);
                commissionResults.push(result);
            } catch (itemError) {
                console.error(`Error processing commission for item ${item._id}:`, itemError);
                console.error('Item causing error:', JSON.stringify(item, null, 2));
                
                // Try to find the seller in the database
                try {
                    const seller = await User.findById(item.seller).session(session);
                    console.error('Seller status:', seller ? 
                        `Found: ${seller._id}, Active: ${seller.isActive}, Email: ${seller.email}` : 
                        'Not found');
                } catch (e) {
                    console.error('Error checking seller status:', e);
                }
                
                commissionResults.push({ 
                    success: false, 
                    error: itemError.message,
                    item: {
                        productId: item.product,
                        sellerId: item.seller,
                        price: item.price,
                        quantity: item.qty
                    }
                });
            }
        }
        
        // Check if any commissions failed
        const failedCommissions = commissionResults.filter(r => !r.success);
        if (failedCommissions.length > 0) {
            console.error('Some commissions failed to process:', failedCommissions);
            throw new Error(`Failed to process commissions for ${failedCommissions.length} items`);
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        
        console.log('Successfully created order and processed commissions:', createdOrder._id);
        
        // Calculate total commissions
        const totalAdminCommission = commissionResults.reduce((sum, r) => sum + (r.adminCommission || 0), 0);
        const totalSellerEarnings = commissionResults.reduce((sum, r) => sum + (r.sellerEarning || 0), 0);
        
        res.status(201).json({
            success: true,
            data: {
                ...createdOrder.toObject(),
                commissionDetails: {
                    totalAdminCommission,
                    totalSellerEarnings,
                    itemsProcessed: commissionResults.length
                }
            },
            message: 'Order created and payment processed successfully'
        });
    } catch (error) {
        console.error('Error in createOrder:', error);
        await session.abortTransaction();
        session.endSession();
        next(new ErrorResponse(`Failed to create order: ${error.message}`, 500));
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

        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log(`Fetching orders for user ID: ${userId}, page: ${page}, limit: ${limit}`);

        // Get total count for pagination
        const total = await Order.countDocuments({
            $or: [
                { user: userId },
                { user: { $eq: userId } }
            ]
        });

        // Get paginated orders
        const orders = await Order.find({ 
            $or: [
                { user: userId },
                { user: { $eq: userId } }
            ]
        })
        .sort({ createdAt: -1 }) // Sort by newest first
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email')
        .populate('orderItems.product', 'name price image')
        .lean();
            
        console.log(`Found ${orders.length} orders for page ${page} of ${Math.ceil(total / limit)}`);

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
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
        console.log('Starting updateOrderToPaid for order:', req.params.id);
        
        // Find and lock the order in the session
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            console.error('Order not found:', req.params.id);
            await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse('Order not found', 404));
        }

        if (order.isPaid) {
            console.log('Order already paid:', order._id);
            await session.abortTransaction();
            session.endSession();
            return res.json({
                success: true,
                data: order,
                message: 'Order was already paid'
            });
        }

        console.log('Marking order as paid:', order._id);
        
        // Mark order as paid
        order.isPaid = true;
        order.paidAt = new Date();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.payer?.email_address,
        };

        // Save the order first
        const updatedOrder = await order.save({ session });

        // Create order notification
        try {
            await createOrderNotification(updatedOrder._id, order.user, session);
            console.log('Order notification created for order:', order._id);
        } catch (notificationErr) {
            console.error('Error creating order notification:', notificationErr);
            // Don't fail the order if notification fails
        }

        // Process commissions for each order item
        const commissionResults = [];
        for (const item of order.orderItems) {
            try {
                console.log(`Processing commission for item: ${item._id}`);
                const result = await processOrderItemCommission(item, order._id, session);
                commissionResults.push(result);
            } catch (itemError) {
                console.error(`Error processing commission for item ${item._id}:`, itemError);
                // Continue with other items but log the error
                commissionResults.push({ success: false, error: itemError.message });
            }
        }

        // Check if all commissions were processed successfully
        const failedCommissions = commissionResults.filter(r => !r.success);
        if (failedCommissions.length > 0) {
            console.error('Some commissions failed to process:', failedCommissions);
            throw new Error(`Failed to process commissions for ${failedCommissions.length} items`);
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
        
        console.log('Successfully processed order and commissions:', order._id);
        
        // Calculate total commissions
        const totalAdminCommission = commissionResults.reduce((sum, r) => sum + (r.adminCommission || 0), 0);
        const totalSellerEarnings = commissionResults.reduce((sum, r) => sum + (r.sellerEarning || 0), 0);
        
        res.json({
            success: true,
            data: {
                ...updatedOrder.toObject(),
                commissionDetails: {
                    totalAdminCommission,
                    totalSellerEarnings,
                    itemsProcessed: commissionResults.length
                }
            },
            message: 'Order marked as paid and commissions processed successfully'
        });
    } catch (error) {
        console.error('Error in updateOrderToPaid:', error);
        await session.abortTransaction();
        session.endSession();
        next(new ErrorResponse(`Failed to process payment: ${error.message}`, 500));
    }
};

exports.updateOrderStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id, status } = req.body;

        if (!id) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Order ID is required'
            });
        }

        if (!status) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        if (!validStatuses.includes(status.toLowerCase())) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: false,
                message: 'Invalid status value. Valid values are: pending, processing, shipped, delivered, cancelled, returned'
            });
        }

        const order = await Order.findById(id).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                status: false,
                message: 'Order not found'
            });
        }

        const previousStatus = order.status;
        
        // Update the status
        order.status = status.toLowerCase();
        
        // Update isDelivered if status is delivered
        if (status.toLowerCase() === 'delivered') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        }

        // Handle credit refund for cancelled or returned orders
        if ((status.toLowerCase() === 'cancelled' || status.toLowerCase() === 'returned') && !order.refundedToCredit) {
            
            
            // Get user
            const user = await User.findById(order.user).session(session);
            if (!user) {
                throw new Error('User not found');
            }

            const refundAmount = order.totalPrice;
            const balanceBefore = user.creditBalance || 0;
            const balanceAfter = balanceBefore + refundAmount;

            // Update user credit balance
            user.creditBalance = balanceAfter;
            await user.save({ session });

            // Create credit transaction record
            const creditTransaction = new CreditTransaction({
                user: user._id,
                order: order._id,
                amount: refundAmount,
                type: 'credit',
                reason: status.toLowerCase() === 'cancelled' ? 'order_cancelled' : 'order_returned',
                description: `Refund for ${status.toLowerCase()} order #${order.orderId}`,
                balanceBefore,
                balanceAfter
            });
            await creditTransaction.save({ session });

            // Mark order as refunded
            order.refundedToCredit = true;
            order.refundAmount = refundAmount;

            // Restore stock for cancelled/returned orders
            const Product = require('../models/product');
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product).session(session);
                
                if (product) {
                    // Check if it's a variable product with variants
                    if (product.productType === 'variable' && item.selectedAttributes) {
                        // Find the matching variant
                        const variantIndex = product.variants.findIndex(v => 
                            JSON.stringify(v.attributes) === JSON.stringify(item.selectedAttributes)
                        );
                        
                        if (variantIndex !== -1 && product.variants[variantIndex]) {
                            // Restore stock to variant
                            product.variants[variantIndex].stock += item.qty;
                            console.log(`Restored ${item.qty} to variant stock. New stock: ${product.variants[variantIndex].stock}`);
                        }
                    } else {
                        // Simple product - restore to simpleProduct.stock or pieces
                        if (product.simpleProduct && product.simpleProduct.stock !== undefined) {
                            product.simpleProduct.stock += item.qty;
                            console.log(`Restored ${item.qty} to simpleProduct stock. New stock: ${product.simpleProduct.stock}`);
                        } else if (product.pieces !== undefined) {
                            product.pieces += item.qty;
                            console.log(`Restored ${item.qty} to pieces. New pieces: ${product.pieces}`);
                        }
                    }
                    
                    await product.save({ session });
                }
            }

            console.log(`Refunded ${refundAmount} to user ${user._id} credit balance for order ${order._id}`);
        }

        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            status: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
};

exports.getOrdersBySeller = async (req, res, next) => {
    try {
        const pageSize = parseInt(req.query.limit) || 10;
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
            // Parse the date string - expecting YYYY-MM-DD format from frontend
            const dateStr = date.includes('T') ? date.split('T')[0] : date;
            
            // Create date objects for the start and end of the day
            // Using the date string directly to avoid timezone conversion issues
            const [year, month, day] = dateStr.split('-').map(Number);
            
            const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
            
            console.log(`Date filter for ${dateStr}:`);
            console.log(`  Start: ${startDate.toISOString()} (Local: ${startDate.toString()})`);
            console.log(`  End: ${endDate.toISOString()} (Local: ${endDate.toString()})`);
            
            orderQuery.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }

        // Add order ID filter if provided - search by orderId field, not _id
        if (orderId) {
            // Try to match orderId field (string) or _id field (ObjectId)
            if (mongoose.Types.ObjectId.isValid(orderId)) {
                orderQuery.$or = [
                    { orderId: { $regex: orderId, $options: 'i' } },
                    { _id: orderId }
                ];
            } else {
                orderQuery.orderId = { $regex: orderId, $options: 'i' };
            }
        }

        console.log('Order query:', JSON.stringify(orderQuery, null, 2));

        // First, get all order IDs that match our criteria
        const matchingOrderIds = await Order.distinct('_id', orderQuery);
        console.log(`Found ${matchingOrderIds.length} matching orders`);
        
        // Debug: If date filter is applied and no results, check what dates exist
        if (date && matchingOrderIds.length === 0) {
            const allOrdersForSeller = await Order.find({
                'orderItems.product': { $in: productIds }
            }).select('createdAt orderId').sort({ createdAt: -1 }).limit(10);
            
            console.log('Recent orders for this seller (for debugging):');
            allOrdersForSeller.forEach(order => {
                const orderDate = new Date(order.createdAt);
                console.log(`  Order ${order.orderId}: ${orderDate.toISOString()} (${orderDate.toLocaleDateString()})`);
            });
        }

        // Get total count for pagination
        const count = matchingOrderIds.length;
        const pages = Math.ceil(count / pageSize);

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

        console.log(`Returning ${orders.length} orders out of ${count} total`);

        res.json({
            success: true,
            data: orders,
            page,
            pages,
            count
        });
    } catch (error) {
        console.error('Error in getOrdersBySeller:', error);
        next(error);
    }
};
