const express = require('express');
const { requireRole } = require('../auth');
const { offerDataForCreate, offerDataForUpdate, serializeOffer } = require('../offers');

const router = express.Router();
const prisma = require('../auth').prisma;

const MAX_IMAGE_LENGTH = 1_500_000;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const productSelect = {
  id: true,
  kind: true,
  name: true,
  description: true,
  category: true,
  price: true,
  imageData: true,
  isAvailable: true,
  offerPrice: true,
  offerTitle: true,
  offerStart: true,
  offerEnd: true,
  offerWeekdays: true,
  offerOnHolidays: true,
  createdAt: true,
  comboItems: {
    select: {
      quantity: true,
      product: { select: { id: true, name: true, price: true } }
    }
  }
};

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanImage(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > MAX_IMAGE_LENGTH || !IMAGE_PATTERN.test(value)) {
    return 'invalid';
  }
  return value;
}

function serializeProduct(product) {
  const items = (product.comboItems || []).map(item => ({
    productId: item.product.id,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity
  }));
  return {
    id: product.id,
    kind: product.kind,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    imageData: product.imageData,
    isAvailable: product.isAvailable,
    createdAt: product.createdAt,
    items,
    regularPrice: items.reduce((total, item) => total + item.price * item.quantity, 0),
    offer: serializeOffer(product)
  };
}

function normalizeItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return 'invalid';
  const merged = new Map();
  for (const item of raw) {
    const productId = typeof item?.productId === 'string' ? item.productId : '';
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return 'invalid';
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  if (merged.size > 20) return 'invalid';
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

async function validateOwnedProducts(businessId, items) {
  const ids = items.map(item => item.productId);
  const owned = await prisma.product.findMany({
    where: { id: { in: ids }, businessId, kind: 'PRODUCT' },
    select: { id: true }
  });
  return owned.length === ids.length;
}

router.use(requireRole('BUSINESS'));

router.get('/mine', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { businessId: req.user.id },
      orderBy: { createdAt: 'asc' },
      select: productSelect
    });
    res.json(products.map(serializeProduct));
  } catch {
    res.status(500).json({ error: 'No fue posible cargar tu catálogo.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = cleanText(req.body.name, 80);
    const price = Number(req.body.price);
    const imageData = cleanImage(req.body.imageData);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'Indica un nombre y un precio válido para el producto.' });
    }
    if (imageData === 'invalid') {
      return res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WebP de máximo 1,5 MB.' });
    }

    const offer = offerDataForCreate(req.body, price);
    if (offer.error) return res.status(400).json({ error: offer.error });

    const product = await prisma.product.create({
      data: {
        businessId: req.user.id,
        kind: 'PRODUCT',
        name,
        description: cleanText(req.body.description, 300) || null,
        category: cleanText(req.body.category, 40) || null,
        price,
        imageData: imageData ?? null,
        isAvailable: req.body.isAvailable !== false,
        ...offer.data
      },
      select: productSelect
    });
    res.status(201).json(serializeProduct(product));
  } catch {
    res.status(500).json({ error: 'No fue posible crear el producto.' });
  }
});

router.post('/combos', async (req, res) => {
  try {
    const name = cleanText(req.body.name, 80);
    const price = Number(req.body.price);
    const imageData = cleanImage(req.body.imageData);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'Indica un nombre y un precio válido para el combo.' });
    }
    if (imageData === 'invalid') {
      return res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WebP de máximo 1,5 MB.' });
    }

    const items = normalizeItems(req.body.items);
    if (items === 'invalid') {
      return res.status(400).json({ error: 'Selecciona al menos un producto con cantidades entre 1 y 99.' });
    }
    if (!(await validateOwnedProducts(req.user.id, items))) {
      return res.status(400).json({ error: 'Solo puedes combinar productos de tu propio catálogo.' });
    }

    const offer = offerDataForCreate(req.body, price);
    if (offer.error) return res.status(400).json({ error: offer.error });

    const combo = await prisma.product.create({
      data: {
        businessId: req.user.id,
        kind: 'COMBO',
        name,
        description: cleanText(req.body.description, 300) || null,
        category: cleanText(req.body.category, 40) || null,
        price,
        imageData: imageData ?? null,
        isAvailable: req.body.isAvailable !== false,
        ...offer.data,
        comboItems: { create: items }
      },
      select: productSelect
    });
    res.status(201).json(serializeProduct(combo));
  } catch {
    res.status(500).json({ error: 'No fue posible crear el combo.' });
  }
});

router.patch('/:productId', async (req, res) => {
  try {
    const current = await prisma.product.findFirst({
      where: { id: req.params.productId, businessId: req.user.id },
      select: {
        id: true,
        kind: true,
        price: true,
        offerPrice: true,
        offerTitle: true,
        offerStart: true,
        offerEnd: true,
        offerWeekdays: true,
        offerOnHolidays: true
      }
    });
    if (!current) return res.status(404).json({ error: 'Producto no encontrado.' });

    const data = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 80);
      if (!name) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
      data.name = name;
    }
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: 'El precio no es válido.' });
      }
      data.price = price;
    }
    if (req.body.description !== undefined) data.description = cleanText(req.body.description, 300) || null;
    if (req.body.category !== undefined) data.category = cleanText(req.body.category, 40) || null;
    if (req.body.isAvailable !== undefined) data.isAvailable = Boolean(req.body.isAvailable);
    if (req.body.imageData !== undefined) {
      const imageData = cleanImage(req.body.imageData);
      if (imageData === 'invalid') {
        return res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WebP de máximo 1,5 MB.' });
      }
      data.imageData = imageData;
    }

    let items = null;
    if (req.body.items !== undefined) {
      if (current.kind !== 'COMBO') {
        return res.status(400).json({ error: 'Solo los combos pueden tener productos asociados.' });
      }
      items = normalizeItems(req.body.items);
      if (items === 'invalid') {
        return res.status(400).json({ error: 'Selecciona al menos un producto con cantidades entre 1 y 99.' });
      }
      if (!(await validateOwnedProducts(req.user.id, items))) {
        return res.status(400).json({ error: 'Solo puedes combinar productos de tu propio catálogo.' });
      }
    }

    const offer = offerDataForUpdate(current, req.body, data.price ?? current.price);
    if (offer.error) return res.status(400).json({ error: offer.error });
    Object.assign(data, offer.data);

    const updated = await prisma.$transaction(async transaction => {
      if (items) {
        await transaction.comboItem.deleteMany({ where: { comboId: current.id } });
        await transaction.comboItem.createMany({
          data: items.map(item => ({ ...item, comboId: current.id }))
        });
      }
      return transaction.product.update({
        where: { id: current.id },
        data,
        select: productSelect
      });
    });

    res.json(serializeProduct(updated));
  } catch {
    res.status(500).json({ error: 'No fue posible actualizar el producto.' });
  }
});

router.delete('/:productId', async (req, res) => {
  try {
    const deleted = await prisma.product.deleteMany({
      where: { id: req.params.productId, businessId: req.user.id }
    });
    if (!deleted.count) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ message: 'Producto eliminado.' });
  } catch {
    res.status(500).json({ error: 'No fue posible eliminar el producto.' });
  }
});

module.exports = router;
