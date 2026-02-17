const axios = require('axios');
const Order = require('../models/Order');
const ErrorResponse = require('../utils/errorResponse');


const ICONE_PAY_CONFIG = {
  apiKey: process.env.ICONE_PAY_API_KEY,
  baseUrl: process.env.ICONE_PAY_BASE_URL ,
  successUrl: process.env.ICONE_PAY_SUCCESS_URL ,
  cancelUrl: process.env.ICONE_PAY_CANCEL_URL,
  webhookUrl: process.env.ICONE_PAY_WEBHOOK_URL 
};


exports.initIconePayment = async (req, res, next) => {
  try {
    const { orderId, amount, currency = 'htg', items } = req.body;

    if (!orderId || !amount) {
      return next(new ErrorResponse('Order ID and amount are required', 400));
    }

  
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ErrorResponse('Order not found', 404));
    }

 
    const paymentData = {
      amount: parseFloat(amount),
      currency: currency.toLowerCase(),
      action: 'purchase',
      referenceId: orderId,
      successUrl: `${ICONE_PAY_CONFIG.successUrl}?orderId=${orderId}`,
      cancelUrl: `${ICONE_PAY_CONFIG.cancelUrl}?orderId=${orderId}`,
      items: items || order.orderItems.map(item => ({
        name: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        currency: currency.toLowerCase(),
        imageUrl: item.image || ''
      })),
      shipping: order.shippingPrice || 0,
      taxes: order.taxPrice || 0
    };

    console.log('Initiating Icon EHT payment:', paymentData);

   
    const response = await axios.post(
      `${ICONE_PAY_CONFIG.baseUrl}/init-payment`,
      paymentData,
      {
        headers: {
          'x-api-key': ICONE_PAY_CONFIG.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.error) {
      console.error('Icon EHT payment error:', response.data);
      return next(new ErrorResponse(response.data.message || 'Payment initialization failed', 400));
    }

   
    order.paymentGateway = 'icone_eht';
    order.paymentStatus = 'pending';
    await order.save();

    console.log('Icon EHT payment initialized:', response.data);

    res.status(200).json({
      success: true,
      paymentUrl: response.data.url,
      message: 'Payment initialized successfully'
    });

  } catch (error) {
    console.error('Error initializing Icon EHT payment:', error.response?.data || error.message);
    next(new ErrorResponse(
      error.response?.data?.message || 'Failed to initialize payment',
      error.response?.status || 500
    ));
  }
};


