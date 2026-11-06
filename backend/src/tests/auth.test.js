process.env.JWT_SECRET = 'test-only-secret-for-auth-tests-123456';

const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');
const auth = require('../auth');

const prisma = new PrismaClient();

// Close server and database connection after all tests
afterAll(async () => {
  server.close();
  await prisma.$disconnect();
  await auth.prisma.$disconnect();
});

describe('Auth API Endpoints', () => {
  const testUser = {
    email: `test${Date.now()}@test.com`,
    password: 'Password123!',
    name: 'Test User',
    role: 'COURIER',
    bankAccount: 'Nequi',
    vehicle: 'Moto'
  };

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'User registered successfully');
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('token');
  });

  it('should not register a user with an existing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Ese correo ya está registrado.');
  });

  it('should login a user with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('name', testUser.name);
  });

  it('should not login a user with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should not expose a password reset code without a verified delivery channel', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });

    expect(res.statusCode).toEqual(503);
    expect(res.body).not.toHaveProperty('simulatedCode');
  });

  describe('Courier availability', () => {
    let token;
    let courierId;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: `availability${Date.now()}@test.com`,
        password: 'Password123!',
        name: 'Domiciliario Zona',
        role: 'COURIER',
        vehicle: 'Moto'
      });
      token = res.body.token;
      courierId = res.body.userId;
    });

    it('requires the phone location to go online', async () => {
      const res = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: true });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/ubicación/i);
    });

    it('rejects coordinates outside Colombia', async () => {
      const res = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: true, lat: 19.4326, lng: -99.1332 });

      expect(res.statusCode).toEqual(400);
    });

    it('saves the courier location and work zone when going online', async () => {
      const res = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: true, lat: 10.3910, lng: -75.4794, serviceRadiusKm: 12 });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject({ isOnline: true, serviceRadiusKm: 12 });
      expect(res.body.lastLat).toBeCloseTo(10.391, 3);
      expect(res.body.lastLng).toBeCloseTo(-75.4794, 3);
      expect(res.body.lastLocationAt).toBeTruthy();
    });

    it('exposes the availability fields in the profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject({ isOnline: true, serviceRadiusKm: 12 });
      expect(res.body.lastLat).toBeCloseTo(10.391, 3);
    });

    it('validates the work zone radius and lets the courier disconnect', async () => {
      const invalid = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: true, lat: 10.391, lng: -75.4794, serviceRadiusKm: 200 });
      expect(invalid.statusCode).toEqual(400);

      const offline = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isOnline: false });
      expect(offline.statusCode).toEqual(200);
      expect(offline.body).toHaveProperty('isOnline', false);

      const stored = await prisma.user.findUnique({
        where: { id: courierId },
        select: { isOnline: true, lastLat: true }
      });
      expect(stored.isOnline).toBe(false);
      expect(stored.lastLat).toBeCloseTo(10.391, 3);
    });

    it('does not let a business manage courier availability', async () => {
      const business = await request(app).post('/api/auth/register').send({
        email: `businesszone${Date.now()}@test.com`,
        password: 'Password123!',
        name: 'Comercio Zona',
        role: 'BUSINESS'
      });

      const res = await request(app)
        .patch('/api/auth/availability')
        .set('Authorization', `Bearer ${business.body.token}`)
        .send({ isOnline: true, lat: 10.391, lng: -75.4794 });

      expect(res.statusCode).toEqual(403);
    });
  });
});
