const Address = require('../models/Address');
const ErrorResponse = require('../utils/errorResponse');

exports.getAddresses = async (req, res, next) => {
    try {
        const addresses = await Address.find({ user: req.user.id }).sort({ isDefault: -1, createdAt: -1 });
        res.status(200).json({
            success: true,
            count: addresses.length,
            data: addresses
        });
    } catch (error) {
        next(error);
    }
};


exports.getAddress = async (req, res, next) => {
    try {
        const address = await Address.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!address) {
            return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            data: address
        });
    } catch (error) {
        next(error);
    }
};


exports.createAddress = async (req, res, next) => {
    try {
       
        req.body.user = req.user.id;

       
        if (req.body.isDefault) {
            await Address.updateMany(
                { user: req.user.id },
                { $set: { isDefault: false } }
            );
        }

        const address = await Address.create(req.body);

        res.status(201).json({
            success: true,
            data: address
        });
    } catch (error) {
        next(error);
    }
};


exports.updateAddress = async (req, res, next) => {
    try {
        let address = await Address.findById(req.params.id);

        if (!address) {
            return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
        }

       
        if (address.user.toString() !== req.user.id) {
            return next(new ErrorResponse(`Not authorized to update this address`, 401));
        }

      
        if (req.body.isDefault) {
            await Address.updateMany(
                { user: req.user.id, _id: { $ne: req.params.id } },
                { $set: { isDefault: false } }
            );
        }

        address = await Address.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: address
        });
    } catch (error) {
        next(error);
    }
};


exports.deleteAddress = async (req, res, next) => {
    try {
        const address = await Address.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!address) {
            return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
        }

        // Delete the address
        await Address.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};


exports.setDefaultAddress = async (req, res, next) => {
    try {
        const address = await Address.findById(req.params.id);

        if (!address) {
            return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
        }

        
        if (address.user.toString() !== req.user.id) {
            return next(new ErrorResponse(`Not authorized to update this address`, 401));
        }

      
        await Address.updateMany(
            { user: req.user.id },
            { $set: { isDefault: false } }
        );

     
        address.isDefault = true;
        await address.save();

        res.status(200).json({
            success: true,
            data: address
        });
    } catch (error) {
        next(error);
    }
};
