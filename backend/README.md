# Backend

API Express + Prisma (PostgreSQL) con Socket.IO.

## Variables de entorno

Copia `backend/.env.example` a `backend/.env` y completa:

- `DATABASE_URL`: cadena de conexión PostgreSQL.
- `JWT_SECRET`: secreto aleatorio de al menos 32 bytes. El servidor no arranca si falta o es más corto.
- `CORS_ORIGINS`: orígenes exactos del frontend separados por coma. Por defecto local: `http://localhost:5173,http://localhost:5174,http://localhost:4173`.
- `GEOCODING_USER_AGENT`: identificador opcional para Nominatim (por defecto `RutaColombia/1.0`).
- `PORT`: puerto HTTP (por defecto `3000`).

`src/server.js` carga `backend/.env` automáticamente en local. En Vercel las variables se inyectan desde el panel del proyecto y tienen prioridad sobre el archivo.

## PostgreSQL local (binarios portables, sin instalador)

En este equipo PostgreSQL 16.11 está en `C:\Users\jonathan\pgsql`:

```bash
# Iniciar
C:/Users/jonathan/pgsql/pgsql/bin/pg_ctl.exe -D "C:/Users/jonathan/pgsql/data" -l "C:/Users/jonathan/pgsql/postgres.log" -o "-p 5432" start

# Detener
C:/Users/jonathan/pgsql/pgsql/bin/pg_ctl.exe -D "C:/Users/jonathan/pgsql/data" stop
```

La base `mensajeria` ya está creada con usuario `postgres` / contraseña `postgres` y autenticación `trust` local.

## Levantar el backend

```bash
cd backend
npm install
npx prisma db push      # sincroniza el esquema
npm start               # http://localhost:3000
```

## Tests

```bash
cd backend
npm test
```

Usan la misma base configurada en `.env` y crean usuarios con correos únicos.

## Despliegue en Vercel

- El servicio backend usa `backend/api/index.js` como entrypoint (`vercel.json`).
- Configura `DATABASE_URL` (Postgres remoto, p. ej. Neon o Supabase), `JWT_SECRET` y `CORS_ORIGINS` con el dominio de producción en las variables de entorno del proyecto.
- El frontend en producción llama a `/api` en el mismo dominio, por lo que no necesita `VITE_API_URL`.
- Socket.IO no funciona en funciones serverless de Vercel: en producción las notificaciones en tiempo real quedan desactivadas. Para tenerlas, aloja el backend en un servicio con proceso persistente (Render, Railway, Fly.io) y define `VITE_API_URL` con esa URL.

## Cobertura nacional (Colombia)

Al crear un pedido, las direcciones se geocodifican con Nominatim/OpenStreetMap limitadas a Colombia (`countrycodes=co`) y se guardan latitud/longitud. Si una dirección no se puede ubicar, el pedido se crea igual con la dirección escrita y el domiciliario navega con ella. El mapa del domiciliario usa su GPS real y abre la ruta en Google Maps, así que funciona en cualquier ciudad o municipio.

Nominatim es gratuito pero limita a ~1 solicitud por segundo; el backend las serializa y cachea. Para alto volumen conviene cambiar `src/geocoding.js` por un proveedor con SLA (Google Geocoding, Mapbox) sin tocar el resto del flujo.

### Rutas por calles en el mapa

`GET /api/orders/route?from=lat,lng&to=lat,lng` devuelve `{ route: { coordinates: [[lat,lng], ...], distance, duration } }` con la ruta vehicular real entre dos puntos de Colombia, o `{ route: null }` si el servicio no responde.

- Usa OSRM público (`src/routing.js`), sin API key, con caché de 5 minutos y solicitudes serializadas.
- Cobertura nacional: se validaron rutas reales en Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Villavicencio, Pasto, Leticia, Riohacha, Ipiales y San Andrés.
- Si el servidor principal falla se intenta el espejo de FOSSGIS (`routing.openstreetmap.de`). Para usar otro servidor OSRM basta definir `ROUTING_BASE_URL`.
- El mapa del domiciliario pinta la ruta de recogida, la ruta completa recogida → entrega y el tramo recorrido; si la ruta no está disponible dibuja una línea directa como respaldo.
- Los mosaicos del mapa son de OpenStreetMap, sin clave. Para alto volumen conviene un proveedor de tiles y un OSRM propio con el extracto de Colombia.

## Catálogo del comercio

El portal de comercios administra su catálogo con estos endpoints, todos solo para el rol `BUSINESS`:

- `GET /api/products/mine`: lista productos y combos del comercio autenticado.
- `POST /api/products`: crea un producto (nombre, categoría, precio, descripción, disponibilidad y foto).
- `POST /api/products/combos`: crea un combo con `items: [{ productId, quantity }]` de productos propios.
- `PATCH /api/products/:id`: edita el producto/combo y, en combos, reemplaza sus ítems.
- `DELETE /api/products/:id`: elimina el producto o combo.

