const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticate, getJwtSecret, prisma } = require('../auth');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, name, role, bankAccount, vehicle } = req.body;

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'El correo electrónico no es válido.' });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!['COURIER', 'BUSINESS'].includes(role)) {
      return res.status(400).json({ error: 'El tipo de cuenta no es válido.' });
    }

    // Validación Estricta de Contraseña
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (typeof password !== 'string' || !passwordRegex.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.' });
    }

    // Validación de Vehículo para Domiciliarios
    if (role === 'COURIER' && !['Moto', 'Bicicleta', 'Carro'].includes(vehicle)) {
      return res.status(400).json({ error: 'Debes seleccionar un vehículo válido (Moto, Bicicleta o Carro).' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        name: name.trim().slice(0, 80),
        role,
        bankAccount: typeof bankAccount === 'string' ? bankAccount.trim().slice(0, 80) || null : null,
        vehicle: role === 'COURIER' ? vehicle : null
      }
    });
    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), { expiresIn: '1d', algorithm: 'HS256' });
    res.json({
      message: 'User registered successfully',
      userId: user.id,
      token,
      user: { id: user.id, name: user.name, role: user.role, isVerified: user.isVerified }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ese correo ya está registrado.' });
    }
    res.status(400).json({ error: 'Registration failed or email exists' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        vehicle: true,
        bankAccount: true,
        isVerified: true,
        cardBalance: true,
        debt: true,
        isBlocked: true,
        dailyOrderLimit: true,
        isOnline: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        serviceRadiusKm: true,
        createdAt: true
      }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'No fue posible cargar tu perfil.' });
  }
});

router.patch('/me', authenticate, async (req, res) => {
  try {
    const data = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      data.name = req.body.name.trim().slice(0, 80);
    }
    if (typeof req.body.bankAccount === 'string') {
      data.bankAccount = req.body.bankAccount.trim().slice(0, 80) || null;
    }
    if (req.user.role === 'COURIER' && req.body.vehicle !== undefined) {
      if (!['Moto', 'Bicicleta', 'Carro'].includes(req.body.vehicle)) {
        return res.status(400).json({ error: 'Vehículo no válido.' });
      }
      data.vehicle = req.body.vehicle;
    }
    if (req.user.role === 'BUSINESS' && req.body.dailyOrderLimit !== undefined) {
      if (req.body.dailyOrderLimit === null || req.body.dailyOrderLimit === '') {
        data.dailyOrderLimit = null;
      } else {
        const limit = Number(req.body.dailyOrderLimit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
          return res.status(400).json({
            error: 'El límite diario debe ser un número entero entre 1 y 500, o vacío para no limitar.'
          });
        }
        data.dailyOrderLimit = limit;
      }
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'No hay datos para actualizar.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        vehicle: true,
        bankAccount: true,
        isVerified: true,
        cardBalance: true,
        debt: true,
        isBlocked: true,
        dailyOrderLimit: true,
        isOnline: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        serviceRadiusKm: true
      }
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'No fue posible actualizar tu perfil.' });
  }
});

// Disponibilidad del domiciliario: al conectarse se guarda su ubicación y la zona
// donde acepta pedidos, para que el despacho solo le muestre los cercanos.
router.patch('/availability', authenticate, async (req, res) => {
  if (req.user.role !== 'COURIER') {
    return res.status(403).json({ error: 'Solo los domiciliarios manejan su disponibilidad.' });
  }

  const { isOnline, lat, lng, serviceRadiusKm } = req.body || {};
  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ error: 'Indica si estás disponible para recibir pedidos.' });
  }

  const data = { isOnline };

  if (isOnline) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    const inColombia = Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -5 && latitude <= 14
      && longitude >= -83 && longitude <= -66;
    if (!inColombia) {
      return res.status(400).json({ error: 'Activa la ubicación del teléfono para conectarte y recibir pedidos.' });
    }
    data.lastLat = latitude;
    data.lastLng = longitude;
    data.lastLocationAt = new Date();
  }

  if (serviceRadiusKm !== undefined) {
    const radius = Number(serviceRadiusKm);
    if (!Number.isInteger(radius) || radius < 1 || radius > 50) {
      return res.status(400).json({ error: 'La zona de trabajo debe estar entre 1 y 50 km.' });
    }
    data.serviceRadiusKm = radius;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        isOnline: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
        serviceRadiusKm: true
      }
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'No fue posible guardar tu disponibilidad.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), { expiresIn: '1d', algorithm: 'HS256' });
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, role: user.role, isVerified: user.isVerified } });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

router.post('/forgot-password', resetLimiter, (req, res) => {
  res.status(503).json({
    error: 'La recuperación de contraseña no está disponible hasta configurar un canal de correo o SMS verificado.'
  });
});

router.post('/verify-code', resetLimiter, (req, res) => {
  res.status(503).json({ error: 'La recuperación de contraseña no está disponible.' });
});

router.post('/reset-password', resetLimiter, (req, res) => {
  res.status(503).json({ error: 'La recuperación de contraseña no está disponible.' });
});

// 4. Subir Documentos KYC (Simulación)
// Multer procesa el multipart/form-data creado por FormData en el frontend.
router.post('/upload-docs', authenticate, upload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 }
]), async (req, res) => {
  try {
    const hasAllDocuments = ['selfie', 'idFront', 'idBack']
      .every(field => req.files?.[field]?.[0]);

    if (!hasAllDocuments) {
      return res.status(400).json({ error: 'Debes enviar la selfie y ambos lados de la cédula.' });
    }
    
    // Simulación: En un sistema real aquí se procesarían los multipart/form-data
    // y se guardarían las fotos en S3/Cloudinary.
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { isVerified: true }
    });

    res.json({ message: 'Documentos verificados exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar documentos.' });
  }
});

module.exports = router;
