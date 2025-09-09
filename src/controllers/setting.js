const Setting = require('@models/setting');

module.exports = {
  getSetting: async (req, res) => {
    try {
      const notifications = await Setting.find({}).populate(
        'carousel.Category'
      );
      res.status(200).json({
        success: true,
        message: 'Fetched all carosal successfully',
        setting: notifications
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message
      });
    }
  },

  createOrUpdateImage: async (req, res) => {
    try {
      const payload = req.body;
      let setting = await Setting.findOneAndUpdate({}, payload, {
        new: true,
        upsert: true
      });

      return res.status(201).json({
        success: true,
        message: 'Images saved/updated successfully!',
        data: setting
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message
      });
    }
  },

  createOrUpdateContactInfo: async (req, res) => {
    try {
      const { Address, MobileNo } = req.body;
      const setting = await Setting.findOneAndUpdate(
        {},
        {
          $set: {
            ...(Address !== undefined && { Address }),
            ...(MobileNo !== undefined && { MobileNo })
          }
        },
        { new: true, upsert: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Contact Info updated successfully!',
        data: setting
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message
      });
    }
  },
  createOrUpdateShippingKeyInfo: async (req, res) => {
    try {
      const { ApiSecretKey, ApiPrivateKey } = req.body;
      const setting = await Setting.findOneAndUpdate(
        {},
        {
          $set: {
            ...(ApiSecretKey !== undefined && { ApiSecretKey }),
            ...(ApiPrivateKey !== undefined && { ApiPrivateKey })
          }
        },
        { new: true, upsert: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Shipping Api Key updated successfully!',
        data: setting
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: e.message
      });
    }
  }
};