Las fotos se envían como data URL (`image/jpeg`, `image/png` o `image/webp`, máximo 1,5 MB de texto) y se guardan en PostgreSQL. El portal las comprime en el navegador a WebP de hasta 1000 px antes de enviarlas. Al borrar un producto en uso, sus combos también se eliminan en cascada.

## Ofertas programadas

Cada producto o combo acepta una oferta con `offerPrice` (debe ser menor al precio normal), `offerTitle`, `offerStart` y `offerEnd` (`YYYY-MM-DD`, opcionales), `offerWeekdays` (array `0`=domingo … `6`=sábado) y `offerOnHolidays`.

- Sin días ni festivos marcados, la oferta aplica todos los días del rango.
- Con días marcados, aplica esos días; `offerOnHolidays` agrega los festivos colombianos.
- Sin fechas, queda vigente de forma indefinida.

La API calcula el estado con la fecha de Bogotá: `ACTIVE`, `SCHEDULED` o `EXPIRED`, junto con el ahorro y el porcentaje de descuento. Los festivos de Colombia se calculan localmente en `src/holidays.js` (fijos, Ley Emiliani y Semana Santa), sin servicios externos.

## Capacidad diaria de despachos

Cada comercio puede limitar cuántos pedidos crea por día. El límite se gestiona con `PATCH /api/auth/me` enviando `{ "dailyOrderLimit": 25 }` (entero de 1 a 500) o `{ "dailyOrderLimit": null }` para no limitar.

- `GET /api/orders/business/summary` devuelve `date`, `ordersToday`, `dailyOrderLimit`, `remaining` y `canCreate` para el día actual de Bogotá.
- `POST /api/orders` responde `409` con el detalle del límite cuando ya se alcanzó el cupo del día.
- El conteo usa `createdAt` dentro del día local de Colombia, no del día UTC.

## Código, QR y verificación del pedido

Al crear un pedido se generan `code` (legible, `PED-XXXXXXXX`) y `qrToken` (UUID). El comercio ve ambos y el portal de comercios los presenta en el QR que entrega al domiciliario; la lista del domiciliario incluye `code` y `customerName`, pero nunca el `pickupPin` ni el `qrToken`.

Antes de recoger, el domiciliario debe verificar el pedido con `POST /api/orders/:orderId/verify`:

```json
{ "orderPhoto": "data:image/webp;base64,...", "invoicePhoto": "data:image/webp;base64,...", "qrPhoto": "data:image/webp;base64,..." }
```

Las tres fotos son obligatorias (`image/jpeg`, `image/png` o `image/webp`, máximo 700 000 caracteres por foto). La respuesta marca `verificationStatus: "VERIFIED"` y `verifiedAt`, y notifica por socket al comercio (`order_verified`). Sin ese estado, `POST /api/orders/:orderId/pickup` responde `400`.

## Disponibilidad y zona de trabajo del domiciliario

Al pasar a ONLINE, la app del domiciliario pide la ubicación del teléfono automáticamente y la guarda con `PATCH /api/auth/availability`:

```json
{ "isOnline": true, "lat": 6.2442, "lng": -75.5812, "serviceRadiusKm": 6 }
```

- Sin coordenadas válidas dentro de Colombia el endpoint responde `400`: no se puede quedar disponible sin zona.
- `serviceRadiusKm` es el radio de trabajo en kilómetros (entero de 1 a 50, por defecto 6).
- Para desconectarse se envía `{ "isOnline": false }`; la última ubicación se conserva como referencia.
- `GET /api/auth/me` devuelve `isOnline`, `lastLat`, `lastLng`, `lastLocationAt` y `serviceRadiusKm`.

`GET /api/orders/available` calcula la distancia Haversine desde esa ubicación hasta la recogida de cada pedido, devuelve solo los que están dentro del radio y los ordena del más cercano al más lejano, agregando `distanceKm`. Los pedidos sin coordenadas (dirección no geocodificada) se incluyen al final con `distanceKm: null`. Si el domiciliario nunca ha guardado ubicación, se devuelven todos para no romper clientes antiguos.

La app guarda de nuevo la ubicación cada 30 segundos o cuando el domiciliario se mueve más de 300 metros, y descarta las notificaciones en tiempo real de pedidos que recogen fuera del radio elegido. El panel muestra un mapa con su posición, el círculo de la zona y las recogidas disponibles.

## Endpoints protegidos

Pedidos, billetera y catálogo requieren `Authorization: Bearer <token>`. La recuperación de contraseña y el pago de deuda responden `503` a propósito hasta integrar un proveedor verificado.
