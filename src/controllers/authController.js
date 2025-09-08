const User = require('@models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const response = require('../../responses');
const Verification = require('@models/verification');
const userHelper = require('../helper/user');
const mailNotification = require('./../services/mailNotification');
const SellerWallet = require("../models/SellerWallet");
const AdminWallet = require("../models/AdminWallet")

module.exports = {
  register: async (req, res) => {
    try {
      const { name, email, password, phone, role } = req.body;

      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: 'Password must be at least 6 characters long' });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        role
      });

      await newUser.save();

      if (role === "Admin") {
        const existingAdminWallet = await AdminWallet.findOne();
        if (!existingAdminWallet) {
          await AdminWallet.create({
            balance: 0,
            transactions: []
          });
        }
      }

      const userResponse = await User.findById(newUser._id).select('-password');

      res.status(201).json({ message: 'User registered successfully', user: userResponse });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }


      if (user.role === "Seller") {
        if (user.status === "pending") {
          return res.status(403).json({ message: "Please wait until your account is verified by admin." });
        }
        if (user.status === "suspend") {
          return res.status(403).json({ message: "Your account has been suspended. Contact support." });
        }
      }


      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return response.ok(res, {
        message: "Login successful",
        token,
        user
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error" });
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
      const { email, firstName, lastName } = req.body;

      const user = await User.findOne({ email });

      if (!user) {
        return response.badReq(res, { message: 'Email does not exist.' });
      }

      const fullNameFromRequest = `${firstName} ${lastName}`
        .trim()
        .toLowerCase();
      const fullNameFromDB = user.name?.trim().toLowerCase();
      console.log('fullNameFromRequest', fullNameFromRequest);
      console.log('fullNameFromDB', fullNameFromDB);
      if (fullNameFromRequest !== fullNameFromDB) {
        return response.badReq(res, {
          message: 'Name and email do not match our records.'
        });
      }

      let ran_otp = Math.floor(1000 + Math.random() * 9000);

      await mailNotification.sendOTPmail({
        code: ran_otp,
        email: email
      });

      const ver = new Verification({
        email: email,
        user: user._id,
        otp: ran_otp,
        expiration_at: userHelper.getDatewithAddedMinutes(5)
      });

      await ver.save();
      const token = await userHelper.encode(ver._id);

      return response.ok(res, { message: 'OTP sent.', token });
    } catch (error) {
      return response.error(res, error);
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const otp = req.body.otp;
      const token = req.body.token;
      if (!(otp && token)) {
        return response.badReq(res, { message: 'OTP and token required.' });
      }
      let verId = await userHelper.decode(token);
      let ver = await Verification.findById(verId);
      if (
        otp == ver.otp &&
        !ver.verified &&
        new Date().getTime() < new Date(ver.expiration_at).getTime()
      ) {
        let token = await userHelper.encode(
          ver._id + ':' + userHelper.getDatewithAddedMinutes(5).getTime()
        );
        ver.verified = true;
        await ver.save();
        return response.ok(res, { message: 'OTP verified', token });
      } else {
        return response.notFound(res, { message: 'Invalid OTP' });
      }
    } catch (error) {
      return response.error(res, error);
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
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id; // middleware से मिल रहा है

      if (!currentPassword || !newPassword) {
        return response.error(res, "Old password and new password are required");
      }

      let user = await User.findById(userId);

      if (!user) {
        return response.error(res, "User not found");
      }

      // Purana password check karo
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return response.error(res, "Old password is incorrect");
      }

      // New password encrypt karke save karo
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      return response.ok(res, {
        message: "Password changed successfully",
        role: user.role
      });
    } catch (error) {
      return response.error(res, error.message || "Something went wrong");
    }
  }

};
