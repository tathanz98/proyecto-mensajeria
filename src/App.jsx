import { Component, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { BellRing, X, Check } from 'lucide-react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import OrderTracking from './components/OrderTracking'
import DeliveryProof from './components/DeliveryProof'
import Schedule from './components/Schedule'
import Wallet from './components/Wallet'
import { apiUrl, realtimeApiUrl } from './api'

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

function AppContent() {
  const [currentView, setCurrentView] = useState('auth')
  const [incomingOrder, setIncomingOrder] = useState(null)
  const [activeOrder, setActiveOrder] = useState(null)
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId || currentView === 'auth') return;

    // Sin una URL configurada no iniciamos Socket.IO: hacerlo con un valor
    // indefinido puede provocar un fallo al entrar al panel, especialmente en Capacitor.
    if (!realtimeApiUrl) {
      console.warn('VITE_API_URL no está configurada; las notificaciones en tiempo real están desactivadas.');
      return;
    }

    const socket = io(realtimeApiUrl);
    
    socket.on('new_order', (order) => {
      if (!isAvailable) return;
      // Play a quick alert sound natively (if browser allows)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200]);
      }
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo pedido disponible', { body: `Ganancia estimada: $${(order.price - 5000).toLocaleString()} COP` });
      }
      setIncomingOrder(order);
    });

    socket.on('order_message', (message) => {
      if (message.orderId !== activeOrder?.id || message.senderRole !== 'CUSTOMER') return;
      if (window.navigator?.vibrate) window.navigator.vibrate([120, 80, 120]);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Mensaje del cliente', { body: message.content });
      }
    });

    return () => socket.disconnect();
  }, [currentView, isAvailable, activeOrder]);

  const handleAcceptOrder = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const res = await fetch(apiUrl(`/api/orders/${incomingOrder.id}/accept`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: userId })
      });
      const data = await res.json();
      if (res.ok) {
        setIncomingOrder(null);
        setActiveOrder(data.order);
        setCurrentView('tracking');
      } else {
        alert(data.error || 'No se pudo aceptar el pedido');
        setIncomingOrder(null);
      }
    } catch {
      alert('Error de red');
    }
  };

  const handleRejectOrder = async () => {
    if (!incomingOrder) return;
    try {
      const res = await fetch(apiUrl(`/api/orders/${incomingOrder.id}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: localStorage.getItem('userId') })
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

  return (
    <>
      {currentView === 'auth' && <Auth onLogin={() => navigateTo('dashboard')} />}
      {currentView === 'dashboard' && <Dashboard onNavigate={navigateTo} isAvailable={isAvailable} onToggleAvailability={() => setIsAvailable(value => !value)} activeOrder={activeOrder} onLogout={() => { localStorage.removeItem('token'); localStorage.removeItem('userId'); setIncomingOrder(null); setActiveOrder(null); setIsAvailable(false); navigateTo('auth'); }} />}
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
            <p style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '700', marginBottom: '24px' }}>Ganancia: ${(incomingOrder.price - 5000).toLocaleString()} COP</p>
            
            <div style={{ background: 'var(--bg-dark)', padding: '16px', borderRadius: '12px', marginBottom: '32px', textAlign: 'left' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Restaurante</p>
              <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>Restaurante ID: {incomingOrder.businessId.slice(0,8)}</p>
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
