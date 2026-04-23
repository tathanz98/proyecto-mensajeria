import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { BellRing, X, Check } from 'lucide-react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import OrderTracking from './components/OrderTracking'
import DeliveryProof from './components/DeliveryProof'
import Schedule from './components/Schedule'
import Wallet from './components/Wallet'

function App() {
  const [currentView, setCurrentView] = useState('auth')
  const [incomingOrder, setIncomingOrder] = useState(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId || currentView === 'auth') return;

    const socket = io(import.meta.env.VITE_API_URL);
    
    socket.on('new_order', (order) => {
      // Play a quick alert sound natively (if browser allows)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200]);
      }
      setIncomingOrder(order);
    });

    return () => socket.disconnect();
  }, [currentView]);

  const handleAcceptOrder = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${incomingOrder.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: userId })
      });
      const data = await res.json();
      if (res.ok) {
        setIncomingOrder(null);
        alert('¡Pedido aceptado exitosamente!');
        setCurrentView('dashboard'); // Force refresh to dashboard
      } else {
        alert(data.error || 'No se pudo aceptar el pedido');
        setIncomingOrder(null);
      }
    } catch (err) {
      alert('Error de red');
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view)
  }

  return (
    <>
      {currentView === 'auth' && <Auth onLogin={() => navigateTo('dashboard')} />}
      {currentView === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
      {currentView === 'tracking' && <OrderTracking onNavigate={navigateTo} />}
      {currentView === 'proof' && <DeliveryProof onNavigate={navigateTo} />}
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
            <p style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '700', marginBottom: '24px' }}>Ganancia: ${(incomingOrder.price - 5000).toLocaleString()} COP</p>
            
            <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', marginBottom: '32px', textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Restaurante</p>
              <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>Restaurante ID: {incomingOrder.businessId.slice(0,8)}</p>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => setIncomingOrder(null)} style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <X size={20} /> Ignorar
              </button>
              <button onClick={handleAcceptOrder} style={{ flex: 2, padding: '16px', borderRadius: '16px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '700', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' }}>
                <Check size={20} /> ¡Aceptar!
              </button>
            </div>
          </div>
          <style>{`
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
              70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

export default App
