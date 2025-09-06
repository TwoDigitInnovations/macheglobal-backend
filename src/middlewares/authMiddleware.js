const authService = require('@services/authService');

module.exports = {
  authenticate: (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  }
};
