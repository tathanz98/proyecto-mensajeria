const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateDebt() {
  console.log('Simulando deuda de $50,000 para todos los domiciliarios...');
  
  await prisma.user.updateMany({
    where: { role: 'COURIER' },
    data: {
      debt: 50000,
      isBlocked: true
    }
  });

  console.log('¡Todos los domiciliarios han sido bloqueados por tope de deuda!');
}

simulateDebt()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
