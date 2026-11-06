const express = require('express');
const { randomInt, randomUUID } = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { requireRole } = require('../auth');
const { geocodeAddress } = require('../geocoding');
const { bogotaDayBounds } = require('../holidays');
const { drivingRoute } = require('../routing');
const { distanceKm } = require('../geo');

const router = express.Router();
const prisma = require('../auth').prisma;
const pinAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const MAX_PHOTO_LENGTH = 700_000;
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function cleanPhoto(value) {
  if (typeof value !== 'string' || value.length > MAX_PHOTO_LENGTH || !PHOTO_PATTERN.test(value)) {
    return null;
  }
  return value;
}

const orderInclude = {
  business: { select: { name: true } },
  courier: { select: { name: true } }
};

const orderSelect = {
  id: true,
  code: true,
  status: true,
  price: true,
  businessId: true,
  courierId: true,
  customerName: true,
  customerPhone: true,
  pickupAddress: true,
  dropoffAddress: true,
  pickupLat: true,
  pickupLng: true,
  dropoffLat: true,
  dropoffLng: true,
  notes: true,
  verificationStatus: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  business: { select: { name: true } },
  courier: { select: { name: true } }
};

function serializeOrder(order) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    price: order.price,
    businessId: order.businessId,
    businessName: order.business?.name ?? null,
    courierId: order.courierId,
    courierName: order.courier?.name ?? null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    dropoffLat: order.dropoffLat,
    dropoffLng: order.dropoffLng,
    notes: order.notes,
    verificationStatus: order.verificationStatus,
    verifiedAt: order.verifiedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

// Cobertura geográfica de Colombia (incluye San Andrés y Providencia).
const COLOMBIA_BOUNDS = { minLat: -5, maxLat: 14, minLng: -83, maxLng: -66 };

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return 'invalid';
  return number;
}

async function resolveCoordinates(latValue, lngValue, address) {
  const lat = parseCoordinate(latValue, COLOMBIA_BOUNDS.minLat, COLOMBIA_BOUNDS.maxLat);
  const lng = parseCoordinate(lngValue, COLOMBIA_BOUNDS.minLng, COLOMBIA_BOUNDS.maxLng);
  if (lat === 'invalid' || lng === 'invalid') return { invalid: true };
  if (lat !== null && lng !== null) return { lat, lng };

  const geocoded = await geocodeAddress(address);
  return geocoded || { lat: null, lng: null };
}

async function findParticipantOrder(orderId, userId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: 'not_found' };
  if (order.businessId !== userId && order.courierId !== userId) return { error: 'forbidden' };
  return { order };
}

function respondOrderAccessError(res, error) {
  if (error === 'not_found') return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (error === 'forbidden') return res.status(403).json({ error: 'No tienes acceso a este pedido.' });
  return null;
}

router.get('/courier/:courierId/stats', requireRole('COURIER'), async (req, res) => {
  if (req.params.courierId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes acceso a estas ganancias.' });
  }
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [trips, earnings] = await Promise.all([
      prisma.order.count({
        where: { courierId: req.user.id, status: 'DELIVERED', updatedAt: { gte: startOfDay } }
      }),
      prisma.ledger.aggregate({
        where: { userId: req.user.id, type: 'EARNING', createdAt: { gte: startOfDay } },
        _sum: { amount: true }
      })
    ]);

    res.json({ trips, earnings: earnings._sum.amount || 0 });
  } catch {
    res.status(500).json({ error: 'No fue posible consultar las ganancias.' });
  }
});

// Pedidos pendientes que un domiciliario puede tomar, limitados a su zona de trabajo.
router.get('/available', requireRole('COURIER'), async (req, res) => {
  try {
    const [courier, orders] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { lastLat: true, lastLng: true, serviceRadiusKm: true }
      }),
      prisma.order.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: orderSelect
      })
    ]);

    const hasLocation = Number.isFinite(courier?.lastLat) && Number.isFinite(courier?.lastLng);
    const radius = courier?.serviceRadiusKm ?? 6;

    // Los pedidos sin coordenadas se muestran igual: el domiciliario navega con la dirección escrita.
    const candidates = orders.map(order => ({
      order,
      distance: hasLocation
        ? distanceKm([courier.lastLat, courier.lastLng], [order.pickupLat, order.pickupLng])
        : null
    }));

    const visible = hasLocation
      ? candidates.filter(({ distance }) => distance === null || distance <= radius)
      : candidates;

    visible.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    res.json(visible.slice(0, 20).map(({ order, distance }) => ({
      ...serializeOrder(order),
      distanceKm: distance === null ? null : Number(distance.toFixed(1))
    })));
  } catch {
    res.status(500).json({ error: 'No fue posible cargar los pedidos disponibles.' });
  }
});

