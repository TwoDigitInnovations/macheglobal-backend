const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Invoice translations
const translations = {
  en: {
    invoice: 'INVOICE',
    invoiceNumber: 'Invoice Number',
    date: 'Date',
    paymentStatus: 'Payment Status',
    paid: 'Paid',
    pending: 'Pending',
    billTo: 'BILL TO:',
    shipTo: 'SHIP TO:',
    item: 'Item',
    qty: 'Qty',
    price: 'Price',
    total: 'Total',
    subtotal: 'Subtotal:',
    shipping: 'Shipping:',
    tax: 'Tax:',
    grandTotal: 'TOTAL:',
    paymentMethod: 'Payment Method:',
    thankYou: 'Thank you for your business!',
    contact: 'For any queries, contact us at support@macheglobal.com'
  },
  fr: {
    invoice: 'FACTURE',
    invoiceNumber: 'Numéro de facture',
    date: 'Date',
    paymentStatus: 'Statut de paiement',
    paid: 'Payé',
    pending: 'En attente',
    billTo: 'FACTURER À:',
    shipTo: 'EXPÉDIER À:',
    item: 'Article',
    qty: 'Qté',
    price: 'Prix',
    total: 'Total',
    subtotal: 'Sous-total:',
    shipping: 'Livraison:',
    tax: 'Taxe:',
    grandTotal: 'TOTAL:',
    paymentMethod: 'Mode de paiement:',
    thankYou: 'Merci pour votre confiance!',
    contact: 'Pour toute question, contactez-nous à support@macheglobal.com'
  }
};

const generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { lang = 'en' } = req.query; // Get language from query parameter
    
    // Get translations for selected language
    const t = translations[lang] || translations.en;

    
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name price offer image');

    if (!order) {
      return res.status(404).json({
        status: false,
        message: 'Order not found'
      });
    }

   
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

   
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

 
    doc.pipe(res);

   
    const logoPath = path.join(__dirname, '../../public/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }

 
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(t.invoice, 400, 50, { align: 'right' });

    doc.fontSize(10)
       .font('Helvetica')
       .text('MacheGlobal', 400, 80, { align: 'right' })
       .text('E-commerce Platform', 400, 95, { align: 'right' })
       .text('support@macheglobal.com', 400, 110, { align: 'right' });

  
    doc.moveDown(3);
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(`${t.invoiceNumber}: ${order.orderId}`, 50, 150)
       .font('Helvetica')
       .text(`${t.date}: ${new Date(order.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       })}`, 50, 165)
       .text(`${t.paymentStatus}: ${order.isPaid ? t.paid : t.pending}`, 50, 180);

 
    doc.moveTo(50, 200)
       .lineTo(550, 200)
       .stroke();

 
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(t.billTo, 50, 220);

    doc.fontSize(10)
       .font('Helvetica')
       .text(order.user?.name || 'N/A', 50, 240)
       .text(order.user?.email || 'N/A', 50, 255)
       .text(order.user?.phone || 'N/A', 50, 270);


    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(t.shipTo, 300, 220);

    doc.fontSize(10)
       .font('Helvetica')
       .text(order.shippingAddress?.name || order.user?.name || 'N/A', 300, 240)
       .text(order.shippingAddress?.address || 'N/A', 300, 255)
       .text(`${order.shippingAddress?.city || ''}, ${order.shippingAddress?.country || ''} ${order.shippingAddress?.postalCode || ''}`, 300, 270)
       .text(order.shippingAddress?.phone || order.user?.phone || 'N/A', 300, 285);

   
    const tableTop = 330;
    doc.fontSize(10)
       .font('Helvetica-Bold');

    doc.text(t.item, 50, tableTop)
       .text(t.qty, 300, tableTop, { width: 50, align: 'center' })
       .text(t.price, 370, tableTop, { width: 80, align: 'right' })
       .text(t.total, 470, tableTop, { width: 80, align: 'right' });

    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();

    let yPosition = tableTop + 30;
    doc.font('Helvetica');

    order.orderItems.forEach((item, index) => {
      const productName = item.product?.name || item.name || 'Product';
      const quantity = item.qty || 1;
      const price = item.product?.offer || item.product?.price || item.price || 0;
      const total = price * quantity;

      
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(10)
         .text(productName, 50, yPosition, { width: 230 })
         .text(quantity.toString(), 300, yPosition, { width: 50, align: 'center' })
         .text(`$${price.toFixed(2)}`, 370, yPosition, { width: 80, align: 'right' })
         .text(`$${total.toFixed(2)}`, 470, yPosition, { width: 80, align: 'right' });

      yPosition += 25;
    });

    // Totals Section
    yPosition += 20;
    doc.moveTo(350, yPosition)
       .lineTo(550, yPosition)
       .stroke();

    yPosition += 15;

    // Subtotal
    const subtotal = order.itemsPrice || 0;
    doc.fontSize(10)
       .font('Helvetica')
       .text(t.subtotal, 370, yPosition, { width: 100, align: 'left' })
       .text(`$${subtotal.toFixed(2)}`, 470, yPosition, { width: 80, align: 'right' });

    yPosition += 20;

 
    const shipping = order.shippingPrice || 0;
    doc.text(t.shipping, 370, yPosition, { width: 100, align: 'left' })
       .text(`$${shipping.toFixed(2)}`, 470, yPosition, { width: 80, align: 'right' });

    yPosition += 20;

   
    const tax = order.taxPrice || 0;
    if (tax > 0) {
      doc.text(t.tax, 370, yPosition, { width: 100, align: 'left' })
         .text(`$${tax.toFixed(2)}`, 470, yPosition, { width: 80, align: 'right' });
      yPosition += 20;
    }

  
    doc.moveTo(350, yPosition)
       .lineTo(550, yPosition)
       .strokeColor('#FF7000')
       .lineWidth(2)
       .stroke()
       .strokeColor('#000')
       .lineWidth(1);

    yPosition += 15;

 
    const grandTotal = order.totalPrice || (subtotal + shipping + tax);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(t.grandTotal, 370, yPosition, { width: 100, align: 'left' })
       .fillColor('#FF7000')
       .text(`$${grandTotal.toFixed(2)}`, 470, yPosition, { width: 80, align: 'right' })
       .fillColor('#000');

   
    yPosition += 40;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(t.paymentMethod, 50, yPosition)
       .font('Helvetica')
       .text(order.paymentMethod || 'N/A', 150, yPosition);

   
    doc.fontSize(9)
       .font('Helvetica')
       .text(t.thankYou, 50, 750, { align: 'center', width: 500 })
       .text(t.contact, 50, 765, { align: 'center', width: 500 });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      status: false,
      message: 'Error generating invoice',
      error: error.message
    });
  }
};

module.exports = {
  generateInvoice
};
