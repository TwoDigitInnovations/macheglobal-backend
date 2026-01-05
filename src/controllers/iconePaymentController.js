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
        
        await order.save();
        
        console.log(`Order ${orderRef} marked as paid`);
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