// Capacidad diaria del comercio: pedidos creados hoy (hora de Bogotá) y cupo restante.
router.get('/business/summary', requireRole('BUSINESS'), async (req, res) => {
  try {
    const { start, end, dateKey } = bogotaDayBounds();
    const [business, ordersToday] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { dailyOrderLimit: true }
      }),
      prisma.order.count({
        where: { businessId: req.user.id, createdAt: { gte: start, lt: end } }
      })
    ]);

    const dailyOrderLimit = business?.dailyOrderLimit ?? null;
    res.json({
      date: dateKey,
      ordersToday,
      dailyOrderLimit,
      remaining: dailyOrderLimit === null ? null : Math.max(0, dailyOrderLimit - ordersToday),
      canCreate: dailyOrderLimit === null || ordersToday < dailyOrderLimit
    });
  } catch {
    res.status(500).json({ error: 'No fue posible consultar el resumen del día.' });
  }
});

function parsePoint(value) {
  if (typeof value !== 'string') return null;
  const [latRaw, lngRaw] = value.split(',');
  const lat = parseCoordinate(latRaw, COLOMBIA_BOUNDS.minLat, COLOMBIA_BOUNDS.maxLat);
  const lng = parseCoordinate(lngRaw, COLOMBIA_BOUNDS.minLng, COLOMBIA_BOUNDS.maxLng);
  if (lat === 'invalid' || lng === 'invalid' || lat === null || lng === null) return null;
  return [lat, lng];
}

// Ruta vehicular por calles entre dos puntos. Si el servicio no responde, el mapa usa línea directa.
router.get('/route', routeLimiter, async (req, res) => {
  const from = parsePoint(req.query.from);
  const to = parsePoint(req.query.to);
  if (!from || !to) {
    return res.status(400).json({ error: 'Indica origen y destino como lat,lng dentro de Colombia.' });
  }
  try {
    res.json({ route: await drivingRoute(from, to) });
  } catch {
    res.json({ route: null });
  }
});

// Pedidos del usuario autenticado: historial para comercios y domiciliarios.
router.get('/mine', async (req, res) => {
  try {
    const where = req.user.role === 'BUSINESS'
      ? { businessId: req.user.id }
      : { courierId: req.user.id };
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;
    const activeStatuses = ['PENDING', 'ACCEPTED', 'PICKED_UP'];

    if (status === 'ACTIVE') where.status = { in: activeStatuses };
    else if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        ...orderSelect,
        ...(req.user.role === 'BUSINESS' ? { pickupPin: true, qrToken: true } : {})
      }
    });

    res.json(orders.map(order => ({
      ...serializeOrder(order),
      ...(order.pickupPin ? { pickupPin: order.pickupPin } : {}),
      ...(order.qrToken ? { qrToken: order.qrToken } : {})
    })));
  } catch {
    res.status(500).json({ error: 'No fue posible cargar tus pedidos.' });
  }
});

router.post('/create', requireRole('BUSINESS'), async (req, res) => {
  try {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 5000) {
      return res.status(400).json({ error: 'El precio del pedido no es válido.' });
    }

    const customerName = cleanText(req.body.customerName, 80);
    const customerPhone = cleanText(req.body.customerPhone, 30);
    const pickupAddress = cleanText(req.body.pickupAddress, 160);
    const dropoffAddress = cleanText(req.body.dropoffAddress, 160);
    const notes = cleanText(req.body.notes, 400);

    if (!customerName || !customerPhone || !pickupAddress || !dropoffAddress) {
      return res.status(400).json({
        error: 'Debes indicar cliente, teléfono y las direcciones de recogida y entrega.'
      });
    }

    const business = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { dailyOrderLimit: true }
    });
    if (business?.dailyOrderLimit != null) {
      const { start, end } = bogotaDayBounds();
      const ordersToday = await prisma.order.count({
        where: { businessId: req.user.id, createdAt: { gte: start, lt: end } }
      });
      if (ordersToday >= business.dailyOrderLimit) {
        return res.status(409).json({
          error: `Alcanzaste tu límite de ${business.dailyOrderLimit} pedidos por día (${ordersToday} creados hoy). Ajusta el límite para seguir despachando.`,
          ordersToday,
          dailyOrderLimit: business.dailyOrderLimit
        });
      }
    }

    const [pickupPoint, dropoffPoint] = await Promise.all([
      resolveCoordinates(req.body.pickupLat, req.body.pickupLng, pickupAddress),
      resolveCoordinates(req.body.dropoffLat, req.body.dropoffLng, dropoffAddress)
    ]);
    if (pickupPoint.invalid || dropoffPoint.invalid) {
      return res.status(400).json({ error: 'Las coordenadas deben estar dentro de Colombia.' });
    }

    const id = randomUUID();
    const order = await prisma.order.create({
      data: {
        id,
        code: `PED-${id.slice(0, 8).toUpperCase()}`,
        qrToken: randomUUID(),
        businessId: req.user.id,
        price,
        customerName,
        customerPhone,
        pickupAddress,
        dropoffAddress,
        pickupLat: pickupPoint.lat,
        pickupLng: pickupPoint.lng,
        dropoffLat: dropoffPoint.lat,
        dropoffLng: dropoffPoint.lng,
        notes: notes || null,
        status: 'PENDING',
        pickupPin: randomInt(1000, 10000).toString(),
        dropoffPin: randomInt(1000, 10000).toString()
      },
      select: { ...orderSelect, pickupPin: true, qrToken: true }
    });

    const payload = serializeOrder(order);
    req.io.to('role:COURIER').emit('new_order', payload);
    res.status(201).json({
      ...payload,
      pickupPin: order.pickupPin,
      qrToken: order.qrToken,
      geocoded: { pickup: pickupPoint.lat !== null, dropoff: dropoffPoint.lat !== null }
    });
  } catch {
    res.status(500).json({ error: 'Error creando el pedido.' });
  }
});

