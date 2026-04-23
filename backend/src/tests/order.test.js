const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});

describe('Order API Endpoints', () => {
  let businessUser;
  let courierUser;
  let orderId;
  let pickupPin;
  let dropoffPin;

  // Setup test users before running order tests
  beforeAll(async () => {
    const bEmail = `business${Date.now()}@test.com`;
    const cEmail = `courier${Date.now()}@test.com`;

    businessUser = await request(app).post('/api/auth/register').send({
      email: bEmail, password: 'Password123!', name: 'Restaurante', role: 'BUSINESS'
    });
    courierUser = await request(app).post('/api/auth/register').send({
      email: cEmail, password: 'Password123!', name: 'Domiciliario', role: 'COURIER', vehicle: 'Moto'
    });
  });

  it('should create a new order', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .send({
        businessId: businessUser.body.userId,
        price: 15000
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'PENDING');
    expect(res.body).toHaveProperty('pickupPin');
    expect(res.body).toHaveProperty('dropoffPin');
    
    orderId = res.body.id;
    pickupPin = res.body.pickupPin;
    dropoffPin = res.body.dropoffPin;
  });

  it('should not pickup an order with invalid PIN', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/pickup`)
      .send({ pin: '0000', courierId: courierUser.body.userId });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid Pickup PIN');
  });

  it('should pickup an order with valid PIN', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/pickup`)
      .send({ pin: pickupPin, courierId: courierUser.body.userId });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.order).toHaveProperty('status', 'PICKED_UP');
    expect(res.body.order).toHaveProperty('courierId', courierUser.body.userId);
  });

  it('should complete an order and generate payroll ledger entries', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .send({ pin: dropoffPin });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.order).toHaveProperty('status', 'DELIVERED');

    // Verify ledger entries were created
    const ledgers = await prisma.ledger.findMany({
      where: { userId: courierUser.body.userId }
    });

    expect(ledgers.length).toEqual(2);
    const platformFee = ledgers.find(l => l.type === 'PLATFORM_FEE');
    const earning = ledgers.find(l => l.type === 'EARNING');

    expect(platformFee).toBeDefined();
    expect(platformFee.amount).toEqual(-5000);
    
    expect(earning).toBeDefined();
    expect(earning.amount).toEqual(10000); // 15000 - 5000
  });
});
