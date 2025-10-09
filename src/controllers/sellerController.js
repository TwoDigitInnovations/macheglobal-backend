const SellerStore = require('../models/SellerStore');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const User = require('@models/User');
const mailNotification = require('../services/mailNotification');



cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dzws28zbg',
  api_key: process.env.CLOUDINARY_API_KEY || '475724199792992',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'oOTO5z0dRJ-3gsPhbzH9fEga6ew'
});


const uploadToCloudinary = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'macheglobal/seller-stores',
      resource_type: 'auto'
    });
    return result;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};


const createSellerStore = async (req, res) => {
  try {
   
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id; // Assuming user is authenticated and user ID is in req.user
    const {
      storeName,
      ownerName,
      email,
      phone,
      address,
      city,
      country,
      pincode
    } = req.body;

    // Handle logo upload
    let logoData = {};
    if (req.files?.logo) {
      try {
        const logo = req.files.logo[0];
        console.log('Uploading logo to Cloudinary...');
        
        // Convert buffer to base64
        const base64Data = logo.buffer.toString('base64');
        const dataUri = `data:${logo.mimetype};base64,${base64Data}`;
        
        const result = await cloudinary.uploader.upload(dataUri, {
          folder: 'macheglobal/seller-stores/logos',
          resource_type: 'auto'
        });
        
        console.log('Logo upload result:', {
          url: result.secure_url,
          public_id: result.public_id
        });
        
        logoData = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } catch (error) {
        console.error('Error uploading logo to Cloudinary:', error);
        throw error;
      }
    }

    // Handle document uploads
    const documents = [];
    if (req.files?.documents) {
      for (const doc of req.files.documents) {
        try {
          console.log(`Uploading document (${doc.mimetype}) to Cloudinary...`);
          
          // Convert buffer to base64
          const base64Data = doc.buffer.toString('base64');
          const dataUri = `data:${doc.mimetype};base64,${base64Data}`;
          
          const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'macheglobal/seller-stores/documents',
            resource_type: 'auto'
          });
          
          console.log('Document upload result:', {
            url: result.secure_url,
            public_id: result.public_id
          });
          
          documents.push({
            url: result.secure_url,
            publicId: result.public_id,
            type: doc.mimetype,
            name: doc.originalname || `document-${Date.now()}`
          });
        } catch (error) {
          console.error('Error uploading document to Cloudinary:', error);
          throw error;
        }
      }
    }

    // Create new store
    const store = new SellerStore({
      userId,
      storeName,
      ownerName,
      email,
      phone,
      address,
      city,
      country,
      pincode,
      logo: logoData,
      documents
    });

    await store.save();

    res.status(201).json({
      success: true,
      data: store,
      message: 'Store created successfully. Waiting for admin approval.'
    });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating store',
      error: error.message
    });
  }
};


const getSellerStore = async (req, res) => {
  try {
    const store = await SellerStore.findById(req.params.id)
      .populate('userId', 'name email phone')
      .select('-__v');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching store',
      error: error.message
    });
  }
};


const updateSellerStore = async (req, res) => {
  try {
    const updates = req.body;
    const store = await SellerStore.findById(req.params.id);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if the user owns the store or is an admin
    if (store.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this store'
      });
    }

    // Handle logo update if new logo is provided
    if (req.files?.logo) {
      // Delete old logo from Cloudinary if exists
      if (store.logo?.publicId) {
        await deleteFromCloudinary(store.logo.publicId);
      }
      
      // Upload new logo
      const result = await uploadToCloudinary(req.files.logo[0]);
      updates.logo = {
        url: result.secure_url,
        publicId: result.public_id
      };
    }

    // Handle document updates if new documents are provided
    if (req.files?.documents) {
      // Delete old documents from Cloudinary
      for (const doc of store.documents) {
        if (doc.publicId) {
          await deleteFromCloudinary(doc.publicId);
        }
      }

      // Upload new documents
      const newDocuments = [];
      for (const doc of req.files.documents) {
        const result = await uploadToCloudinary(doc);
        newDocuments.push({
          url: result.secure_url,
          publicId: result.public_id,
          type: doc.mimetype,
          name: doc.originalname
        });
      }
      updates.documents = newDocuments;
    }

    // Update store
    const updatedStore = await SellerStore.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedStore,
      message: 'Store updated successfully'
    });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating store',
      error: error.message
    });
  }
};


const deleteSellerStore = async (req, res) => {
  try {
    const store = await SellerStore.findById(req.params.id);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if the user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this store'
      });
    }

    // Delete logo from Cloudinary if exists
    if (store.logo?.publicId) {
      await deleteFromCloudinary(store.logo.publicId);
    }

    // Delete documents from Cloudinary
    for (const doc of store.documents) {
      if (doc.publicId) {
        await deleteFromCloudinary(doc.publicId);
      }
    }

    // Delete store from database
    await store.remove();

    res.status(200).json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting store',
      error: error.message
    });
  }
};


const getAllSellerStores = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const stores = await SellerStore.find(query)
      .populate('userId', 'name email')
      .select('-__v')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await SellerStore.countDocuments(query);

    res.status(200).json({
      success: true,
      data: stores,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalStores: count
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stores',
      error: error.message
    });
  }
};

// @desc    Update store status (for admin)
// @route   PUT /api/seller/store/:id/status
// @access  Private/Admin
const updateStoreStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: approved, rejected, pending'
      });
    }

    const updateData = { status };
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a store'
      });
    }
    
    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason;
    } else {
      updateData.rejectionReason = '';
    }

    const store = await SellerStore.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Send notification to seller about status update
    if (status === 'approved') {
      try {
        // Find the user associated with this store
        const user = await User.findById(store.userId);
        if (user) {
          // Update user status to verified
          user.status = 'verified';
          await user.save();
          
          // Send verification email
          await mailNotification.sellerVerified({
            name: user.name,
            email: user.email
          });
        }
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Don't fail the request if email sending fails
      }
    }

    res.status(200).json({
      success: true,
      data: store,
      message: `Store ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating store status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating store status',
      error: error.message
    });
  }
};

// @desc    Get all active sellers
// @route   GET /api/seller/active
// @access  Public
const getActiveSellers = async (req, res) => {
  try {
    const sellers = await SellerStore.find({ status: 'approved' })
      .select('storeName ownerName email phone address city country pincode logo')
      .lean();

    res.status(200).json({
      success: true,
      count: sellers.length,
      data: sellers
    });
  } catch (error) {
    console.error('Error fetching active sellers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

module.exports = {
  createSellerStore,
  getSellerStore,
  updateSellerStore,
  deleteSellerStore,
  getAllSellerStores,
  updateStoreStatus,
  getActiveSellers
};
