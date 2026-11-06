// Entrypoint para Vercel: los servicios Node esperan que el módulo exporte
// directamente el handler (la app Express), no un objeto con utilidades.
const { app } = require('../src/server');

module.exports = app;