exports.handleIconeWebhook = async (req, res, next) => {
  try {
    console.log('Received Icon EHT webhook:', JSON.stringify(req.body, null, 2));

    const {
      event,
      orderId,
      referenceId,
      amount,
      currency,
      status,
      transactionId,
      timestamp
    } = req.body;

    if (!referenceId && !orderId) {
      console.error('No order reference in webhook');
      return res.status(400).json({ success: false, message: 'No order reference' });
    }

    const orderRef = referenceId || orderId;

  
    const order = await Order.findById(orderRef);
    if (!order) {
      console.error('Order not found:', orderRef);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

 
    switch (event) {
      case 'payment.success':
        console.log(`Payment successful for order ${orderRef}`);
        
        // Start a session for transaction
        const mongoose = require('mongoose');
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
          // Mark order as paid
          order.isPaid = true;
          order.paidAt = new Date(timestamp || Date.now());
          order.paymentStatus = 'completed';
          order.paymentResult = {
            id: transactionId || `icone-${Date.now()}`,
            status: 'COMPLETED',
            update_time: timestamp || new Date().toISOString(),
            gateway: 'icone_eht',
            amount: amount,
            currency: currency
          };
          
          await order.save({ session });
          
          // Process commission for each order item
          const User = require('../models/User');
          const Transaction = require('../models/Transaction');
          const AdminWallet = require('../models/AdminWallet');
          const SellerWallet = require('../models/SellerWallet');
          const WalletTransaction = require('../models/WalletTransaction');
          const { randomUUID } = require('crypto');
          
          for (const item of order.orderItems) {
            try {
              // Process commission (simplified version)
              const sellerId = item.seller;
              if (!sellerId) continue;
              
              const seller = await User.findById(sellerId).session(session);
              if (!seller) continue;
              
              const itemTotal = item.price * item.qty;
              const adminCommission = parseFloat((itemTotal * 0.02).toFixed(2));
              const sellerEarning = parseFloat((itemTotal - adminCommission).toFixed(2));
              
              // Update seller wallet
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
              
              sellerWallet.balance += sellerEarning;
              sellerWallet.totalEarnings += sellerEarning;
              await sellerWallet.save({ session });
              
              // Create seller transaction
              const sellerTransaction = new Transaction({
                user: seller._id,
                order: order._id,
                amount: sellerEarning,
                type: 'CREDIT',
                status: 'COMPLETED',
                description: `Sale of ${item.qty}x ${item.name}`,
                referenceId: `TXN-${randomUUID()}`,
                metadata: {
                  itemId: item._id,
                  quantity: item.qty,
                  pricePerItem: item.price,
                  totalAmount: itemTotal,
                  commission: adminCommission,
                  transactionType: 'SALE'
                }
              });
              await sellerTransaction.save({ session });
              
              // Update admin wallet
              const admin = await User.findOne({ role: /admin/i });
              if (admin) {
                let adminWallet = await AdminWallet.findOne({});
                if (!adminWallet) {
                  adminWallet = new AdminWallet({
                    balance: 0,
                    totalEarnings: 0,
                    transactions: []
                  });
                }
                
                adminWallet.balance += adminCommission;
                adminWallet.totalEarnings += adminCommission;
                await adminWallet.save({ session });
                
                // Create admin transaction
                const adminTransaction = new Transaction({
                  user: admin._id,
                  order: order._id,
                  amount: adminCommission,
                  type: 'CREDIT',
                  status: 'COMPLETED',
                  description: `Commission from sale of ${item.name}`,
                  referenceId: `TXN-${randomUUID()}`,
                  metadata: {
                    sellerId: seller._id,
                    sellerName: seller.name,
                    itemId: item._id,
                    itemName: item.name,
                    quantity: item.qty,
                    commissionRate: 0.02,
                    transactionType: 'COMMISSION'
                  }
                });
                await adminTransaction.save({ session });
              }
              
              console.log(`Commission processed for item ${item._id}`);
            } catch (commError) {
              console.error(`Error processing commission for item ${item._id}:`, commError);
              // Continue with other items
            }
          }
          
          // Deduct credit balance if used
          if (order.creditUsed && order.creditUsed > 0) {
            const User = require('../models/User');
            const CreditTransaction = require('../models/CreditTransaction');
            
            const user = await User.findById(order.user).session(session);
            if (user && user.creditBalance >= order.creditUsed) {
              const balanceBefore = user.creditBalance;
              user.creditBalance -= order.creditUsed;
              await user.save({ session });
              
              // Create credit transaction
              const creditTransaction = new CreditTransaction({
                user: order.user,
                order: order._id,
                amount: order.creditUsed,
                type: 'debit',
                reason: 'order_payment',
                description: `Payment for order #${order.orderId}`,
                balanceBefore: balanceBefore,
                balanceAfter: user.creditBalance
              });
              await creditTransaction.save({ session });
              
              console.log(`Deducted ${order.creditUsed} credit from user ${order.user}`);
            }
          }
          
          // Mark coupon as used if provided
          if (order.couponCode) {
            const Coupon = require('../models/Coupon');
            const coupon = await Coupon.findOne({ 
              code: order.couponCode.toUpperCase() 
            }).session(session);
            
            if (coupon) {
              coupon.usedBy.push({
                userId: order.user,
                orderId: order._id,
                usedAt: new Date()
              });
              coupon.usageCount += 1;
              await coupon.save({ session });
              console.log(`Coupon ${order.couponCode} marked as used`);
            }
          }
          
          await session.commitTransaction();
          session.endSession();
          
          console.log(`Order ${orderRef} marked as paid and processed successfully`);
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
          console.error('Error processing payment success:', error);
          throw error;
        }
        break;

      case 'payment.failed':
        console.log(`Payment failed for order ${orderRef}`);
        
        order.paymentStatus = 'failed';
        order.paymentResult = {
          id: transactionId || `icone-${Date.now()}`,
          status: 'FAILED',
          update_time: timestamp || new Date().toISOString(),
          gateway: 'icone_eht'
        };
        
        await order.save();
        break;

      case 'payment.expired':
        console.log(`Payment expired for order ${orderRef}`);
        
        order.paymentStatus = 'expired';
        await order.save();
        break;

      case 'payment.pending':
        console.log(`Payment pending for order ${orderRef}`);
        
        order.paymentStatus = 'pending';
        await order.save();
        break;

      default:
        console.log(`Unknown payment event: ${event}`);
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('Error processing Icon EHT webhook:', error);
    
    res.status(200).json({ success: false, message: error.message });
  }
};


exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.redirect('macheglobal://payment/failed?error=no_order_id');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.redirect('macheglobal://payment/failed?error=order_not_found');
    }

    console.log(`Payment success redirect for order ${orderId}`);


    res.redirect(`macheglobal://payment/success?orderId=${orderId}&amount=${order.totalPrice}`);

  } catch (error) {
    console.error('Error handling payment success:', error);
    res.redirect('macheglobal://payment/failed?error=server_error');
  }
};


