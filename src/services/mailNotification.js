const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'Macheglobal2026@gmail.com',
    pass: 'czygnhtdtahujirh' 
  }
});

const sendMail = async (to, subject, html) => {
  return new Promise((resolve, reject) => {
    if (!to) {
      console.error('No recipient email address provided');
      return reject(new Error('No recipient email address'));
    }

    const mailConfigurations = {
      from: `Mache Global <Macheglobal2026@gmail.com>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      // Add more debugging info
      headers: {
        'X-Mailer': 'Mache Global Mailer',
        'X-Priority': '1',
        'X-MSMail-Priority': 'High'
      }
    };

    console.log('Attempting to send email:', {
      to: mailConfigurations.to,
      subject,
      time: new Date().toISOString()
    });

    transporter.sendMail(mailConfigurations, function (error, info) {
      if (error) {
        console.error('Email send error:', {
          error: error.message,
          code: error.code,
          to,
          time: new Date().toISOString()
        });
        return reject(error);
      }
      // 
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to,
        time: new Date().toISOString()
      });
      return resolve(info);
    });
  });
};

module.exports = {
  welcomeMail: async (user) => {
    try {
      console.log('Sending welcome email to:', user.email);

      const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; padding: 30px; border: 1px solid #ddd;">
          <div style="text-align: center;">
            <h2 style="color: #127300;">Welcome to Jasz & Co!</h2>
            <p style="color: #555; font-size: 15px;">We're excited to have you join us!</p>
          </div>

          <p>Dear ${user.name} ,</p>

          <p>Thank you for creating your account with <strong>Jasz & Co</strong>. We’re happy to be your trusted place for quality and service.</p>

          <p><strong>Your registered email:</strong> ${user.email}</p>

          <div style="background-color: #e9f8ec; padding: 15px; border-left: 4px solid #127300; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0;">Explore a seamless shopping experience with us!</p>
          </div>

          <p>If you need any help, feel free to contact our team.</p>

          <p style="margin-top: 25px;">Warm regards,<br/><strong style="color: #127300;">The Jasz & Co Team</strong></p>

          <div style="margin-top: 40px; font-size: 12px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </div>`;

      await sendMail(user.email, 'Welcome to Jasz & Co!', html);
    } catch (err) {
      console.error('Error sending welcome email:', err);
      throw new Error('Failed to send welcome email');
    }
  },

  sendOTPmail: async ({ email, code }) => {
    try {
      const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #FF7000; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Mache Global</h1>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0; text-align: center;">Email Verification</h2>
            <p style="color: #555; line-height: 1.6;">Hello,</p>
            <p style="color: #555; line-height: 1.6;">Thank you for choosing Mache Global. Please use the following OTP to verify your email address:</p>
            
            <div style="background-color: #f5f5f5; border-left: 4px solid #FF7000; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <div style="font-size: 28px; font-weight: bold; color: #FF7000; text-align: center; letter-spacing: 5px;">${code}</div>
            </div>
            
            <p style="color: #777; font-size: 14px; margin-bottom: 25px;">This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="margin: 0; color: #999; font-size: 12px;">If you didn't request this email, you can safely ignore it.</p>
            </div>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Mache Global. All rights reserved.</p>
          </div>
        </div>
      </div>`;

      return await sendMail(email, 'Your OTP Code - Mache Global', html);
    } catch (err) {
      console.error(err);
      throw new Error('Could not send OTP mail');
    }
  },

  passwordChange: async ({ email }) => {
    try {
      const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; padding: 30px; border: 1px solid #ddd;">
          <h2 style="color: #127300;">Password Changed</h2>
          <p>Hello ${email},</p>
          <p>Your password was recently changed.</p>
          <p>If this wasn’t you, please contact our support team immediately.</p>
          <p style="margin-top: 25px;">Regards,<br/><strong style="color: #127300;">The Jasz & Co Team</strong></p>
        </div>
      </div>`;

      return await sendMail(
        email,
        'Password Change Notification - Jasz & Co',
        html
      );
    } catch (err) {
      throw new Error('Could not send password change mail');
    }
  },

  sellerVerified: async (seller) => {
    try {
      const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #FF7000; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Mache Global</h1>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0; text-align: center;">Account Verified Successfully!</h2>
            <p style="color: #555; line-height: 1.6;">Dear ${seller.name || 'Valued Seller'},</p>
            
            <p style="color: #555; line-height: 1.6;">We are pleased to inform you that your seller account has been successfully verified by our team.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #e8f5e9; border-radius: 50%; width: 80px; height: 80px; text-align: center; line-height: 80px;">
                <span style="color: #4caf50; font-size: 40px;">✓</span>
              </div>
            </div>
            
            <p style="color: #555; line-height: 1.6;">You can now access your seller dashboard and start listing your products.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${'https://www.seller.macheglobal.com/login'}" 
                 style="display: inline-block; background-color: #FF7000; color: white; 
                        text-decoration: none; padding: 12px 30px; border-radius: 4px; 
                        font-weight: bold; font-size: 16px;">
                Go to Seller Dashboard
              </a>
            </div>
            
            <p style="color: #777; font-size: 14px; margin-top: 30px;">
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Mache Global. All rights reserved.</p>
          </div>
        </div>
      </div>`;

      return await sendMail(seller.email, 'Your Seller Account is Now Active - Mache Global', html);
    } catch (err) {
      console.error('Error sending seller verification email:', err);
      throw new Error('Could not send seller verification email');
    }
  },

  orderDelivered: async ({ email, orderId }) => {
    try {
      const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #FF7000; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Mache Global</h1>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0; text-align: center;">Your Order Has Been Delivered</h2>
            <p style="color: #555; line-height: 1.6;">Hello,</p>
            <p style="color: #555; line-height: 1.6;">Your order with Order ID: <strong>${orderId}</strong> has been successfully delivered.</p>

            <div style="background-color: #fff8e1; padding: 15px; border-left: 4px solid #FFC107; border-radius: 4px; margin: 20px 0;">
              <p style="color: #333; font-weight: bold; margin-top: 0;">Need Help?</p>
              <ul style="color: #666; padding-left: 20px; margin-bottom: 0;">
                <li>If you find any issue with your order, please email us within <strong>24 hours</strong>.</li>
                <li>Attach any relevant photos or videos to speed up the resolution.</li>
                <li><strong>Note:</strong> We do not accept returns for perishable items.</li>
              </ul>
            </div>

            <p style="color: #555; line-height: 1.6; margin-top: 25px;">Thank you for shopping with us!</p>
            <p style="color: #555; line-height: 1.6;"><strong style="color: #FF7000;">Mache Global Team</strong></p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Mache Global. All rights reserved.</p>
          </div>
        </div>
      </div>`;

      return await sendMail(email, `Order Delivered - ID: ${orderId}`, html);
    } catch (err) {
      console.error('Error sending delivery email:', err);
      throw new Error('Could not send delivery notification');
    }
  },
  wholesaleApplicationAdmin: async (WholesaleData) => {
    try {
      const wholesaleData = WholesaleData.WholesaleData;

      const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
      <div style="max-width: 650px; margin: auto; background: #fff; border-radius: 12px; padding: 30px; border: 1px solid #e5e5e5;">
        
        <h2 style="color: #c43b00; text-align: center; margin-bottom: 20px;">
          New Wholesale Application Submitted
        </h2>
        
        <p style="font-size: 15px; color: #333;">
          A new wholesale application has been received. Please review the applicant’s details below:
        </p>

        <h3 style="margin-top: 25px; color: #c43b00; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
          Applicant Information
        </h3>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Full Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Company Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Address</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.address}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">EIN</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.EIN}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">State Tax License</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.stateTaxLicense}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Phone Number</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.phoneNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Email</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #fff6f4;">Items of Interest</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.itemsOfInterest?.join(', ')}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 25px; padding: 15px; background: #fff1ef; border-left: 4px solid #c43b00; border-radius: 6px; font-size: 14px; color: #333;">
          <strong>Action Required:</strong>
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            <li>Log in to the <strong>Admin Dashboard</strong> to review this application.</li>
            <li>Verify the provided documents and details.</li>
            <li>Update the application status to <em>Under Review, Approved, or Rejected</em>.</li>
          </ul>
        </div>

        <p style="margin-top: 25px; font-size: 14px; color: #555;">
          This is an automated notification. Please take necessary action at the earliest.
        </p>

        <p style="margin-top: 15px; font-weight: bold; color: #c43b00;">
          Jasz & Co System Notification
        </p>
      </div>
    </div>`;

      return await sendMail(
        'Rishabhtiwari73096@gmail.com',
        `New Wholesale Application - ${wholesaleData?.companyName}`,
        html
      );
    } catch (err) {
      console.error('Error sending admin wholesale email:', err);
      throw new Error(
        'Could not send wholesale application notification to admin'
      );
    }
  },
  wholesaleApplicationReceived: async (WholesaleData) => {
    try {
      const wholesaleData = WholesaleData.WholesaleData;
      const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 650px; margin: auto; background: #fff; border-radius: 12px; padding: 30px; border: 1px solid #e5e5e5;">
        
        <h2 style="color: #127300; text-align: center; margin-bottom: 20px;">
          Wholesale Application Received
        </h2>
        
        <p style="font-size: 15px; color: #333;">Dear <strong>${wholesaleData?.name}</strong>,</p>
        <p style="font-size: 15px; color: #333;">
          Thank you for submitting your wholesale application. Our team will review the details provided and get back to you within 
          <strong>3–5 business days</strong>.
        </p>

        <h3 style="margin-top: 25px; color: #127300; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
          Application Details
        </h3>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Full Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Company Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Address</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.address}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">EIN</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.EIN}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">State Tax License</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.stateTaxLicense}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Phone Number</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.phoneNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Email</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Items of Interest</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${wholesaleData?.itemsOfInterest?.join(', ')}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 25px; padding: 15px; background: #e9f8ec; border-left: 4px solid #127300; border-radius: 6px; font-size: 14px; color: #333;">
          <strong>Next Steps:</strong>
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            <li>Our team will review your application carefully.</li>
            <li>You may receive a call or email for verification if needed.</li>
            <li>Once approved, we will share wholesale pricing and terms.</li>
          </ul>
        </div>

        <p style="margin-top: 25px; font-size: 14px; color: #555;">
          Thank you for your interest in partnering with us.  
          <br/>We look forward to building a successful business relationship.
        </p>

        <p style="margin-top: 15px; font-weight: bold; color: #127300;">
          Jasz & Co Team
        </p>
      </div>
    </div>`;

      return await sendMail(
        wholesaleData?.email,
        `Wholesale Application Received - ${wholesaleData?.companyName}`,
        html
      );
    } catch (err) {
      console.error('Error sending wholesale email:', err);
      throw new Error('Could not send wholesale application confirmation');
    }
  }
};
