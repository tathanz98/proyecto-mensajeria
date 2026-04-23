const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Allow local frontends
});

app.use(cors());
app.use(express.json());

// Anti-Fraud: Escudo general contra robots (100 peticiones cada 15 min por IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Demasiadas peticiones desde esta IP. El sistema anti-fraude ha bloqueado temporalmente el acceso.' }
});

// Anti-Fraud: Escudo estricto para inicio de sesión (Evita fuerza bruta, max 5 intentos)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos fallidos. Por seguridad, espera 15 minutos.' }
});

app.use('/api/', generalLimiter);

// Pass io to routes if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  // WebSockets for Real-Time Dispatching
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, server };
