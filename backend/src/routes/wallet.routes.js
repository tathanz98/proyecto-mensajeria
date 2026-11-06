const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../auth');
const router = express.Router();
const prisma = new PrismaClient();

// Get wallet balance
router.get('/balance/:userId', requireRole('COURIER'), async (req, res) => {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes acceso a esta billetera.' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { cardBalance: true, debt: true, isBlocked: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching balance' });
  }
});

router.get('/transactions', requireRole('COURIER'), async (req, res) => {
  try {
    const transactions = await prisma.ledger.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(transactions);
  } catch {
    res.status(500).json({ error: 'No fue posible cargar los movimientos.' });
  }
});

router.post('/pay-debt', requireRole('COURIER'), async (req, res) => {
  if (req.body.userId && req.body.userId !== req.user.id) {
    return res.status(403).json({ error: 'No puedes modificar la billetera de otra persona.' });
  }
  res.status(503).json({
    error: 'El pago no está disponible hasta integrar y verificar un proveedor de pagos.'
  });
});

module.exports = router;