exports.handlePaymentCancel = async (req, res) => {
  try {
    const { orderId } = req.query;

    console.log(`Payment cancelled for order ${orderId}`);

    // If orderId exists, mark the order as cancelled and restore stock
    if (orderId) {
      const order = await Order.findById(orderId);
      if (order) {
        // Mark order as cancelled
        order.paymentStatus = 'cancelled';
        order.status = 'cancelled';
        await order.save();

        // Restore stock for cancelled order items
        const Product = require('../models/product');
        for (const item of order.orderItems) {
          const product = await Product.findById(item.product);
          
          if (product) {
            // Check if it's a variable product with variants
            if (product.productType === 'variable' && item.selectedAttributes) {
              // Find the matching variant
              const variantIndex = product.variants.findIndex(v => {
                if (!v.attributes || !Array.isArray(v.attributes)) return false;
                if (!item.selectedAttributes || !Array.isArray(item.selectedAttributes)) return false;
                
                const allMatch = item.selectedAttributes.every(itemAttr => 
                  v.attributes.some(variantAttr => 
                    variantAttr.name === itemAttr.name && variantAttr.value === itemAttr.value
                  )
                );
                
                const noExtra = v.attributes.every(variantAttr =>
                  item.selectedAttributes.some(itemAttr =>
                    itemAttr.name === variantAttr.name && itemAttr.value === variantAttr.value
                  )
                );
                
                return allMatch && noExtra;
              });
              
              if (variantIndex !== -1 && product.variants[variantIndex]) {
                // Restore stock to variant
                product.variants[variantIndex].stock += item.qty;
                console.log(`Restored ${item.qty} to variant ${variantIndex} stock. New stock: ${product.variants[variantIndex].stock}`);
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
            
            await product.save();
          }
        }
        
        // DON'T restore credit - it was never deducted (only validated)
        // Credit will only be deducted on payment success
        
        // DON'T remove coupon usage - it was never marked as used
        // Coupon will only be marked as used on payment success

        console.log(`Order ${orderId} cancelled and stock restored`);
      }
    }

    res.redirect(`macheglobal://payment/cancelled?orderId=${orderId || 'unknown'}`);

  } catch (error) {
    console.error('Error handling payment cancel:', error);
    res.redirect('macheglobal://payment/failed?error=server_error');
  }
};


exports.checkPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).select('isPaid paymentStatus paymentResult totalPrice');
    
    if (!order) {
      return next(new ErrorResponse('Order not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        isPaid: order.isPaid,
        paymentStatus: order.paymentStatus,
        amount: order.totalPrice,
        paymentResult: order.paymentResult
      }
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    next(error);
  }
};

// Cancel order and restore stock (for manual cancellation from app)
exports.cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    console.log(`Manual order cancellation requested for order ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ErrorResponse('Order not found', 404));
    }

    // Only allow cancellation if payment is not completed
    if (order.isPaid && order.paymentStatus === 'completed') {
      return next(new ErrorResponse('Cannot cancel a completed payment', 400));
    }

    // Mark order as cancelled
    order.paymentStatus = 'cancelled';
    order.status = 'cancelled';
    await order.save();

    // Restore stock for cancelled order items
    const Product = require('../models/product');
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      
      if (product) {
        // Check if it's a variable product with variants
        if (product.productType === 'variable' && item.selectedAttributes) {
          // Find the matching variant
          const variantIndex = product.variants.findIndex(v => {
            if (!v.attributes || !Array.isArray(v.attributes)) return false;
            if (!item.selectedAttributes || !Array.isArray(item.selectedAttributes)) return false;
            
            const allMatch = item.selectedAttributes.every(itemAttr => 
              v.attributes.some(variantAttr => 
                variantAttr.name === itemAttr.name && variantAttr.value === itemAttr.value
              )
            );
            
            const noExtra = v.attributes.every(variantAttr =>
              item.selectedAttributes.some(itemAttr =>
                itemAttr.name === variantAttr.name && itemAttr.value === variantAttr.value
              )
            );
            
            return allMatch && noExtra;
          });
          
          if (variantIndex !== -1 && product.variants[variantIndex]) {
            // Restore stock to variant
            product.variants[variantIndex].stock += item.qty;
            console.log(`Restored ${item.qty} to variant ${variantIndex} stock. New stock: ${product.variants[variantIndex].stock}`);
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
        
        await product.save();
      }
    }

    console.log(`Order ${orderId} cancelled and stock restored`);

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    next(error);
  }
};
