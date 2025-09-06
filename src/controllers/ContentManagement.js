const Content = require('@models/ContentManagment');
const response = require('./../../responses');

exports.createContent = async (req, res) => {
  try {
    const { policy } = req.body;

    const existingContent = await Content.findOne();

    if (existingContent) {
      const updatedContent = await Content.findOneAndUpdate(
        {},
        { policy },
        { new: true }
      );

      return res.status(200).json({
        message: 'Content updated successfully',
        data: updatedContent
      });
    }

    const newContent = new Content({
      policy
    });

    await newContent.save();
    res.status(201).json({
      message: 'Content created successfully',
      data: newContent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getContent = async (req, res) => {
  try {
    const content = await Content.find();
    if (!content) {
      return res
        .status(404)
        .json({ message: 'Content not found. Please create content first.' });
    }
    return response.ok(res, content);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.updateContent = async (req, res) => {
  try {
    const { policy, id } = req.body;

    const updatedContent = await Content.findByIdAndUpdate(
      id,
      { policy },
      { new: true }
    );
    if (!updatedContent) {
      return res.status(404).json({ message: 'Content not found' });
    }
    res
      .status(200)
      .json({ message: 'Content updated successfully', data: updatedContent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
