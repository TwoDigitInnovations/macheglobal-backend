const Contact = require('@models/contactUs');
const response = require('../../responses');

module.exports = {
  contactUs: async (req, res) => {
    try {
      const { name, Email, subject, message } = req.body;
      const newContact = new Contact({ name, Email, subject, message });
      await newContact.save();
      return response.ok(res, { message: 'Contact submitted successfully' });
    } catch (error) {
      return response.error(res, error);
    }
  },

  getAllContactUs: async (req, res) => {
    try {
      let cond = {};

      if (req.body.curDate) {
        const startDate = new Date(req.body.curDate);
        const endDate = new Date(
          new Date(req.body.curDate).setDate(startDate.getDate() + 1)
        );
        cond.createdAt = { $gte: startDate, $lte: endDate };
      }

      if (req.body.name) {
        const name = req.body.name.substring(0, 3);
        cond.name = { $regex: '^' + name, $options: 'i' };
      }

      if (req.body.Email) {
        cond.Email = { $regex: req.body.Email, $options: 'i' };
      }

      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 10;
      let skip = (page - 1) * limit;

      const totalItems = await Contact.countDocuments(cond);
      const totalPages = Math.ceil(totalItems / limit);

      const feedback = await Contact.find(cond)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return res.status(200).json({
        status: true,
        data: feedback,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      return response.error(res, error);
    }
  },
  updateStatus: async (req, res) => {
    try {
      const { id, status } = req.body;
      if (!id || !status) {
        return res
          .status(400)
          .json({ status: false, message: 'ID and status are required.' });
      }
      const validStatuses = ['pending', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ status: false, message: 'Invalid status value.' });
      }
      const updatedContact = await Contact.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
      if (!updatedContact) {
        return res
          .status(404)
          .json({ status: false, message: 'Contact not found.' });
      }
      return res.status(200).json({
        status: true,
        message: 'Status updated successfully',
        data: updatedContact
      });
    } catch (error) {
      console.error('Update Status Error:', error);
      return res
        .status(500)
        .json({ status: false, message: 'Server error', error: error.message });
    }
  }
};
