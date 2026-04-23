const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Get wallet balance
router.get('/balance/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { cardBalance: true, debt: true, isBlocked: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching balance' });
  }
});

// Simulate paying the debt via Nequi/Efecty
router.post('/pay-debt', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Register payment in ledger
    if (user.debt > 0) {
      await prisma.ledger.create({
        data: {
          userId,
          type: 'DEBT_PAYMENT',
          amount: user.debt,
          description: `Pago de tope en corresponsal Nequi/Efecty`
        }
      });
    }

    // Reset debt and unblock
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { debt: 0, isBlocked: false }
    });

    res.json({ message: 'Pago registrado exitosamente. Cuenta desbloqueada.', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Error processing payment' });
  }
});

module.exports = router;
