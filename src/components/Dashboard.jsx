import { useState, useEffect } from 'react';
import { Menu, Calendar, Bell, MapPin, Power, Navigation, CreditCard } from 'lucide-react';

export default function Dashboard({ onNavigate }) {
  const [isOnline, setIsOnline] = useState(false);
  const [findingOrder, setFindingOrder] = useState(false);

  const toggleStatus = () => {
    setIsOnline(!isOnline);
    if (!isOnline) {
      // Transitioning to online
      setFindingOrder(true);
    } else {
      setFindingOrder(false);
    }
  };

  // Simulate finding an order after 3 seconds of being online
  useEffect(() => {
    let timeout;
    if (isOnline && findingOrder) {
      timeout = setTimeout(() => {
        setFindingOrder(false);
        // Alert or direct navigation could happen here
        // For demonstration, we just show a "New Order" card
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isOnline, findingOrder]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Top Nav */}
      <div className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
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
          <button style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', position: 'relative' }}>
            <Bell size={24} />
            <span style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '50%' }}></span>
          </button>
        </div>
      </div>

      <div className="view-container">
        
        {/* Earnings Card */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Ganancias de Hoy</p>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>$45.50</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Viajes</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>8</h2>
          </div>
        </div>

        {/* Big Toggle Button */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '32px' }}>
            {/* Ripple effect when online */}
            {isOnline && (
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
                background: isOnline ? 'var(--primary)' : 'var(--bg-surface)',
                border: `4px solid ${isOnline ? 'var(--primary-hover)' : 'var(--border-color)'}`,
                color: isOnline ? 'white' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.4s ease',
                boxShadow: isOnline ? '0 0 40px rgba(16, 185, 129, 0.6)' : 'var(--shadow-glass)',
                zIndex: 10
              }}
            >
              <Power size={48} style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>

          <p style={{ fontSize: '1.1rem', color: isOnline ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '500', height: '24px' }}>
            {isOnline ? (findingOrder ? 'Buscando pedidos cercanos...' : 'Listo para recibir pedidos') : 'Desconectado'}
          </p>
        </div>

        {/* New Order Alert (Simulated) */}
        {isOnline && !findingOrder && (
          <div className="glass-panel animate-slide-up" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--primary)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '8px' }}>
                  NUEVO PEDIDO
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Hamburguesas El Corral</h3>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>$4.50</h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              <MapPin size={16} />
              <span>A 2.5 km (Aprox. 8 min)</span>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn-secondary" style={{ flex: 1 }}>Rechazar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => onNavigate('tracking')}>
                Aceptar Viaje
              </button>
            </div>
          </div>
        )}

      </div>
      
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
