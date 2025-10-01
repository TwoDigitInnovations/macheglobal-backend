const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary
 * @param {Object|String} file 
 * @param {String} folder 
 * @returns {Promise<Object>}
 */
const uploadToCloudinary = async (file, folder = 'macheglobal/categories') => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

   
    const filePath = typeof file === 'string' ? file : file.path;
    
    if (!filePath) {
      throw new Error('No file path provided');
    }


    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

  
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });

  
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }

    return {
      url: result.secure_url || result.url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Public ID of the file in Cloudinary
 * @returns {Promise<Object>} - Delete result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error('No public ID provided');
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {Array} publicIds - Array of public IDs to delete
 * @returns {Promise<Array>} - Array of delete results
 */
const deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return [];
    }

    const deletePromises = publicIds.map(publicId => 
      deleteFromCloudinary(publicId).catch(error => ({
        publicId,
        success: false,
        error: error.message
      }))
    );

    return Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting multiple files from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary
};
