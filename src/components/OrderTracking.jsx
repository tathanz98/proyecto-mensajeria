import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MessageSquare, Navigation, MapPinOff, ShieldCheck, Camera, CheckCircle, X, LocateFixed, Route } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { authenticatedFetch } from '../api';
import OrderChat from './OrderChat';

// Centro de Colombia: se usa solo cuando el pedido no tiene coordenadas.
const COLOMBIA_CENTER = [4.5709, -74.2973];

const pickupIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #f59e0b; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const dropoffIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #ef4444; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const driverIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #10b981; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(16,185,129,0.8);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const hasCoordinate = value => typeof value === 'number' && Number.isFinite(value);

const EARTH_RADIUS_M = 6371000;

function haversine(a, b) {
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const formatDistance = meters => (meters >= 1000
  ? `${(meters / 1000).toFixed(1)} km`
  : `${Math.max(10, Math.round(meters / 10) * 10)} m`);

const formatDuration = seconds => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

async function fetchRoute(from, to, signal) {
  try {
    const response = await authenticatedFetch(
      `/api/orders/route?from=${from[0].toFixed(5)},${from[1].toFixed(5)}&to=${to[0].toFixed(5)},${to[1].toFixed(5)}`,
      { signal }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.route || null;
  } catch {
    return null;
  }
}

const MAX_PHOTO_CHARS = 650_000;

const VERIFICATION_PHOTOS = [
  { key: 'orderPhoto', label: 'Foto del pedido', hint: 'El pedido empacado que vas a llevar' },
  { key: 'invoicePhoto', label: 'Foto de la factura', hint: 'Factura o recibo del comercio' },
  { key: 'qrPhoto', label: 'Foto del QR', hint: 'QR asignado al pedido' }
];

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('El formato de imagen no es compatible.'));
      image.onload = () => {
        const maxSide = 800;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

        let quality = 0.7;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        while (dataUrl.length > MAX_PHOTO_CHARS && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/webp', quality);
        }
        if (dataUrl.length > MAX_PHOTO_CHARS) reject(new Error('La foto es demasiado pesada. Intenta de nuevo.'));
        else resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Ajusta la vista solo cuando cambia el tramo, no en cada lectura del GPS.
function FitRoute({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    // El contenedor termina de medirse después del primer render; sin esto el encuadre sale muy lejano.
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (!points.length) {
        map.setView(COLOMBIA_CENTER, 6);
        return;
      }
      if (points.length === 1) {
        map.setView(points[0], 16);
        return;
      }
      map.fitBounds(points, {
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 40],
        maxZoom: 16
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [map, fitKey]);
  return null;
}

function MapBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function OrderTracking({ onNavigate, order }) {
  const [stage, setStage] = useState(order?.status === 'PICKED_UP' ? 'dropoff' : 'pickup');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [verifyingPickup, setVerifyingPickup] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverAccuracy, setDriverAccuracy] = useState(0);
  const [geoError, setGeoError] = useState('');
  const [mapInstance, setMapInstance] = useState(null);
  const [followDriver, setFollowDriver] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [tripRoute, setTripRoute] = useState(null);
  const [traveled, setTraveled] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [photos, setPhotos] = useState({ orderPhoto: null, invoicePhoto: null, qrPhoto: null });
  const [photoBusy, setPhotoBusy] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyingOrder, setVerifyingOrder] = useState(false);
  const [verifiedLocally, setVerifiedLocally] = useState(false);

  const isVerified = verifiedLocally
    || order?.verificationStatus === 'VERIFIED'
    || order?.status === 'PICKED_UP';
  const allPhotosReady = VERIFICATION_PHOTOS.every(field => photos[field.key]);

  // Posición real del domiciliario; si niega el permiso, el mapa usa solo el pedido.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Este dispositivo no permite obtener tu ubicación.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      position => {
        setDriverLocation([position.coords.latitude, position.coords.longitude]);
        setDriverAccuracy(Number(position.coords.accuracy) || 0);
        setGeoError('');
      },
      () => setGeoError('Activa la ubicación del teléfono para ver tu posición en el mapa.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const pickupLocation = hasCoordinate(order?.pickupLat) && hasCoordinate(order?.pickupLng)
    ? [order.pickupLat, order.pickupLng]
    : null;
  const dropoffLocation = hasCoordinate(order?.dropoffLat) && hasCoordinate(order?.dropoffLng)
    ? [order.dropoffLat, order.dropoffLng]
    : null;
  const targetLocation = stage === 'pickup' ? pickupLocation : dropoffLocation;
  const targetAddress = stage === 'pickup' ? order?.pickupAddress : order?.dropoffAddress;

  const pickupKey = pickupLocation ? pickupLocation.join(',') : '';
  const dropoffKey = dropoffLocation ? dropoffLocation.join(',') : '';
  const targetKey = targetLocation ? `${stage}:${targetLocation.join(',')}` : '';
  // Redondeo a ~110 m: la ruta se recalcula solo cuando el domiciliario avanza de verdad.
  const snappedDriverKey = driverLocation
    ? `${driverLocation[0].toFixed(3)},${driverLocation[1].toFixed(3)}`
    : '';
  const routeForStage = activeRoute?.targetKey === targetKey ? activeRoute.route : null;

  // Ruta por calles hacia el comercio (recogida) o hacia el cliente (entrega).
  useEffect(() => {
    if (!driverLocation || !targetLocation) return;
    const controller = new AbortController();
    let cancelled = false;
    fetchRoute(driverLocation, targetLocation, controller.signal).then(route => {
      if (!cancelled && route) setActiveRoute({ targetKey, route });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [snappedDriverKey, targetKey]);

  // Ruta completa recogida → entrega: se muestra punteada antes de recoger y sólida después.
  useEffect(() => {
    setTripRoute(null);
    if (!pickupLocation || !dropoffLocation) return;
    const controller = new AbortController();
    let cancelled = false;
    fetchRoute(pickupLocation, dropoffLocation, controller.signal).then(route => {
      if (!cancelled && route) setTripRoute(route);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [order?.id, pickupKey, dropoffKey]);

  // Trayecto realmente recorrido desde que recogió el pedido.
  useEffect(() => {
    setTraveled([]);
  }, [order?.id]);

  useEffect(() => {
    if (stage !== 'dropoff' || !driverLocation) return;
    setTraveled(current => {
      const last = current[current.length - 1];
      if (last && haversine(last, driverLocation) < 15) return current;
      const next = [...current, driverLocation];
      return next.length > 800 ? next.slice(next.length - 800) : next;
    });
  }, [driverLocation?.[0], driverLocation?.[1], stage]);

  // Al mover el mapa manualmente se deja de seguir al domiciliario.
  useEffect(() => {
    if (!mapInstance) return;
    const stopFollowing = () => setFollowDriver(false);
    mapInstance.on('dragstart', stopFollowing);
    return () => mapInstance.off('dragstart', stopFollowing);
  }, [mapInstance]);

  useEffect(() => {
    if (!followDriver || !mapInstance || !driverLocation) return;
    mapInstance.panTo(driverLocation, { animate: true, duration: 0.4 });
  }, [followDriver, mapInstance, driverLocation?.[0], driverLocation?.[1]]);

  const centerOnDriver = () => {
    if (!mapInstance || !driverLocation) return;
    setFollowDriver(true);
    mapInstance.flyTo(driverLocation, Math.max(mapInstance.getZoom(), 16), { duration: 0.6 });
  };

  const fullPath = tripRoute?.coordinates?.length > 1
    ? tripRoute.coordinates
    : (pickupLocation && dropoffLocation ? [pickupLocation, dropoffLocation] : []);
  const activePath = routeForStage?.coordinates?.length > 1
    ? routeForStage.coordinates
    : (driverLocation && targetLocation ? [driverLocation, targetLocation] : []);
  const traveledPath = stage === 'dropoff' && pickupLocation
    ? [pickupLocation, ...traveled]
    : traveled;

  const points = [pickupLocation, dropoffLocation, driverLocation].filter(Boolean);
  const fitKey = `${order?.id || 'order'}:${stage}:${Boolean(driverLocation)}`;

  const directDistance = driverLocation && targetLocation ? haversine(driverLocation, targetLocation) : 0;
  const remainingDistance = routeForStage?.distance ?? directDistance;
  const remainingDuration = routeForStage?.duration ?? directDistance / 5.5;
  const showEta = Boolean(driverLocation && targetLocation);

  const openNavigation = () => {
    const destination = targetLocation
      ? `${targetLocation[0]},${targetLocation[1]}`
      : `${targetAddress || ''}, Colombia`;
    if (!destination.trim().replace(',', '')) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`,
      '_blank',
      'noopener'
    );
  };

  const verifyPickup = async () => {
    if (pinInput.length !== 4 || !order?.id) return;
    setVerifyingPickup(true);
    setPickupError('');
    try {
      const response = await authenticatedFetch(`/api/orders/${order.id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await response.json();
      if (!response.ok) {
        setPickupError(data.error || 'No fue posible verificar el código.');
        return;
      }
      setShowPinModal(false);
      setStage('dropoff');
      setPinInput('');
    } catch {
      setPickupError('No fue posible conectar para verificar el código.');
    } finally {
      setVerifyingPickup(false);
    }
  };

  const handlePhoto = async (key, file) => {
    if (!file) return;
    setPhotoBusy(key);
    setVerifyError('');
    try {
      const dataUrl = await compressPhoto(file);
      setPhotos(current => ({ ...current, [key]: dataUrl }));
    } catch (error) {
      setVerifyError(error.message);
    } finally {
      setPhotoBusy('');
    }
  };

  const verifyOrder = async () => {
    if (!order?.id || !allPhotosReady) return;
    setVerifyingOrder(true);
    setVerifyError('');
    try {
      const response = await authenticatedFetch(`/api/orders/${order.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photos)
      });
      const data = await response.json();
      if (!response.ok) {
        setVerifyError(data.error || 'No fue posible verificar el pedido.');
        return;
      }
      setVerifiedLocally(true);
      setShowVerifyModal(false);
    } catch {
      setVerifyError('No fue posible conectar para verificar el pedido.');
    } finally {
      setVerifyingOrder(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)' }}>

      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => onNavigate('dashboard')} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={20} />
        </button>

        <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--border-color)', fontWeight: '600', boxShadow: 'var(--shadow-glass)' }}>
          {stage === 'pickup' ? 'Yendo al Restaurante' : 'Yendo al Cliente'}
        </div>

        <a
          href={order?.customerPhone ? `tel:${order.customerPhone}` : undefined}
          style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', cursor: 'pointer', opacity: order?.customerPhone ? 1 : 0.4 }}
          title={order?.customerPhone ? `Llamar a ${order.customerName}` : 'Teléfono no disponible'}
        >
          <Phone size={20} />
        </a>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, zIndex: 0 }}>
        <MapContainer
          center={targetLocation || COLOMBIA_CENTER}
          zoom={targetLocation ? 15 : 6}
          zoomControl={false}
          className="leaflet-dark-tiles"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapBridge onReady={setMapInstance} />
          <FitRoute points={points} fitKey={fitKey} />

          {fullPath.length > 1 && (
            <Polyline
              positions={fullPath}
              pathOptions={{
                color: '#64748b',
                weight: stage === 'pickup' ? 4 : 6,
                opacity: stage === 'pickup' ? 0.6 : 0.9,
                dashArray: stage === 'pickup' ? '6 10' : null
              }}
              interactive={false}
            />
          )}
          {traveledPath.length > 1 && (
            <Polyline positions={traveledPath} color="#38bdf8" weight={4} opacity={0.9} interactive={false} />
          )}
          {activePath.length > 1 && (
            <Polyline
              positions={activePath}
              pathOptions={{
                color: '#10b981',
                weight: 5,
                opacity: 0.95,
                dashArray: routeForStage ? null : '8 10'
              }}
              interactive={false}
            />
          )}

          {pickupLocation && <Marker position={pickupLocation} icon={pickupIcon} />}
          {dropoffLocation && <Marker position={dropoffLocation} icon={dropoffIcon} />}
          {driverLocation && driverAccuracy > 0 && (
            <Circle
              center={driverLocation}
              radius={driverAccuracy}
              pathOptions={{ color: '#10b981', weight: 1, opacity: 0.35, fillColor: '#10b981', fillOpacity: 0.08 }}
            />
          )}
          {driverLocation && <Marker position={driverLocation} icon={driverIcon} />}
        </MapContainer>

        <button
          onClick={centerOnDriver}
          disabled={!driverLocation}
          title="Centrar en mi ubicación"
          aria-label="Centrar en mi ubicación"
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '16px',
            zIndex: 500,
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${followDriver ? 'var(--primary)' : 'var(--border-color)'}`,
            color: followDriver ? 'var(--primary)' : 'white',
            cursor: driverLocation ? 'pointer' : 'not-allowed',
            opacity: driverLocation ? 1 : 0.4,
            boxShadow: 'var(--shadow-glass)'
          }}
        >
          <LocateFixed size={22} />
        </button>
      </div>

      <div className="glass-panel animate-slide-up" style={{
        position: 'relative', zIndex: 10,
        flexShrink: 0,
        maxHeight: '50vh',
        overflowY: 'auto',
        borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        padding: '20px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.8)'
      }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>
              Pedido #{order?.code || order?.id?.slice(0, 8) || '—'} · Cliente: {order?.customerName || 'Cliente'}
            </p>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '4px' }}>
              {stage === 'pickup' ? (order?.businessName || 'Comercio') : (order?.customerName || 'Cliente')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {stage === 'pickup'
                ? (order?.pickupAddress || 'Dirección de recogida no registrada')
                : (order?.dropoffAddress || 'Dirección de entrega no registrada')}
            </p>
            {stage === 'dropoff' && order?.customerPhone && (
              <p style={{ color: 'var(--primary)', fontSize: '0.9rem', marginTop: '4px' }}>Tel: {order.customerPhone}</p>
            )}
            {order?.notes && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>Nota: {order.notes}</p>
            )}
            {stage === 'pickup' && (
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginTop: '8px', color: isVerified ? 'var(--success)' : 'var(--warning, #f59e0b)' }}>
                <ShieldCheck size={16} />
                {isVerified ? 'Pedido verificado con fotos' : 'Verifica el pedido con fotos antes de recogerlo'}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>
              ${Number((order?.price || 0) - 5000).toLocaleString()}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tu ganancia</p>
          </div>
        </div>

        {showEta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px' }}>
            <Route size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                {stage === 'pickup' ? 'Al comercio' : 'Al cliente'}: {formatDistance(remainingDistance)}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {routeForStage
                  ? `${formatDuration(remainingDuration)} en moto · ruta por calles`
                  : `≈ ${formatDuration(remainingDuration)} · trayecto directo`}
              </p>
            </div>
          </div>
        )}

        {geoError && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning, #f59e0b)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <MapPinOff size={16} /> {geoError}
          </p>
        )}

        {!targetLocation && (
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning, #f59e0b)', fontSize: '0.85rem', marginBottom: '16px' }}>
            <MapPinOff size={16} /> El comercio no registró coordenadas para este punto. Navega usando la dirección.
          </p>
        )}

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={() => setShowChat(true)}>
            <MessageSquare size={18} /> Chat
          </button>
          <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={openNavigation}>
            <Navigation size={18} /> Navegar
          </button>
        </div>

        {stage === 'pickup' ? (
          isVerified ? (
            <button className="btn-primary" onClick={() => setShowPinModal(true)}>
              Confirmar Recogida
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setShowVerifyModal(true)}>
              <ShieldCheck size={18} /> Verificar pedido con fotos
            </button>
          )
        ) : (
          <button className="btn-primary" onClick={() => onNavigate('proof')} style={{ background: 'var(--warning)', color: 'white' }}>
            Llegué al Destino
          </button>
        )}
      </div>

      {showVerifyModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Verificar pedido</h3>
              <button onClick={() => setShowVerifyModal(false)} aria-label="Cerrar verificación" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              Confirma que el pedido coincide con el cliente <strong style={{ color: 'var(--text-main)' }}>{order?.customerName || 'Cliente'}</strong> y el código <strong style={{ color: 'var(--text-main)' }}>#{order?.code || order?.id?.slice(0, 8)}</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Adjunta tres fotos: el pedido, la factura y el QR asignado. Sin estas fotos no podrás recogerlo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {VERIFICATION_PHOTOS.map(field => (
                <div key={field.key} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', background: 'var(--bg-dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>{field.label}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{field.hint}</p>
                    </div>
                    <label htmlFor={`photo-${field.key}`} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {photos[field.key] ? <CheckCircle size={16} /> : <Camera size={16} />} {photos[field.key] ? 'Cambiar' : 'Foto'}
                    </label>
                    <input
                      id={`photo-${field.key}`}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={event => {
                        handlePhoto(field.key, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </div>
                  {photoBusy === field.key && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>Procesando foto...</p>
                  )}
                  {photos[field.key] && (
                    <img
                      src={photos[field.key]}
                      alt={field.label}
                      style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {verifyError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '14px' }}>{verifyError}</p>}

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={!allPhotosReady || verifyingOrder || Boolean(photoBusy)}
              onClick={verifyOrder}
            >
              {verifyingOrder ? 'Verificando...' : allPhotosReady ? 'Verificar pedido' : 'Adjunta las tres fotos'}
            </button>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Código del Restaurante</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Pídele al restaurante el código de 4 dígitos para poder llevarte el pedido.
            </p>

            <input
              type="text"
              maxLength="4"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              style={{
                width: '100%', textAlign: 'center', fontSize: '2.5rem', letterSpacing: '12px',
                padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-dark)',
                border: '2px solid var(--border-color)', color: 'white', marginBottom: '24px'
              }}
            />
            {pickupError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '16px' }}>{pickupError}</p>}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPinModal(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} disabled={verifyingPickup || pinInput.length !== 4} onClick={verifyPickup}>
                {verifyingPickup ? 'Verificando...' : 'Verificar y Recoger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChat && order?.id && <OrderChat orderId={order.id} onClose={() => setShowChat(false)} />}

    </div>
  );
}