router.post('/:orderId/accept', requireRole('COURIER'), async (req, res) => {
  try {
    const courier = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isBlocked: true, name: true }
    });
    if (courier.isBlocked) {
      return res.status(403).json({ error: 'Cuenta bloqueada por tope de deuda.' });
    }

    const accepted = await prisma.order.updateMany({
      where: { id: req.params.orderId, status: 'PENDING' },
      data: { status: 'ACCEPTED', courierId: req.user.id }
    });
    if (!accepted.count) return res.status(400).json({ error: 'El pedido ya no está disponible.' });

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: orderSelect
    });
    const payload = serializeOrder(order);
    req.io.to(`user:${order.businessId}`).emit('order_accepted', {
      orderId: order.id,
      courierName: courier.name
    });
    req.io.to(`order:${order.id}`).emit('order_updated', payload);
    res.json({ message: 'Pedido aceptado.', order: payload });
  } catch {
    res.status(500).json({ error: 'No fue posible aceptar el pedido.' });
  }
});

router.post('/:orderId/reject', requireRole('COURIER'), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: { id: true, status: true }
    });
    if (!order || order.status !== 'PENDING') {
      return res.status(400).json({ error: 'El pedido ya no está disponible.' });
    }
    res.json({ message: 'Oferta rechazada. Seguiremos buscando pedidos para ti.' });
  } catch {
    res.status(500).json({ error: 'No fue posible rechazar el pedido.' });
  }
});

router.get('/:orderId', async (req, res) => {
  try {
    const access = await findParticipantOrder(req.params.orderId, req.user.id);
    const accessError = respondOrderAccessError(res, access.error);
    if (accessError) return accessError;

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      select: {
        ...orderSelect,
        ...(req.user.role === 'BUSINESS' ? { pickupPin: true, qrToken: true } : {})
      }
    });
    res.json({
      ...serializeOrder(order),
      ...(req.user.role === 'BUSINESS' ? { pickupPin: order.pickupPin, qrToken: order.qrToken } : {})
    });
  } catch {
    res.status(500).json({ error: 'No fue posible cargar el pedido.' });
  }
});

router.get('/:orderId/messages', async (req, res) => {
  try {
    const access = await findParticipantOrder(req.params.orderId, req.user.id);
    const accessError = respondOrderAccessError(res, access.error);
    if (accessError) return accessError;

    const messages = await prisma.message.findMany({
      where: { orderId: req.params.orderId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'No fue posible cargar el chat.' });
  }
});

router.post('/:orderId/messages', async (req, res) => {
  try {
    const access = await findParticipantOrder(req.params.orderId, req.user.id);
    const accessError = respondOrderAccessError(res, access.error);
    if (accessError) return accessError;

    const content = cleanText(req.body.content, 1000);
    if (!content) {
      return res.status(400).json({ error: 'El mensaje debe tener entre 1 y 1000 caracteres.' });
    }
    const message = await prisma.message.create({
      data: {
        orderId: req.params.orderId,
        content,
        senderRole: req.user.role
      }
    });
    req.io.to(`order:${req.params.orderId}`).emit('order_message', message);
    res.status(201).json(message);
  } catch {
    res.status(500).json({ error: 'No fue posible enviar el mensaje.' });
  }
});

router.delete('/:orderId/messages', async (req, res) => {
  try {
    const access = await findParticipantOrder(req.params.orderId, req.user.id);
    const accessError = respondOrderAccessError(res, access.error);
    if (accessError) return accessError;

    await prisma.message.deleteMany({ where: { orderId: req.params.orderId } });
    req.io.to(`order:${req.params.orderId}`).emit('order_chat_cleared', { orderId: req.params.orderId });
    res.json({ message: 'Chat eliminado.' });
  } catch {
    res.status(500).json({ error: 'No fue posible eliminar el chat.' });
  }
});

// El domiciliario confirma que el paquete coincide con el pedido antes de llevarlo.
router.post('/:orderId/verify', requireRole('COURIER'), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (order.courierId !== req.user.id) {
      return res.status(403).json({ error: 'Este pedido no está asignado a tu cuenta.' });
    }
    if (!['ACCEPTED', 'PICKED_UP'].includes(order.status)) {
      return res.status(400).json({ error: 'El pedido no está disponible para verificar.' });
    }

    const photos = {
      orderPhoto: cleanPhoto(req.body.orderPhoto),
      invoicePhoto: cleanPhoto(req.body.invoicePhoto),
      qrPhoto: cleanPhoto(req.body.qrPhoto)
    };
    if (!photos.orderPhoto || !photos.invoicePhoto || !photos.qrPhoto) {
      return res.status(400).json({
        error: 'Adjunta las tres fotos: el pedido, la factura y el QR asignado.'
      });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { ...photos, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
      select: orderSelect
    });
    const payload = serializeOrder(updated);
    req.io.to(`order:${order.id}`).emit('order_updated', payload);
    req.io.to(`user:${order.businessId}`).emit('order_verified', {
      orderId: order.id,
      code: order.code,
      verifiedAt: updated.verifiedAt
    });
    res.json({
      message: 'Pedido verificado. Ya puedes recogerlo y llevarlo al cliente.',
      order: payload
    });
  } catch {
    res.status(500).json({ error: 'No fue posible verificar el pedido.' });
  }
});

