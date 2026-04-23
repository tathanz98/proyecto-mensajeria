const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = 'supersecretkey123'; // Demo key

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, bankAccount, vehicle } = req.body;
    
    // Validación Estricta de Contraseña
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.' });
    }

    // Validación de Vehículo para Domiciliarios
    if (role === 'COURIER' && !['Moto', 'Bicicleta', 'Carro'].includes(vehicle)) {
      return res.status(400).json({ error: 'Debes seleccionar un vehículo válido (Moto, Bicicleta o Carro).' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role, bankAccount, vehicle }
    });
    res.json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'Registration failed or email exists' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
