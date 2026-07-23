const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Looked up by globally-unique _id, so this one read is deliberately
    // not tenant-scoped — it's what establishes which tenant we're in.
    const user = await User.findById(decoded.id).select('-password').skipTenantScope();
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // The tenant always comes from the signed token / the user record —
    // never from a client-supplied body, query or header, which a caller
    // could tamper with to reach another society's data.
    req.user = user;
    req.societyId = user.societyId;

    if (!req.societyId) {
      return res.status(403).json({ message: 'Account is not linked to a society' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Role ${req.user.role} is not authorized` });
    }
    next();
  };
};
