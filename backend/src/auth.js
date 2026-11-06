const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
  }
  return secret;
}

function getBearerToken(header = '') {
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

async function authenticate(req, res, next) {
  const token = getBearerToken(req.get('authorization'));
  if (!token) return res.status(401).json({ error: 'Autenticación requerida.' });

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isBlocked: true }
    });
    if (!user || user.role !== payload.role) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    next();
  };
}

function verifySocketToken(token) {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true }
  }).then(user => {
    if (!user || user.role !== payload.role) throw new Error('Invalid socket identity');
    return user;
  });
}

module.exports = { authenticate, getJwtSecret, requireRole, verifySocketToken, prisma };
