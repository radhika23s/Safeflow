const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const tokenBlacklistModel = require('../models/blacklist.model');

async function authMiddleware(req, res, next) {

    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];



    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const blacklistedToken = await tokenBlacklistModel.findOne({ token });
    if (blacklistedToken) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
        return next();

    }
    catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

}

async function authsystemuser(req, res, next) {
    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const blacklistedToken = await tokenBlacklistModel.findOne({ token });
    if (blacklistedToken) {
        return res.status(401).json({ message: 'Unauthorized' });
    }


    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.id).select('+systemUser');
        if (!user || !user.systemUser) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user;
        return next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}


module.exports = {
    authMiddleware,
    authsystemuser
};