router.post('/:orderId/pickup', requireRole('COURIER'), pinAttemptLimiter, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (order.courierId !== req.user.id) {
      return res.status(403).json({ error: 'Este pedido no está asignado a tu cuenta.' });
    }
    if (order.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'El pedido no está listo para recogerse.' });
    }
    if (order.verificationStatus !== 'VERIFIED') {
      return res.status(400).json({
        error: 'Primero verifica el pedido con las fotos del pedido, la factura y el QR asignado.'
      });
    }
    if (order.pickupPin !== req.body.pin) {
      return res.status(400).json({ error: 'PIN de recogida inválido.' });
    }

    const updatedCount = await prisma.order.updateMany({
      where: { id: order.id, courierId: req.user.id, status: 'ACCEPTED' },
      data: { status: 'PICKED_UP' }
    });
    if (!updatedCount.count) return res.status(400).json({ error: 'El estado del pedido cambió. Actualiza e intenta de nuevo.' });

    const updated = await prisma.order.findUnique({ where: { id: order.id }, select: orderSelect });
    const payload = serializeOrder(updated);
    req.io.to(`order:${order.id}`).emit('order_updated', payload);
    res.json({ message: 'Recogida confirmada.', order: payload });
  } catch {
    res.status(500).json({ error: 'No fue posible confirmar la recogida.' });
  }
});

router.post('/:orderId/complete', requireRole('COURIER'), pinAttemptLimiter, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (order.courierId !== req.user.id) {
      return res.status(403).json({ error: 'Este pedido no está asignado a tu cuenta.' });
    }
    if (order.status !== 'PICKED_UP') {
      return res.status(400).json({ error: 'El pedido no está listo para finalizarse.' });
    }
    if (order.dropoffPin !== req.body.pin) {
      return res.status(400).json({ error: 'PIN de entrega inválido.' });
    }

    const updated = await prisma.$transaction(async transaction => {
      const transitioned = await transaction.order.updateMany({
        where: { id: order.id, courierId: req.user.id, status: 'PICKED_UP' },
        data: { status: 'DELIVERED' }
      });
      if (!transitioned.count) return null;

      await transaction.ledger.createMany({
        data: [
          {
            userId: req.user.id,
            type: 'PLATFORM_FEE',
            amount: -5000,
            description: `Fee for order ${order.id}`
          },
          {
            userId: req.user.id,
            type: 'EARNING',
            amount: order.price - 5000,
            description: `Earning for order ${order.id}`
          }
        ]
      });

      const courier = await transaction.user.update({
        where: { id: req.user.id },
        data: { debt: { increment: 5000 } },
        select: { debt: true }
      });
      if (courier.debt >= 50000) {
        await transaction.user.update({
          where: { id: req.user.id },
          data: { isBlocked: true }
        });
      }

      return transaction.order.findUnique({
        where: { id: order.id },
        select: orderSelect
      });
    });
    if (!updated) return res.status(400).json({ error: 'El pedido ya fue finalizado.' });

    const payload = serializeOrder(updated);
    req.io.to(`order:${order.id}`).emit('order_updated', payload);
    res.json({ message: 'Entrega finalizada y liquidación registrada.', order: payload });
  } catch {
    res.status(500).json({ error: 'No fue posible finalizar el pedido.' });
  }
});

module.exports = router;
