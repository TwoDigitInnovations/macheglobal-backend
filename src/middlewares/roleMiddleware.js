/**
 * Role-based access control middleware
 * @param {...string} allowedRoles 
 * @returns {Function} 
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
   
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'User role not found' });
    }

    
    const isAllowed = allowedRoles.includes(req.user.role);
    
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this resource'
      });
    }
    
    next();
  };
};

module.exports = {
  authorize
};
