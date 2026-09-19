const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
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

// Pass io to routes if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { app, server };
