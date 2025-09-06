const express = require('express');

const {
  contactUs,
  getAllContactUs,
  updateStatus
} = require('@controllers/contactUs');

const { authenticate } = require('@middlewares/authMiddleware');
const user = require('@controllers/user');
const upload = require('@services/upload');
const favourite = require('@controllers/Favorite');
const Content = require('@controllers/ContentManagement');
const setting = require('@controllers/setting');

const router = express.Router();

router.post('/fileupload', upload.single('file'), user.fileUpload);
router.post('/contactUs', contactUs);
router.post('/getContactUs', getAllContactUs);
router.post('/updateStatus', updateStatus);
router.post('/addremovefavourite', authenticate, favourite.AddFavourite);
router.get('/getFavourite', authenticate, favourite.getFavourite);
router.post('/giverate', user.giverate);
router.post('/getReview', authenticate, user.getReview);
router.delete('/deleteReview/:id', user.deleteReview);

router.post('/createContent', authenticate, Content.createContent);
router.get('/getContent', Content.getContent);
router.post('/update', authenticate, Content.updateContent);

router.get('/getUserList', user.getUserList);
router.get('/getsetting', setting.getSetting);
router.post('/createOrUpdateImage', authenticate, setting.createOrUpdateImage);

module.exports = router;
