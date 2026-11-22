const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'v91-kasirparfum-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function signUserToken(user) {
  return jwt.sign(
    {
      username: user.username,
      role: user.role,
      namaLengkap: user.namaLengkap
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware wajib login (Authorization: Bearer <token>)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Sesi login tidak valid atau telah kedaluwarsa.' });
  }
}

/**
 * Middleware opsional: parse token jika tersedia (untuk endpoint bootstrap sebelum login)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  }
  return next();
}

/**
 * Middleware khusus Pemilik / Administrator
 */
function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  if (req.user.role !== 'Pemilik' && req.user.role !== 'Administrator') {
    return res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur ini khusus untuk Pemilik.' });
  }
  return next();
}

module.exports = {
  signUserToken,
  requireAuth,
  optionalAuth,
  requireOwner
};
