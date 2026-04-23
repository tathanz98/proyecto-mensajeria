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
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

// 1. Solicitar Código de Recuperación (Forgot Password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Devolvemos 200 aunque no exista para evitar escaneo de correos, o error si preferimos.
      return res.status(404).json({ error: 'Si el correo existe, se ha enviado un código.' });
    }

    // Generar código numérico de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { email },
      data: { resetCode, resetCodeExpires }
    });

    // SIMULACIÓN DE ENVÍO DE CORREO / SMS:
    console.log(`[SIMULACRO SMS/EMAIL] Código para ${email}: ${resetCode}`);
    
    res.json({ message: 'Código de 6 dígitos enviado al correo/celular.', simulatedCode: resetCode });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando la solicitud' });
  }
});

// 2. Verificar Código (Verify Code)
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.resetCode !== code) {
      return res.status(400).json({ error: 'Código incorrecto.' });
    }

    if (new Date() > user.resetCodeExpires) {
      return res.status(400).json({ error: 'El código ha expirado.' });
    }

    // Código válido, devolver un token temporal para permitir cambiar la contraseña
    const tempToken = jwt.sign({ userId: user.id, resetAllowed: true }, process.env.JWT_SECRET || 'super-secret', { expiresIn: '15m' });
    
    res.json({ message: 'Código verificado correctamente.', tempToken });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando el código' });
  }
});

// 3. Restablecer Contraseña (Reset Password)
router.post('/reset-password', async (req, res) => {
  try {
    const { tempToken, newPassword } = req.body;
    
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'super-secret');
    if (!decoded.resetAllowed) return res.status(403).json({ error: 'Token inválido.' });

    // Validar seguridad de la nueva contraseña
    const passRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passRegex.test(newPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener 8 caracteres, 1 mayúscula y 1 número.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { 
        password: hashedPassword,
        resetCode: null,
        resetCodeExpires: null
      }
    });

    res.json({ message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(400).json({ error: 'Token expirado o inválido.' });
  }
});

module.exports = router;
