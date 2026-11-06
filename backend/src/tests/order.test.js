process.env.JWT_SECRET = 'test-only-secret-for-order-tests-123456';

const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');
const auth = require('../auth');

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
  let businessToken;
  let courierToken;

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
    const businessLogin = await request(app).post('/api/auth/login').send({
      email: bEmail, password: 'Password123!'
    });
    const courierLogin = await request(app).post('/api/auth/login').send({
      email: cEmail, password: 'Password123!'
    });
    businessToken = businessLogin.body.token;
    courierToken = courierLogin.body.token;
  });

  it('should create a new order', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({
        price: 15000,
        customerName: 'Cliente de Prueba',
        customerPhone: '3001234567',
        pickupAddress: 'Calle 123 #45-67',
        dropoffAddress: 'Cra 89 #12-34',
        pickupLat: 6.2442,
        pickupLng: -75.5812,
        dropoffLat: 6.1575,
        dropoffLng: -75.5823
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('status', 'PENDING');
    expect(res.body).toHaveProperty('pickupPin');
    expect(res.body).toHaveProperty('businessName', 'Restaurante');
    expect(res.body).not.toHaveProperty('dropoffPin');
    expect(res.body).toHaveProperty('pickupLat', 6.2442);
    expect(res.body).toHaveProperty('dropoffLng', -75.5823);
    expect(res.body.code).toMatch(/^PED-[0-9A-F]{8}$/);
    expect(res.body).toHaveProperty('qrToken');
    expect(res.body).toHaveProperty('verificationStatus', 'PENDING');
    
    orderId = res.body.id;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    pickupPin = order.pickupPin;
    dropoffPin = order.dropoffPin;
  });

  it('rejects coordinates outside Colombia', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({
        price: 15000,
        customerName: 'Cliente',
        customerPhone: '3001234567',
        pickupAddress: 'Calle 1',
        dropoffAddress: 'Calle 2',
        pickupLat: 19.4326,
        pickupLng: -99.1332,
        dropoffLat: 6.1575,
        dropoffLng: -75.5823
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/Colombia/);
  });

  it('lists pending orders and exposes pins only to the owning business', async () => {
    const available = await request(app)
      .get('/api/orders/available')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(available.statusCode).toEqual(200);
    const availableOrder = available.body.find(order => order.id === orderId);
    expect(availableOrder).toBeDefined();
    expect(availableOrder).toHaveProperty('customerName', 'Cliente de Prueba');
    expect(availableOrder.code).toMatch(/^PED-/);
    expect(availableOrder).not.toHaveProperty('pickupPin');
    expect(availableOrder).not.toHaveProperty('qrToken');

    const businessOrders = await request(app)
      .get('/api/orders/mine')
      .set('Authorization', `Bearer ${businessToken}`);
    expect(businessOrders.statusCode).toEqual(200);
    const created = businessOrders.body.find(order => order.id === orderId);
    expect(created).toHaveProperty('pickupPin');
    expect(created).toHaveProperty('qrToken');
    expect(created).toHaveProperty('customerName', 'Cliente de Prueba');

    const businessDetail = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${businessToken}`);
    expect(businessDetail.body).toHaveProperty('pickupPin');

    const courierDetail = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${courierToken}`);
    expect(courierDetail.statusCode).toEqual(403);

    const anonymous = await request(app).get('/api/orders/mine');
    expect(anonymous.statusCode).toEqual(401);
  });

  it('filters available orders by the courier work zone', async () => {
    const online = await request(app)
      .patch('/api/auth/availability')
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ isOnline: true, lat: 6.2442, lng: -75.5812 });
    expect(online.statusCode).toEqual(200);
    expect(online.body).toHaveProperty('isOnline', true);

    const nearby = await request(app)
      .get('/api/orders/available')
      .set('Authorization', `Bearer ${courierToken}`);
    const nearOrder = nearby.body.find(order => order.id === orderId);
    expect(nearOrder).toBeDefined();
    expect(nearOrder.distanceKm).toBeLessThan(1);

    // Un domiciliario conectado en otra ciudad no ve pedidos de Medellín.
    await request(app)
      .patch('/api/auth/availability')
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ isOnline: true, lat: 4.6533, lng: -74.0836 });

    const farAway = await request(app)
      .get('/api/orders/available')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(farAway.statusCode).toEqual(200);
    expect(farAway.body.find(order => order.id === orderId)).toBeUndefined();

    // Vuelve a su zona para las pruebas siguientes.
    await request(app)
      .patch('/api/auth/availability')
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ isOnline: true, lat: 6.2442, lng: -75.5812 });
  });

  it('requires customer, phone and addresses to create an order', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ price: 15000 });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject unauthenticated access and prevent a business from acting as a courier', async () => {
    const anonymous = await request(app).get(`/api/orders/${orderId}/messages`);
    const wrongRole = await request(app)
      .post(`/api/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${businessToken}`);

    expect(anonymous.statusCode).toEqual(401);
    expect(wrongRole.statusCode).toEqual(403);
  });

  it('should accept a pending order for the authenticated courier', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${courierToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.order).toHaveProperty('status', 'ACCEPTED');
    expect(res.body.order).not.toHaveProperty('pickupPin');
  });

  it('blocks pickup until the courier verifies the order with three photos', async () => {
    const blocked = await request(app)
      .post(`/api/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ pin: pickupPin });
    expect(blocked.statusCode).toEqual(400);
    expect(blocked.body.error).toMatch(/verifica el pedido/);
  });

  it('requires the order, invoice and QR photos to verify', async () => {
    const samplePhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const incomplete = await request(app)
      .post(`/api/orders/${orderId}/verify`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ orderPhoto: samplePhoto, invoicePhoto: samplePhoto });
    expect(incomplete.statusCode).toEqual(400);
    expect(incomplete.body.error).toMatch(/tres fotos/);

    const invalid = await request(app)
      .post(`/api/orders/${orderId}/verify`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({
        orderPhoto: 'no-es-una-imagen',
        invoicePhoto: samplePhoto,
        qrPhoto: samplePhoto
      });
    expect(invalid.statusCode).toEqual(400);
  });

  it('verifies the order with the three photos', async () => {
    const samplePhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const res = await request(app)
      .post(`/api/orders/${orderId}/verify`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ orderPhoto: samplePhoto, invoicePhoto: samplePhoto, qrPhoto: samplePhoto });

    expect(res.statusCode).toEqual(200);
    expect(res.body.order).toHaveProperty('verificationStatus', 'VERIFIED');
    expect(res.body.order).toHaveProperty('verifiedAt');
  });

  it('should not pickup an order with invalid PIN', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ pin: '0000', courierId: courierUser.body.userId });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'PIN de recogida inválido.');
  });

  it('should pickup an order with valid PIN', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ pin: pickupPin, courierId: courierUser.body.userId });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.order).toHaveProperty('status', 'PICKED_UP');
    expect(res.body.order).toHaveProperty('courierId', courierUser.body.userId);
  });

  it('should complete an order and generate payroll ledger entries', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${courierToken}`)
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

    const repeatedCompletion = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${courierToken}`)
      .send({ pin: dropoffPin });
    expect(repeatedCompletion.statusCode).toEqual(400);

    const finalLedgers = await prisma.ledger.findMany({ where: { userId: courierUser.body.userId } });
    expect(finalLedgers).toHaveLength(2);
    const courier = await prisma.user.findUnique({ where: { id: courierUser.body.userId } });
    expect(courier.debt).toEqual(5000);
  });

  it('enforces the daily order limit configured by the business', async () => {
    const email = `limit${Date.now()}@test.com`;
    await request(app).post('/api/auth/register').send({
      email, password: 'Password123!', name: 'Comercio con límite', role: 'BUSINESS'
    });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
    const token = login.body.token;

    const updated = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailyOrderLimit: 1 });
    expect(updated.statusCode).toEqual(200);
    expect(updated.body.dailyOrderLimit).toEqual(1);

    const invalid = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailyOrderLimit: 0 });
    expect(invalid.statusCode).toEqual(400);

    const createOrder = () => request(app)
      .post('/api/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 15000,
        customerName: 'Cliente límite',
        customerPhone: '3001234567',
        pickupAddress: 'Calle 1',
        dropoffAddress: 'Calle 2',
        pickupLat: 4.65,
        pickupLng: -74.05,
        dropoffLat: 4.66,
        dropoffLng: -74.06
      });

    const first = await createOrder();
    expect(first.statusCode).toEqual(201);

    const second = await createOrder();
    expect(second.statusCode).toEqual(409);
    expect(second.body).toHaveProperty('ordersToday', 1);
    expect(second.body).toHaveProperty('dailyOrderLimit', 1);

    const summary = await request(app)
      .get('/api/orders/business/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(summary.statusCode).toEqual(200);
    expect(summary.body).toMatchObject({
      ordersToday: 1,
      dailyOrderLimit: 1,
      remaining: 0,
      canCreate: false
    });

    const cleared = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailyOrderLimit: null });
    expect(cleared.statusCode).toEqual(200);
    expect(cleared.body.dailyOrderLimit).toBeNull();

    const third = await createOrder();
    expect(third.statusCode).toEqual(201);
  });

  it('validates the driving route endpoint and returns a null fallback without the external service', async () => {
    const unauthorized = await request(app).get('/api/orders/route?from=6.24,-75.58&to=6.15,-75.58');
    expect(unauthorized.statusCode).toEqual(401);

    const invalid = await request(app)
      .get('/api/orders/route?from=abc&to=6.15,-75.58')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(invalid.statusCode).toEqual(400);

    const outside = await request(app)
      .get('/api/orders/route?from=40.71,-74.00&to=6.15,-75.58')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(outside.statusCode).toEqual(400);

    const ok = await request(app)
      .get('/api/orders/route?from=6.2442,-75.5812&to=6.1575,-75.5823')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(ok.statusCode).toEqual(200);
    expect(ok.body).toHaveProperty('route', null);

    // Cobertura nacional: Leticia y San Andrés también son coordenadas válidas.
    const amazonas = await request(app)
      .get('/api/orders/route?from=-4.2030,-69.9400&to=-4.2150,-69.9450')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(amazonas.statusCode).toEqual(200);

    const isla = await request(app)
      .get('/api/orders/route?from=12.5832,-81.7065&to=12.5400,-81.7180')
      .set('Authorization', `Bearer ${courierToken}`);
    expect(isla.statusCode).toEqual(200);
  });
});
