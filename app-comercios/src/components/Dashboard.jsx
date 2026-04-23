import { useState, useEffect } from 'react';
import { LogOut, Package, Clock, CheckCircle, ShieldCheck, X } from 'lucide-react';
import { io } from 'socket.io-client';

export default function Dashboard({ onNavigate }) {
  const [validatingOrder, setValidatingOrder] = useState(null);
  const [pin, setPin] = useState('');
  
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);
    
    socket.on('order_accepted', ({ orderId, courierName }) => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: 'ready', driver: courierName };
        }
        return order;
      }));
    });

    return () => socket.disconnect();
  }, []);

  const handleCreateOrder = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: 'demo-business-id', price: 25000 })
      });
      const data = await res.json();
      if (res.ok) {
        setOrders([...orders, { ...data, customer: 'Cliente Final', status: 'preparing', driver: 'Buscando...' }]);
        alert('¡Pedido enviado a los domiciliarios! Esperando confirmación...');
      }
    } catch (err) {
      alert('Error de conexión. Asegúrate que el backend (puerto 3000) esté corriendo.');
    }
  };

  const handleValidate = (e) => {
    e.preventDefault();
    if (pin === '1234') { // Fake PIN validation
      setOrders(orders.filter(o => o.id !== validatingOrder.id));
      setValidatingOrder(null);
      setPin('');
      alert('¡Código validado! Pedido entregado al domiciliario con éxito.');
    } else {
      alert('Código incorrecto. Verifica con el domiciliario.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Top Nav */}
      <nav style={{ background: 'var(--bg-surface)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h2 style={{ color: 'var(--primary)', margin: 0 }}>Portal Comercio</h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button style={{ background: 'none', border: 'none', fontWeight: '600', color: 'var(--primary)', cursor: 'pointer' }}>Pedidos Activos</button>
            <button onClick={() => onNavigate('menu')} style={{ background: 'none', border: 'none', fontWeight: '500', color: 'var(--text-muted)', cursor: 'pointer' }}>Mi Menú / Catálogo</button>
          </div>
        </div>
        <button onClick={() => onNavigate('auth')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogOut size={20} /> Salir
        </button>
      </nav>

      <div style={{ padding: '32px 0', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1>Panel de Pedidos</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button onClick={handleCreateOrder} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} /> Crear Pedido Real
            </button>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }}></div>
              <span style={{ fontWeight: '600' }}>Restaurante Abierto</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          
          {orders.map((order) => (
            <div key={order.id} className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{order.id}</span>
                {order.status === 'ready' ? (
                  <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} /> Listo
                  </span>
                ) : (
                  <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} /> Preparando
                  </span>
                )}
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>Cliente</p>
                <p style={{ fontWeight: '500' }}>{order.customer}</p>
                
                {order.driver && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Domiciliario Asignado</p>
                    <p style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={16} /> {order.driver}
                    </p>
                  </div>
                )}
              </div>

              {order.status === 'ready' ? (
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', background: 'var(--text-main)' }}
                  onClick={() => setValidatingOrder(order)}
                >
                  <ShieldCheck size={18} /> Ver PIN de Entrega
                </button>
              ) : (
                <button className="btn-secondary" style={{ width: '100%' }}>
                  Marcar como Listo
                </button>
              )}
            </div>
          ))}

        </div>
      </div>

      {/* Validation Modal */}
      {validatingOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setValidatingOrder(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <ShieldCheck size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
              <h2>Código de Seguridad</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                Díctale el siguiente código al domiciliario ({validatingOrder.driver}) para que lo ingrese en su aplicación y confirme la recepción del pedido.
              </p>
            </div>

            <div style={{ 
              width: '100%', 
              textAlign: 'center', 
              fontSize: '3rem', 
              letterSpacing: '12px', 
              padding: '24px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--bg-surface-hover)',
              border: '2px dashed var(--primary)',
              marginBottom: '24px',
              fontWeight: '700',
              color: 'var(--primary)'
            }}>
              {validatingOrder.pickupPin || '1234'}
            </div>

            <button onClick={() => {
              setOrders(orders.filter(o => o.id !== validatingOrder.id));
              setValidatingOrder(null);
            }} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
              El domiciliario ya validó el código
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
