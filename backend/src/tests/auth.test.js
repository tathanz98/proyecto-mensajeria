const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Close server and database connection after all tests
afterAll(async () => {
  server.close();
  await prisma.$disconnect();
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
  });

  it('should not register a user with an existing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Registration failed or email exists');
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
});
