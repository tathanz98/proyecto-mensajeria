process.env.JWT_SECRET = 'test-only-secret-for-product-tests-123456';

const request = require('supertest');
const { app, server } = require('../server');
const { PrismaClient } = require('@prisma/client');
const { dateKeyInBogota, weekdayFromDateKey, isColombianHoliday } = require('../holidays');

const prisma = new PrismaClient();
const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@catalog.test' } } });
  server.close();
  await prisma.$disconnect();
});

describe('Product and combo API', () => {
  let businessToken;
  let otherBusinessToken;
  let courierToken;
  let burgerId;
  let sodaId;
  let comboId;
  let offerProductId;
  const todayKey = dateKeyInBogota();
  const todayWeekday = weekdayFromDateKey(todayKey);

  beforeAll(async () => {
    const stamp = Date.now();
    const register = body => request(app).post('/api/auth/register').send(body);

    const business = await register({ email: `biz${stamp}@catalog.test`, password: 'Password123!', name: 'Comidas', role: 'BUSINESS' });
    const other = await register({ email: `other${stamp}@catalog.test`, password: 'Password123!', name: 'Otra', role: 'BUSINESS' });
    const courier = await register({ email: `courier${stamp}@catalog.test`, password: 'Password123!', name: 'Moto', role: 'COURIER', vehicle: 'Moto' });

    businessToken = business.body.token;
    otherBusinessToken = other.body.token;
    courierToken = courier.body.token;
  });

  it('creates a product with a photo', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ name: 'Hamburguesa clásica', category: 'Hamburguesas', price: 18000, description: 'Con queso y papas', imageData: IMAGE });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('name', 'Hamburguesa clásica');
    expect(res.body.imageData).toEqual(IMAGE);
    burgerId = res.body.id;

    const soda = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ name: 'Gaseosa', category: 'Bebidas', price: 4000 });
    sodaId = soda.body.id;
  });

  it('lists the catalog for its owner only', async () => {
    const mine = await request(app).get('/api/products/mine').set('Authorization', `Bearer ${businessToken}`);
    expect(mine.statusCode).toEqual(200);
    expect(mine.body).toHaveLength(2);

    const forbidden = await request(app).get('/api/products/mine').set('Authorization', `Bearer ${courierToken}`);
    expect(forbidden.statusCode).toEqual(403);
  });

  it('rejects an invalid photo payload', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ name: 'Sin foto válida', price: 5000, imageData: 'https://example.com/foto.png' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/imagen/i);
  });

  it('creates a combo from own products', async () => {
    const res = await request(app)
      .post('/api/products/combos')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({
        name: 'Combo hamburguesa + gaseosa',
        category: 'Combos',
        price: 20000,
        imageData: IMAGE,
        items: [
          { productId: burgerId, quantity: 1 },
          { productId: sodaId, quantity: 2 }
        ]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('kind', 'COMBO');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.regularPrice).toEqual(18000 + 4000 * 2);
    comboId = res.body.id;
  });

  it('refuses products from another business', async () => {
    const foreign = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${otherBusinessToken}`)
      .send({ name: 'Ajeno', price: 9000 });

    const res = await request(app)
      .post('/api/products/combos')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ name: 'Combo inválido', price: 8000, items: [{ productId: foreign.body.id, quantity: 1 }] });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/propio catálogo/);
  });

  it('updates availability and combo items', async () => {
    const toggled = await request(app)
      .patch(`/api/products/${burgerId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ isAvailable: false });
    expect(toggled.statusCode).toEqual(200);
    expect(toggled.body.isAvailable).toEqual(false);

    const editedCombo = await request(app)
      .patch(`/api/products/${comboId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ price: 19000, items: [{ productId: burgerId, quantity: 2 }] });
    expect(editedCombo.statusCode).toEqual(200);
    expect(editedCombo.body.price).toEqual(19000);
    expect(editedCombo.body.items).toHaveLength(1);
    expect(editedCombo.body.regularPrice).toEqual(36000);
  });

  it('creates an offer that is active today and reports the discount', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({
        name: 'Arepa en oferta',
        category: 'Arepas',
        price: 10000,
        offerPrice: 7000,
        offerTitle: 'Especial de hoy',
        offerWeekdays: [todayWeekday]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.offer).toMatchObject({
      price: 7000,
      title: 'Especial de hoy',
      weekdays: [todayWeekday],
      active: true,
      status: 'ACTIVE',
      discount: 3000,
      percent: 30,
      today: todayKey
    });
    offerProductId = res.body.id;
  });

  it('rejects an offer that is not cheaper than the normal price', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ name: 'Oferta inválida', price: 8000, offerPrice: 8000 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/menor al precio normal/);
  });

  it('schedules an offer for another weekday', async () => {
    const res = await request(app)
      .patch(`/api/products/${offerProductId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ offerWeekdays: [(todayWeekday + 1) % 7] });

    expect(res.statusCode).toEqual(200);
    expect(res.body.offer.active).toEqual(false);
    expect(res.body.offer.status).toEqual('SCHEDULED');
    expect(res.body.offer.price).toEqual(7000);
  });

  it('marks an offer outside its dates as expired', async () => {
    const res = await request(app)
      .patch(`/api/products/${offerProductId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ offerStart: '2020-01-01', offerEnd: '2020-01-02', offerWeekdays: [] });

    expect(res.statusCode).toEqual(200);
    expect(res.body.offer.active).toEqual(false);
    expect(res.body.offer.status).toEqual('EXPIRED');
    expect(res.body.offer.start).toEqual('2020-01-01');
    expect(res.body.offer.end).toEqual('2020-01-02');
  });

  it('validates the offer date range', async () => {
    const res = await request(app)
      .patch(`/api/products/${offerProductId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ offerStart: '2026-12-31', offerEnd: '2026-01-01' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/fecha final/);
  });

  it('rejects lowering the normal price below the offer price', async () => {
    const res = await request(app)
      .patch(`/api/products/${offerProductId}`)
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ price: 6000 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/mayor al precio de oferta/);
  });

  it('recognizes Colombian holidays including Easter and Emiliani moves', () => {
    expect(isColombianHoliday('2026-12-25')).toEqual(true);
    expect(isColombianHoliday('2026-04-02')).toEqual(true);
    expect(isColombianHoliday('2026-05-18')).toEqual(true);
    expect(isColombianHoliday('2027-01-11')).toEqual(true);
    expect(isColombianHoliday('2027-01-06')).toEqual(false);
    expect(isColombianHoliday('2026-11-06')).toEqual(false);
    expect(dateKeyInBogota(new Date('2026-11-07T03:00:00.000Z'))).toEqual('2026-11-06');
  });

  it('deletes a product and then reports it missing', async () => {
    const res = await request(app)
      .delete(`/api/products/${sodaId}`)
      .set('Authorization', `Bearer ${businessToken}`);
    expect(res.statusCode).toEqual(200);

    const again = await request(app)
      .delete(`/api/products/${sodaId}`)
      .set('Authorization', `Bearer ${businessToken}`);
    expect(again.statusCode).toEqual(404);
  });
});
