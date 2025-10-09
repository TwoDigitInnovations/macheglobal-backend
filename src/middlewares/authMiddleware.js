const authService = require('@services/authService');

module.exports = {
  authenticate: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

 
    let token;
    if (authHeader.startsWith('jwt ')) {
      token = authHeader.split(' ')[1];
    } else if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      
      token = authHeader;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = authService.verifyToken(token);
      console.log('Decoded token:', decoded); // Debug log
      
    
      if (decoded) {
       
        if (decoded.id && !decoded._id) {
          decoded._id = decoded.id;
        }
       
        else if (decoded.user?.id) {
          decoded._id = decoded.user.id;
        }
      }
      
      req.user = decoded;
      console.log('Authenticated user:', { 
        id: req.user._id || req.user.id,
        email: req.user.email 
      });
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(403).json({ 
        message: 'Invalid token',
        error: error.message 
      });
    }
  }
};
