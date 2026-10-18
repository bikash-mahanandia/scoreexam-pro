const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token missing' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') return next();
  res.status(403).json({ message: 'Forbidden: Admin access required' });
};

const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'STUDENT') return next();
  res.status(403).json({ message: 'Forbidden: Student access required' });
};

module.exports = { protect, isAdmin, isStudent };