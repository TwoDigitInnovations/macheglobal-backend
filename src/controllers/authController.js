const User = require('@models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const response = require('../../responses');
const Verification = require('@models/verification');
const userHelper = require('../helper/user');
const mailNotification = require('./../services/mailNotification');
const AdminWallet = require('../models/AdminWallet');

module.exports = {
  register: async (req, res, next) => {
    try {
      const { name, email, password, phone, role } = req.body;

      // Input validation
      if (!name || !email || !password || !phone || !role) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const newUser = new User({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        role: role.charAt(0).toUpperCase() + role.slice(1), // Capitalize first letter
        isActive: true
      });

      // Save user to database
      await newUser.save();

      // Create admin wallet if user is admin
      if (newUser.role === 'Admin') {
        const existingAdminWallet = await AdminWallet.findOne();
        if (!existingAdminWallet) {
          await AdminWallet.create({
            balance: 0,
            transactions: []
          });
        }
      }

      // Get user data without password
      const userResponse = await User.findById(newUser._id).select('-password');

      // Return success response
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: userResponse
      });

    } catch (error) {
      console.error('Registration error:', error);
      // Pass error to express error handler
      next(error);
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required' });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // For sellers, we'll include the user data in the response regardless of status
      // This allows the frontend to handle the navigation appropriately
      if (user.role === 'Seller') {
        if (user.status === 'suspend') {
          return res.status(403).json({
            message: 'Your account has been suspended. Contact support.'
          });
        }
        
        // For pending sellers, include the user data in the response
        // so the frontend can still navigate to the SellerStore
        if (user.status === 'pending') {
          const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
          );
          
          // Remove password from the user object
          const userData = user.toObject();
          delete userData.password;
          
          return res.json({
            success: true,
            message: 'Please wait until your account is verified by admin.',
            token,
            user: userData,
            status: 'pending'
          });
        }
      }

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return response.ok(res, {
        message: 'Login successful',
        token,
        user
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  getUser: async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res
          .status(400)
          .json({ status: false, message: 'User ID is required' });
      }

      const user = await User.findById(userId).select('-password');

      if (!user) {
        return res
          .status(404)
          .json({ status: false, message: 'User not found' });
      }

      res.status(200).json({
        status: true,
        message: 'User profile fetched successfully',
        data: user
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: error.message || 'Internal Server Error'
      });
    }
  },

  sendOTP: async (req, res) => {
    try {
      console.log('sendOTP request received:', req.body);
      const { email, firstName, lastName } = req.body;

      if (!email || !firstName || !lastName) {
        console.error('Missing required fields in request');
        return response.badReq(res, { 
          message: 'Email, first name, and last name are required.' 
        });
      }

      const user = await User.findOne({ email });

      if (!user) {
        console.error('User not found for email:', email);
        return response.badReq(res, { 
          message: 'Email does not exist.' 
        });
      }

      const fullNameFromRequest = `${firstName} ${lastName}`.trim().toLowerCase();
      const fullNameFromDB = user.name?.trim().toLowerCase();
      
      console.log('Name validation:', {
        fullNameFromRequest,
        fullNameFromDB,
        user: user.name
      });
      
      if (fullNameFromRequest !== fullNameFromDB) {
        console.error('Name mismatch:', { fullNameFromRequest, fullNameFromDB });
        return response.badReq(res, {
          message: 'Name and email do not match our records.'
        });
      }

      const ran_otp = Math.floor(1000 + Math.random() * 9000);
      console.log('Generated OTP:', ran_otp, 'for email:', email);

      try {
        console.log('Attempting to send OTP email to:', email);
        await mailNotification.sendOTPmail({
          code: ran_otp,
          email: email
        });
        console.log('OTP email sent successfully to:', email);
      } catch (emailError) {
        console.error('Error sending OTP email:', emailError);
        return response.error(res, {
          message: 'Failed to send OTP. Please try again.',
          error: emailError.message
        });
      }

      const ver = new Verification({
        email: email,
        user: user._id,
        otp: ran_otp,
        expiration_at: userHelper.getDatewithAddedMinutes(5)
      });

      try {
        await ver.save();
        console.log('OTP saved to database for email:', email);
      } catch (dbError) {
        console.error('Error saving OTP to database:', dbError);
        return response.error(res, {
          message: 'Error processing your request. Please try again.',
          error: dbError.message
        });
      }

      const token = await userHelper.encode(ver._id);
      console.log('OTP process completed successfully for email:', email);
      
      return response.ok(res, { 
        message: 'OTP sent successfully.',
        token,
        // For development/testing only - remove in production
        debug: { otp: ran_otp }
      });
    } catch (error) {
      console.error('Unexpected error in sendOTP:', error);
      return response.error(res, {
        message: 'An unexpected error occurred. Please try again.',
        error: error.message
      });
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const { otp, token } = req.body;
      
      if (!otp || !token) {
        console.log('Missing OTP or token:', { otp: !!otp, token: !!token });
        return response.badReq(res, { 
          success: false,
          message: 'OTP and token are required.' 
        });
      }
      
      try {
        // Decode the token to get the verification ID
        const verId = await userHelper.decode(token);
        console.log('Decoded verification ID:', verId);
        
        // Find the verification record and ensure it has the required fields
        const ver = await Verification.findById(verId);
        
        if (!ver) {
          console.log('Verification record not found for ID:', verId);
          return response.badReq(res, { 
            success: false,
            message: 'Invalid or expired verification. Please request a new OTP.' 
          });
        }
        
        // Log the complete verification record for debugging
        console.log('Verification record details:', {
          id: ver._id,
          email: ver.email,
          user: ver.user,
          verified: ver.verified,
          expiresAt: ver.expiration_at,
          currentTime: new Date()
        });
        
        // Ensure the verification record has the required fields
        if (!ver.email) {
          console.error('Verification record is missing email:', ver);
          return response.badReq(res, { 
            success: false,
            message: 'Invalid verification record (missing email). Please request a new OTP.'
          });
        }
        
        console.log('Verification record found:', {
          storedOTP: ver.otp,
          receivedOTP: otp,
          isVerified: ver.verified,
          expiresAt: ver.expiration_at,
          currentTime: new Date(),
          isExpired: new Date() > new Date(ver.expiration_at)
        });
        
        // Check if OTP is valid and not expired
        if (ver.otp !== otp) {
          console.log('OTP mismatch');
          return response.badReq(res, { 
            success: false,
            message: 'Invalid OTP. Please check and try again.' 
          });
        }
        
        if (ver.verified) {
          console.log('OTP already used');
          return response.badReq(res, { 
            success: false,
            message: 'This OTP has already been used. Please request a new one.' 
          });
        }
        
        if (new Date() > new Date(ver.expiration_at)) {
          console.log('OTP expired');
          return response.badReq(res, { 
            success: false,
            message: 'OTP has expired. Please request a new one.' 
          });
        }
        
        // Mark OTP as verified
        ver.verified = true;
        await ver.save();
        
        // Generate a new encoded token for the verification ID
        const newToken = await userHelper.encode(ver._id.toString());
        console.log('OTP verified successfully');
        return response.ok(res, { 
          success: true,
          message: 'OTP verified successfully',
          token: newToken // Return the encoded verification ID
        }); 
      } catch (decodeError) {
        console.error('Error decoding token or verifying OTP:', decodeError);
        return response.badReq(res, { 
          success: false,
          message: 'Invalid verification token. Please request a new OTP.'
        });
      }
    } catch (error) {
      console.error('Unexpected error in verifyOTP:', error);
      return response.error(res, { 
        success: false,
        message: 'An error occurred while verifying OTP. Please try again.' 
      });
    }
  },

  changePassword: async (req, res) => {
    try {
      const token = req.body.token;
      const password = req.body.password;
      const data = await userHelper.decode(token);
      const [verID, date] = data.split(':');
      if (new Date().getTime() > new Date(date).getTime()) {
        return response.forbidden(res, { message: 'Session expired.' });
      }
      let otp = await Verification.findById(verID);
      if (!otp?.verified) {
        return response?.forbidden(res, { message: 'unAuthorize' });
      }
      let user = await User.findById(otp.user);
      if (!user) {
        return response.forbidden(res, { message: 'unAuthorize' });
      }
      await Verification.findByIdAndDelete(verID);
      user.password = user.encryptPassword(password);
      await user.save();
      mailNotification.passwordChange({ email: user.email });
      return response.ok(res, { message: 'Password changed ! Login now.' });
    } catch (error) {
      return response.error(res, error);
    }
  },

  updateProfile: async (req, res) => {
    try {
      const { userId, ...updateData } = req.body;

      if (!userId) {
        return res
          .status(400)
          .json({ status: false, message: 'User ID is required' });
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true
      }).select('-password');

      if (!updatedUser) {
        return res
          .status(404)
          .json({ status: false, message: 'User not found' });
      }

      return res.status(200).json({
        status: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  changePasswordfromAdmin: async (req, res) => {
    try {
      const { userId, newPassword, confirmPassword } = req.body;

      if (!userId || !newPassword || !confirmPassword) {
        return response.badRequest(res, 'All fields are required');
      }

      if (newPassword !== confirmPassword) {
        return response.badRequest(res, 'Passwords do not match');
      }

      const user = await User.findById(userId);
      if (!user) {
        return response.notFound(res, 'User not found');
      }

      // Check if new password is same as old password
      const isMatch = await bcrypt.compare(newPassword, user.password);
      if (isMatch) {
        return response.badRequest(res, 'New password cannot be same as old password');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return response.ok(res, {
        message: 'Password changed successfully',
        role: user.role
      });
    } catch (error) {
      return response.error(res, error.message || 'Something went wrong');
    }
  },

  // Forgot Password - Send OTP
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal that the email doesn't exist for security reasons
        console.log(`Password reset attempt for non-existent email: ${email}`);
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email, an OTP has been sent',
          data: { email }
        });
      }

      // Generate a secure 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

      try {
        // Send OTP via email
        await mailNotification.sendOTPmail({
          email: user.email,
          code: otp,
          name: user.name || 'User'
        });
        
        console.log(`OTP sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again.'
        });
      }

      // First, delete any existing verification records for this email
      await Verification.deleteMany({ email: user.email });
      
      // Create a new verification record with all required fields
      const ver = new Verification({
        email: user.email, // Ensure email is included
        user: user._id,
        otp: otp,
        verified: false,
        expiration_at: userHelper.getDatewithAddedMinutes(10) // 10 minutes expiry
      });
      
      // Log the verification record before saving
      console.log('Creating verification record:', {
        email: ver.email,
        user: ver.user,
        otp: ver.otp,
        verified: ver.verified,
        expiresAt: ver.expiration_at
      });
      
      // Save the verification record
      await ver.save();
      
      // Log the saved verification record
      console.log('Verification record saved:', {
        id: ver._id,
        email: ver.email,
        user: ver.user,
        verified: ver.verified
      });
      
      // Generate a token for OTP verification
      const token = await userHelper.encode(ver._id.toString());
      console.log('Generated verification token:', token);

      return res.status(200).json({
        success: true,
        message: 'OTP has been sent to your email',
        data: { 
          email,
          token, // Include the token in the response
          // For development/testing only - remove in production
          ...(process.env.NODE_ENV !== 'production' ? { otp } : {})
        }
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while processing your request',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Verify OTP and Reset Password
  resetPassword: async (req, res) => {
    try {
      const { otp, newPassword, token } = req.body;
      console.log('Reset password request received:', { otp, newPassword: !!newPassword, hasToken: !!token });

      if (!otp || !newPassword || !token) {
        return res.status(400).json({
          success: false,
          message: 'OTP, new password, and verification token are required'
        });
      }

      // Decode the token to get the verification ID
      let verificationId;
      try {
        verificationId = await userHelper.decode(token);
        console.log('Decoded verification ID:', verificationId);
      } catch (error) {
        console.error('Error decoding token:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid verification token. Please request a new OTP.'
        });
      }
      
      // Find the verification record
      const verification = await Verification.findById(verificationId);
      
      if (!verification) {
        console.log('Verification record not found for ID:', verificationId);
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification. Please request a new OTP.'
        });
      }

      // Log the verification record to debug
      console.log('Verification record:', {
        id: verification._id,
        email: verification.email,
        userId: verification.user,
        verified: verification.verified,
        expiresAt: verification.expiration_at
      });
      
      // Try to find user by user ID first, then fall back to email
      let user = null;
      
      if (verification.user) {
        user = await User.findById(verification.user);
        if (user) {
          console.log('Found user by ID:', user.email);
        }
      }
      
      // If user not found by ID, try by email
      if (!user && verification.email) {
        user = await User.findOne({ email: verification.email });
        if (user) {
          console.log('Found user by email:', user.email);
        }
      }
      
      if (!user) {
        console.log('User not found for verification record:', {
          userId: verification.user,
          email: verification.email
        });
        return res.status(400).json({
          success: false,
          message: 'User not found. Please try the password reset process again.'
        });
      }

      console.log('Verification record found:', {
        storedOTP: verification.otp,
        receivedOTP: otp,
        isVerified: verification.verified,
        expiresAt: verification.expiration_at,
        currentTime: new Date(),
        isExpired: new Date() > new Date(verification.expiration_at)
      });

      // Verify OTP
      if (verification.otp !== otp) {
        console.log('OTP mismatch');
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      // Check if OTP is verified
      if (!verification.verified) {
        console.log('OTP not verified');
        return res.status(400).json({
          success: false,
          message: 'Please verify the OTP first before resetting the password.'
        });
      }

      // Check if OTP is expired
      if (new Date() > new Date(verification.expiration_at)) {
        console.log('OTP expired');
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }

      try {
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user's password and clear reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        
        await user.save();
        
        // Delete the verification record
        await Verification.findByIdAndDelete(verification._id);
        
        console.log('Password reset successful for user:', verification.email);
        return res.status(200).json({
          success: true,
          message: 'Password has been reset successfully. You can now login with your new password.'
        });
      } catch (error) {
        console.error('Error saving new password:', error);
        throw new Error('Failed to update password');
      }

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while resetting your password. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};
