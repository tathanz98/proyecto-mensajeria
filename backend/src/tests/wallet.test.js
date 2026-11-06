process.env.JWT_SECRET = 'test-only-secret-for-wallet-tests-123456';

const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');
const auth = require('../auth');

const prisma = new PrismaClient();

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
  await auth.prisma.$disconnect();
});

describe('Wallet API access control', () => {
  let userId;
  let otherUserId;
  let token;

  beforeAll(async () => {
    const email = `wallet${Date.now()}@test.com`;
    const otherEmail = `other-wallet${Date.now()}@test.com`;
    const user = await request(app).post('/api/auth/register').send({
      email, password: 'Password123!', name: 'Wallet owner', role: 'COURIER', vehicle: 'Moto'
    });
    const otherUser = await request(app).post('/api/auth/register').send({
      email: otherEmail, password: 'Password123!', name: 'Other user', role: 'COURIER', vehicle: 'Moto'
    });
    userId = user.body.userId;
    otherUserId = otherUser.body.userId;
    token = user.body.token;
  });

  it('requires authentication and only returns the signed-in user balance', async () => {
    const anonymous = await request(app).get(`/api/wallet/balance/${userId}`);
    const ownBalance = await request(app)
      .get(`/api/wallet/balance/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    const otherBalance = await request(app)
      .get(`/api/wallet/balance/${otherUserId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(anonymous.statusCode).toEqual(401);
    expect(ownBalance.statusCode).toEqual(200);
    expect(ownBalance.body).toEqual({ cardBalance: 0, debt: 0, isBlocked: false });
    expect(otherBalance.statusCode).toEqual(403);
  });

  it('does not clear debt without a verified payment provider', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { debt: 50000, isBlocked: true }
    });
    const res = await request(app)
      .post('/api/wallet/pay-debt')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId });
    const user = await prisma.user.findUnique({ where: { id: userId } });

    expect(res.statusCode).toEqual(503);
    expect(user.debt).toEqual(50000);
    expect(user.isBlocked).toBe(true);
  });
});
