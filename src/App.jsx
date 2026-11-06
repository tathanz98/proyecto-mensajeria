import { Component, useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { BellRing, X, Check } from 'lucide-react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import OrderTracking from './components/OrderTracking'
import DeliveryProof from './components/DeliveryProof'
import Schedule from './components/Schedule'
import Wallet from './components/Wallet'
import { authenticatedFetch, realtimeApiUrl } from './api'
import { distanceKm } from './geo'

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error al cargar la aplicación:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="view-container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <section className="glass-panel" style={{ width: '100%', padding: '28px 24px' }}>
            <h1 style={{ marginBottom: '12px' }}>No pudimos abrir el panel</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Ocurrió un problema al cargar la aplicación. Intenta abrirla nuevamente.
            </p>
            {this.state.error?.message && (
              <p style={{ color: 'var(--danger)', marginBottom: '24px', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                Detalle: {this.state.error.message}
              </p>
            )}
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo no permite obtener tu ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve([position.coords.latitude, position.coords.longitude]),
      error => reject(new Error(error.code === 1
        ? 'Permite la ubicación del teléfono para conectarte y recibir pedidos.'
        : 'No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function AppContent() {
  const [currentView, setCurrentView] = useState('auth')
  const [profile, setProfile] = useState(null)
  const [restoringSession, setRestoringSession] = useState(true)
  const [incomingOrder, setIncomingOrder] = useState(null)
  const [activeOrder, setActiveOrder] = useState(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState('offline')
  const [availabilityError, setAvailabilityError] = useState('')
  const [courierLocation, setCourierLocation] = useState(null)
  const [serviceRadiusKm, setServiceRadiusKm] = useState(6)

  // El socket se conecta una sola vez, así que lee la zona actual desde refs.
  const courierLocationRef = useRef(null)
  const serviceRadiusRef = useRef(serviceRadiusKm)

  useEffect(() => {
    courierLocationRef.current = courierLocation
  }, [courierLocation])

  useEffect(() => {
    serviceRadiusRef.current = serviceRadiusKm
  }, [serviceRadiusKm])

  const applyProfile = me => {
    setProfile(me)
    const online = Boolean(me.isOnline)
    setIsAvailable(online)
    setAvailabilityStatus(online ? 'online' : 'offline')
    if (Number.isFinite(me.lastLat) && Number.isFinite(me.lastLng)) {
      setCourierLocation([me.lastLat, me.lastLng])
    }
    if (Number.isFinite(me.serviceRadiusKm)) setServiceRadiusKm(me.serviceRadiusKm)
  }

  const saveAvailability = async ({ isOnline, location, radius }) => {
    const body = { isOnline }
    if (location) {
      body.lat = location[0]
      body.lng = location[1]
    }
    if (radius !== undefined) body.serviceRadiusKm = radius

    const res = await authenticatedFetch('/api/auth/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No pudimos guardar tu disponibilidad.')
    return data
  }

  // Pasar a ONLINE pide el GPS automáticamente: sin ubicación no hay zona de despacho.
  const toggleAvailability = async () => {
    if (availabilityStatus === 'locating') return

    if (isAvailable) {
      setIsAvailable(false)
      setAvailabilityStatus('offline')
      setAvailabilityError('')
      setIncomingOrder(null)
      try {
        await saveAvailability({ isOnline: false })
      } catch {
        // Se reintenta cuando vuelva la conexión.
      }
      return
    }

    setAvailabilityStatus('locating')
    setAvailabilityError('')
    try {
      const location = await currentPosition()
      const saved = await saveAvailability({ isOnline: true, location })
      setCourierLocation([saved.lastLat, saved.lastLng])
      setIsAvailable(true)
      setAvailabilityStatus('online')
    } catch (error) {
      setAvailabilityStatus('offline')
      setAvailabilityError(error.message)
    }
  }

  const changeServiceRadius = async radius => {
    const previous = serviceRadiusKm
    setServiceRadiusKm(radius)
    try {
      await saveAvailability({
        isOnline: isAvailable,
        location: isAvailable ? courierLocation : undefined,
        radius
      })
    } catch {
      setServiceRadiusKm(previous)
      setAvailabilityError('No pudimos actualizar tu zona de trabajo.')
    }
  }

  // Recupera la sesión y el pedido en curso al recargar la app.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRestoringSession(false);
      return;
    }

    (async () => {
      try {
        const meRes = await authenticatedFetch('/api/auth/me');
        if (!meRes.ok) throw new Error('Sesión no válida');
        const me = await meRes.json();
        if (me.role !== 'COURIER') throw new Error('Esta aplicación es para domiciliarios');

        const activeRes = await authenticatedFetch('/api/orders/mine?status=ACTIVE');
        const active = activeRes.ok
          ? (await activeRes.json()).find(order => order.status === 'ACCEPTED' || order.status === 'PICKED_UP')
          : null;

        setActiveOrder(active || null);
        setCurrentView('dashboard');
        applyProfile(me);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
      } finally {
        setRestoringSession(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await authenticatedFetch('/api/auth/me');
      if (!res.ok) return;
      applyProfile(await res.json());

      const activeRes = await authenticatedFetch('/api/orders/mine?status=ACTIVE');
      if (activeRes.ok) {
        const orders = await activeRes.json();
        setActiveOrder(orders.find(order => order.status === 'ACCEPTED' || order.status === 'PICKED_UP') || null);
      }
    } catch {
      // El panel sigue usable aunque el perfil tarde en cargar.
    }
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    if (isAvailable) {
      authenticatedFetch('/api/auth/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: false })
      }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setProfile(null);
    setIncomingOrder(null);
    setActiveOrder(null);
    setIsAvailable(false);
    setAvailabilityStatus('offline');
    setAvailabilityError('');
    setCurrentView('auth');
  };

  // Mientras está ONLINE se guarda la ubicación real cada 30 s o al moverse 300 m.
  useEffect(() => {
    if (!isAvailable || !navigator.geolocation) return;
    let lastSentAt = 0;
    let lastSent = null;

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const location = [position.coords.latitude, position.coords.longitude];
        setCourierLocation(location);

        const now = Date.now();
        const moved = !lastSent || (distanceKm(lastSent, location) ?? 0) >= 0.3;
        if (now - lastSentAt < 30000 && !moved) return;

        lastSentAt = now;
        lastSent = location;
        saveAvailability({ isOnline: true, location }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isAvailable]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || currentView === 'auth') return;

    // Sin una URL configurada no iniciamos Socket.IO: hacerlo con un valor
    // indefinido puede provocar un fallo al entrar al panel, especialmente en Capacitor.
    if (!realtimeApiUrl) {
      console.warn('VITE_API_URL no está configurada; las notificaciones en tiempo real están desactivadas.');
      return;
    }

    const socket = io(realtimeApiUrl, { auth: { token } });
    if (activeOrder?.id) socket.emit('join_order', activeOrder.id);
    
    socket.on('new_order', (order) => {
      if (!isAvailable) return;

      // Solo se avisa de pedidos que salen dentro de la zona de trabajo elegida.
      const location = courierLocationRef.current;
      const distance = location
        && Number.isFinite(order.pickupLat) && Number.isFinite(order.pickupLng)
        ? distanceKm(location, [order.pickupLat, order.pickupLng])
        : null;
      if (distance !== null && distance > serviceRadiusRef.current) return;

      const payload = distance === null ? order : { ...order, distanceKm: Number(distance.toFixed(1)) };

      // Play a quick alert sound natively (if browser allows)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200]);
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo pedido disponible', { body: `Ganancia estimada: $${(payload.price - 5000).toLocaleString()} COP` });
      }
      setIncomingOrder(payload);
    });

    socket.on('order_updated', (order) => {
      setActiveOrder(current => {
        if (current?.id !== order.id) return current;
        return order.status === 'DELIVERED' ? null : { ...current, ...order };
      });
    });

    socket.on('order_message', (message) => {
      if (message.orderId !== activeOrder?.id || message.senderRole === 'COURIER') return;
      if (window.navigator?.vibrate) window.navigator.vibrate([120, 80, 120]);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo mensaje del cliente', { body: message.content });
      }
    });

    return () => socket.disconnect();
  }, [currentView, isAvailable, activeOrder]);

  const acceptOrder = async (order) => {
    if (!order?.id) return false;
    try {
      const res = await authenticatedFetch(`/api/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo aceptar el pedido');
        setIncomingOrder(null);
        return false;
      }
      setIncomingOrder(null);
      setActiveOrder(data.order);
      setCurrentView('tracking');
      return true;
    } catch {
      alert('Error de red');
      return false;
    }
  };

  const handleAcceptOrder = () => acceptOrder(incomingOrder);

  const handleRejectOrder = async () => {
    if (!incomingOrder) return;
    try {
      const res = await authenticatedFetch(`/api/orders/${incomingOrder.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'No fue posible rechazar el pedido.');
    } catch {
      alert('No fue posible conectar para rechazar el pedido.');
    } finally {
      setIncomingOrder(null);
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view)
  }

  if (restoringSession) {
    return (
      <div className="view-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando tu sesión...</p>
      </div>
    )
  }

  return (
    <>
      {currentView === 'auth' && <Auth onLogin={handleLogin} />}
      {currentView === 'dashboard' && (
        <Dashboard
          profile={profile}
          onNavigate={navigateTo}
          isAvailable={isAvailable}
          availabilityStatus={availabilityStatus}
          availabilityError={availabilityError}
          onToggleAvailability={toggleAvailability}
          courierLocation={courierLocation}
          serviceRadiusKm={serviceRadiusKm}
          onChangeServiceRadius={changeServiceRadius}
          activeOrder={activeOrder}
          onAcceptOrder={acceptOrder}
          onLogout={handleLogout}
        />
      )}
      {currentView === 'tracking' && <OrderTracking onNavigate={navigateTo} order={activeOrder} />}
      {currentView === 'proof' && <DeliveryProof onNavigate={navigateTo} order={activeOrder} onOrderCompleted={() => setActiveOrder(null)} />}
      {currentView === 'schedule' && <Schedule onNavigate={navigateTo} />}
      {currentView === 'wallet' && <Wallet onNavigate={navigateTo} />}

      {/* Global Incoming Order Modal */}
      {incomingOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', textAlign: 'center', border: '2px solid var(--primary)', boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)' }}>
            
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', marginBottom: '24px', animation: 'pulse 2s infinite' }}>
              <BellRing size={48} color="var(--primary)" />
            </div>
            
            <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '8px' }}>¡NUEVO PEDIDO!</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>
              Pedido #{incomingOrder.code || incomingOrder.id.slice(0, 8)}
              {incomingOrder.distanceKm != null && ` · a ${incomingOrder.distanceKm} km de ti`}
            </p>
            <p style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '700', marginBottom: '24px' }}>Ganancia: ${(incomingOrder.price - 5000).toLocaleString()} COP</p>
            
            <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', marginBottom: '32px', textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Cliente que lo pidió</p>
              <p style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '12px' }}>{incomingOrder.customerName || 'Cliente'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Recoger en</p>
              <p style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '12px' }}>{incomingOrder.businessName || 'Comercio'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Dirección de recogida</p>
              <p style={{ fontWeight: '600', fontSize: '1rem' }}>{incomingOrder.pickupAddress || 'Sin dirección registrada'}</p>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={handleRejectOrder} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <X size={20} /> Rechazar
              </button>
              <button onClick={handleAcceptOrder} style={{ flex: 2, padding: '16px', borderRadius: '16px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '700', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' }}>
                <Check size={20} /> ¡Aceptar!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  )
}
