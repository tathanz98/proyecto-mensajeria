const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Utility to generate 4-digit PIN
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// Create order (Called by Business)
router.post('/create', async (req, res) => {
  try {
    const { businessId, price } = req.body;
    const order = await prisma.order.create({
      data: {
        businessId,
        price,
        status: 'PENDING',
        pickupPin: generatePin(),
        dropoffPin: generatePin()
      }
    });
    // Notify couriers via WebSocket
    req.io.emit('new_order', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Error creating order' });
  }
});

// Courier accepts an order
router.post('/:orderId/accept', async (req, res) => {
  try {
    const { courierId } = req.body;
    
    // Check if blocked
    const courier = await prisma.user.findUnique({ where: { id: courierId } });
    if (courier && courier.isBlocked) {
      return res.status(403).json({ error: 'Cuenta bloqueada por tope de deuda.' });
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'El pedido ya no está disponible.' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED', courierId }
    });

    // Notify Business that courier accepted
    req.io.emit('order_accepted', { orderId: order.id, courierName: courier.name });
    res.json({ message: 'Order accepted', order: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Courier validates Pickup PIN
router.post('/:orderId/pickup', async (req, res) => {
  try {
    const { pin, courierId } = req.body;
    
    // Check if courier is blocked
    const courier = await prisma.user.findUnique({ where: { id: courierId } });
    if (courier && courier.isBlocked) {
      return res.status(403).json({ error: 'Cuenta bloqueada por tope de deuda. Debes pagar en un corresponsal para continuar.' });
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    
    if (order.pickupPin !== pin) {
      return res.status(400).json({ error: 'Invalid Pickup PIN' });
    }
    
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PICKED_UP', courierId }
    });
    
    req.io.emit('order_updated', updated);
    res.json({ message: 'Pickup successful', order: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Courier validates Dropoff PIN and completes order
router.post('/:orderId/complete', async (req, res) => {
  try {
    const { pin } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    
    if (order.dropoffPin !== pin) {
      return res.status(400).json({ error: 'Invalid Dropoff PIN' });
    }
    
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'DELIVERED' }
    });

    // Handle Payroll Ledger for the courier
    if (order.courierId) {
      // Platform takes $5000 fee
      await prisma.ledger.create({
        data: {
          userId: order.courierId,
          type: 'PLATFORM_FEE',
          amount: -5000,
          description: `Fee for order ${order.id}`
        }
      });
      // Courier gets the rest (price - 5000)
      const earning = order.price - 5000;
      await prisma.ledger.create({
        data: {
          userId: order.courierId,
          type: 'EARNING',
          amount: earning,
          description: `Earning for order ${order.id}`
        }
      });

      // Update Courier Debt and Block Status
      const courier = await prisma.user.findUnique({ where: { id: order.courierId } });
      const newDebt = courier.debt + 5000;
      const isBlocked = newDebt >= 50000; // Bloqueo al llegar a $50,000

      await prisma.user.update({
        where: { id: order.courierId },
        data: { debt: newDebt, isBlocked }
      });
    }

    req.io.emit('order_updated', updated);
    res.json({ message: 'Delivery successful, payroll updated', order: updated });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
