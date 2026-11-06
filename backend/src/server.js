const path = require('node:path');

// En local las variables viven en backend/.env; en Vercel las inyecta la plataforma.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');
const productRoutes = require('./routes/product.routes');
const { authenticate, getJwtSecret, verifySocketToken, prisma } = require('./auth');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  }
};
const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST', 'DELETE'] }
});

app.use(cors(corsOptions));
// Las fotos del catálogo y la evidencia del pedido viajan como data URL comprimida.
app.use(express.json({ limit: '4mb' }));

// Pass io to routes if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/wallet', authenticate, walletRoutes);
app.use('/api/products', authenticate, productRoutes);

io.use(async (socket, next) => {
  try {
    const user = await verifySocketToken(socket.handshake.auth?.token);
    socket.data.user = user;
    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

io.on('connection', (socket) => {
  const { id, role } = socket.data.user;
  socket.join(`user:${id}`);
  if (role === 'COURIER') socket.join('role:COURIER');

  socket.on('join_order', async (orderId, acknowledge) => {
    if (typeof orderId !== 'string') return;
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { businessId: true, courierId: true }
      });
      if (!order || (order.businessId !== id && order.courierId !== id)) {
        if (typeof acknowledge === 'function') acknowledge({ error: 'Forbidden' });
        return;
      }
      socket.join(`order:${orderId}`);
      if (typeof acknowledge === 'function') acknowledge({ ok: true });
    } catch {
      if (typeof acknowledge === 'function') acknowledge({ error: 'Unable to join order' });
    }
  });

  socket.on('disconnect', () => {
    socket.removeAllListeners();
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  getJwtSecret();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, server };
