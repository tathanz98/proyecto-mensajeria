import { useState, useEffect } from 'react';
import { Menu, Calendar, Bell, MapPin, Power, CreditCard, X, LogOut, BellRing } from 'lucide-react';
import { apiUrl } from '../api';

export default function Dashboard({ onNavigate, isAvailable, onToggleAvailability, activeOrder, onLogout }) {
  const [findingOrder, setFindingOrder] = useState(false);
  const [stats, setStats] = useState({ earnings: 0, trips: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!isAvailable || !userId) return;

    fetch(apiUrl(`/api/orders/courier/${userId}/stats`))
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setStats({ earnings: data.earnings || 0, trips: data.trips || 0 }))
      .catch(() => setStats({ earnings: 0, trips: 0 }));
  }, [isAvailable]);

  const displayedStats = isAvailable ? stats : { earnings: 0, trips: 0 };

  const toggleStatus = () => {
    onToggleAvailability();
    if (!isAvailable) {
      setFindingOrder(true);
    } else {
      setFindingOrder(false);
    }
  };

  // Simulate finding an order after 3 seconds of being online
  useEffect(() => {
    let timeout;
    if (isAvailable && findingOrder) {
      timeout = setTimeout(() => {
        setFindingOrder(false);
        // Alert or direct navigation could happen here
        // For demonstration, we just show a "New Order" card
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isAvailable, findingOrder]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Top Nav */}
      <div className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => { setShowMenu(value => !value); setShowNotifications(false); }} aria-label="Abrir menú" style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
            <Menu size={24} />
          </button>
          <h1>Hola, Juan</h1>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Ganancias de Hoy</p>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>${Number(displayedStats.earnings).toLocaleString()} COP</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Viajes</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{displayedStats.trips}</h2>
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
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                background: isAvailable ? 'var(--primary)' : 'var(--bg-surface)',
                border: `4px solid ${isAvailable ? 'var(--primary-hover)' : 'var(--border-color)'}`,
                color: isAvailable ? 'white' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.4s ease',
                boxShadow: isAvailable ? '0 0 40px rgba(16, 185, 129, 0.6)' : 'var(--shadow-glass)',
                zIndex: 10
              }}
            >
              <Power size={48} style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                {isAvailable ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>

          <p style={{ fontSize: '1.1rem', color: isAvailable ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '500', height: '24px' }}>
            {isAvailable ? (findingOrder ? 'Buscando pedidos cercanos...' : 'Listo para recibir pedidos') : 'Desconectado'}
          </p>
        </div>

        {activeOrder && (
          <div className="glass-panel animate-slide-up" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px' }}>
                  NUEVO PEDIDO
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Pedido en curso</h3>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>${(activeOrder.price - 5000).toLocaleString()} COP</h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              <MapPin size={16} />
              <span>A 2.5 km (Aprox. 8 min)</span>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => onNavigate('tracking')}>
                Ver pedido y chat
              </button>
            </div>
          </div>
        )}

      </div>
      
    </div>
  );
}
