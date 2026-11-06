import { useState, useEffect } from 'react';
import { Menu, Calendar, Bell, MapPin, Power, CreditCard, X, LogOut, BellRing, Loader } from 'lucide-react';
import { authenticatedFetch } from '../api';
import CourierZoneMap from './CourierZoneMap';

export default function Dashboard({
  onNavigate,
  isAvailable,
  availabilityStatus = 'offline',
  availabilityError = '',
  onToggleAvailability,
  courierLocation,
  serviceRadiusKm = 6,
  onChangeServiceRadius,
  activeOrder,
  onLogout,
  profile,
  onAcceptOrder
}) {
  const [stats, setStats] = useState({ earnings: 0, trips: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);
  const locating = availabilityStatus === 'locating';

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    authenticatedFetch(`/api/orders/courier/${userId}/stats`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setStats({ earnings: data.earnings || 0, trips: data.trips || 0 }))
      .catch(() => setStats({ earnings: 0, trips: 0 }));
  }, [isAvailable, activeOrder]);

  // Los pedidos pendientes se consultan por API para no depender solo del evento
  // en tiempo real: un domiciliario que se conecta tarde también debe verlos.
  useEffect(() => {
    if (!isAvailable) {
      setAvailableOrders([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await authenticatedFetch('/api/orders/available');
        if (!response.ok) return;
        const orders = await response.json();
        if (!cancelled) setAvailableOrders(orders);
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo.
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAvailable, serviceRadiusKm]);

  const firstName = (profile?.name || '').split(' ')[0] || 'domiciliario';

  const accept = async (order) => {
    setAcceptingId(order.id);
    const accepted = await onAcceptOrder(order);
    if (!accepted) {
      setAvailableOrders(current => current.filter(item => item.id !== order.id));
    }
    setAcceptingId(null);
  };

  const toggleStatus = () => {
    if (locating) return;
    onToggleAvailability();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Top Nav */}
      <div className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => { setShowMenu(value => !value); setShowNotifications(false); }} aria-label="Abrir menú" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
            <Menu size={24} />
          </button>
          <h1>Hola, {firstName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => onNavigate('wallet')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
            <CreditCard size={24} />
          </button>
          <button onClick={() => onNavigate('schedule')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
            <Calendar size={24} />
          </button>
          <button onClick={() => { setShowNotifications(value => !value); setShowMenu(false); }} aria-label="Ver notificaciones" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', position: 'relative' }}>
            <Bell size={24} />
            {(isAvailable || activeOrder) && <span style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '50%' }}></span>}
          </button>
        </div>
      </div>

      {showMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowMenu(false)}>
          <aside className="glass-panel animate-slide-up" onClick={event => event.stopPropagation()} style={{ width: 'min(320px, 85vw)', height: '100%', padding: '24px', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div><strong style={{ fontSize: '1.2rem' }}>Mi cuenta</strong><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Repartidor</p></div>
              <button onClick={() => setShowMenu(false)} aria-label="Cerrar menú" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <button className="btn-secondary" onClick={() => { setShowMenu(false); onNavigate('wallet'); }} style={{ justifyContent: 'flex-start', marginBottom: '12px' }}><CreditCard size={20} /> Mi billetera</button>
            <button className="btn-secondary" onClick={() => { setShowMenu(false); onNavigate('schedule'); }} style={{ justifyContent: 'flex-start' }}><Calendar size={20} /> Mi horario</button>
            <button onClick={onLogout} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '12px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: '600' }}><LogOut size={20} /> Cerrar sesión</button>
          </aside>
        </div>
      )}

      {showNotifications && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowNotifications(false)}>
          <section className="glass-panel animate-slide-up" onClick={event => event.stopPropagation()} style={{ position: 'absolute', top: '70px', right: '16px', width: 'min(360px, calc(100vw - 32px))', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}><strong>Notificaciones</strong><button onClick={() => setShowNotifications(false)} aria-label="Cerrar notificaciones" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><X size={20} /></button></div>
            {activeOrder ? (
              <button onClick={() => { setShowNotifications(false); onNavigate('tracking'); }} style={{ width: '100%', textAlign: 'left', padding: '12px', background: 'rgba(16,185,129,0.12)', color: 'var(--text-main)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', cursor: 'pointer' }}><strong>Pedido en curso</strong><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Toca para abrir el seguimiento y el chat.</span></button>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 4px' }}><BellRing size={28} style={{ marginBottom: '8px' }} /><p>{isAvailable ? 'Estás disponible. Te avisaremos al llegar una oferta.' : 'No tienes notificaciones. Activa ONLINE para recibir ofertas.'}</p></div>
            )}
          </section>
        </div>
      )}

      <div className="view-container">
        
        {/* Earnings Card */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Ganancia entregada hoy</p>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>${Number(stats.earnings).toLocaleString()} COP</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Viajes</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{stats.trips}</h2>
          </div>
        </div>

        {/* Big Toggle Button */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '32px' }}>
            {/* Ripple effect when online */}
            {isAvailable && (
              <>
                <div style={{ position: 'absolute', inset: '-20px', borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.5, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
                <div style={{ position: 'absolute', inset: '-40px', borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.2, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite', animationDelay: '0.5s' }}></div>
              </>
            )}
            
            <button 
              onClick={toggleStatus}
              disabled={locating}
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                background: isAvailable ? 'var(--primary)' : 'var(--bg-surface)',
                border: `4px solid ${locating ? 'var(--primary)' : isAvailable ? 'var(--primary-hover)' : 'var(--border-color)'}`,
                color: locating ? 'var(--primary)' : isAvailable ? 'white' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: locating ? 'wait' : 'pointer',
                transition: 'all 0.4s ease',
                boxShadow: isAvailable ? '0 0 40px rgba(16, 185, 129, 0.6)' : 'var(--shadow-glass)',
                zIndex: 10
              }}
            >
              {locating
                ? <Loader size={48} style={{ marginBottom: '8px', animation: 'spin 1s linear infinite' }} />
                : <Power size={48} style={{ marginBottom: '8px' }} />}
              <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                {locating ? 'UBICANDO' : isAvailable ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>

          <p style={{ fontSize: locating ? '0.95rem' : '1.1rem', color: isAvailable ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '500', height: '24px', textAlign: 'center' }}>
            {locating
              ? 'Obteniendo tu ubicación GPS...'
              : isAvailable
                ? `Recibiendo pedidos en ${serviceRadiusKm} km a la redonda`
                : 'Desconectado'}
          </p>
        </div>

        {availabilityError && !isAvailable && !locating && (
          <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '16px', borderLeft: '4px solid var(--danger)' }}>
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '10px' }}>{availabilityError}</p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={toggleStatus}>
              Permitir ubicación y conectarme
            </button>
          </div>
        )}

        {isAvailable && courierLocation && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Tu zona de trabajo</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Solo verás pedidos que se recogen dentro de este radio.
                </p>
              </div>
              <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '700' }}>
                {availableOrders.length} cerca
              </span>
            </div>

            <div style={{ height: '220px', marginBottom: '12px' }}>
              <CourierZoneMap location={courierLocation} radiusKm={serviceRadiusKm} orders={availableOrders} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Radio:</span>
              {[3, 6, 10, 15].map(radius => (
                <button
                  key={radius}
                  className={radius === serviceRadiusKm ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => onChangeServiceRadius(radius)}
                  disabled={radius === serviceRadiusKm}
                  style={{ padding: '6px 12px', minHeight: 'auto', width: 'auto', fontSize: '0.85rem', opacity: radius === serviceRadiusKm ? 1 : 0.8 }}
                >
                  {radius} km
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--primary)' }} /> Tu ubicación
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b' }} /> Recogidas disponibles
              </span>
            </div>
          </div>
        )}

        {activeOrder && (
          <div className="glass-panel animate-slide-up" style={{ padding: '20px', borderLeft: '4px solid var(--primary)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px' }}>
                  {activeOrder.status === 'PICKED_UP' ? 'EN CAMINO' : 'PEDIDO ASIGNADO'}
                </span>
                {activeOrder.verificationStatus === 'VERIFIED' && (
                  <span style={{ display: 'inline-block', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', marginLeft: '6px', marginBottom: '8px' }}>
                    VERIFICADO
                  </span>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>
                  Pedido #{activeOrder.code || activeOrder.id.slice(0, 8)}
                </p>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{activeOrder.businessName || 'Pedido en curso'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cliente: {activeOrder.customerName || 'Cliente'}</p>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>${(activeOrder.price - 5000).toLocaleString()} COP</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              <MapPin size={16} />
              <span>{activeOrder.pickupAddress} → {activeOrder.dropoffAddress}</span>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => onNavigate('tracking')}>
                Ver pedido y chat
              </button>
            </div>
          </div>
        )}

        {isAvailable && !activeOrder && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-muted)' }}>
              Pedidos disponibles ({availableOrders.length})
            </h3>
            {!availableOrders.length && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay pedidos pendientes ahora mismo.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availableOrders.map(order => (
                <div key={order.id} className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{order.businessName || 'Comercio'}</strong>
                    <strong style={{ color: 'var(--primary)' }}>${(order.price - 5000).toLocaleString()}</strong>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
                    Pedido #{order.code || order.id.slice(0, 8)} · Cliente: {order.customerName || 'Cliente'}
                    {order.distanceKm != null && ` · a ${order.distanceKm} km`}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
                    Recoger: {order.pickupAddress}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    Entregar: {order.dropoffAddress}
                  </p>
                  <button className="btn-primary" disabled={acceptingId === order.id} style={{ width: '100%' }} onClick={() => accept(order)}>
                    {acceptingId === order.id ? 'Aceptando...' : 'Aceptar pedido'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      
    </div>
  );
}
