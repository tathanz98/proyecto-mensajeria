import { useState } from 'react';
import { ArrowLeft, CheckCircle, ShieldCheck, Phone } from 'lucide-react';
import { authenticatedFetch } from '../api';

export default function DeliveryProof({ onNavigate, order, onOrderCompleted }) {
  const [submitting, setSubmitting] = useState(false);
  const [customerPin, setCustomerPin] = useState('');
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (customerPin.length !== 4) {
      setError('Debes ingresar el código de 4 dígitos proporcionado por el cliente.');
      return;
    }
    if (!order?.id) {
      setError('No se encontró el pedido activo. Regresa al panel y vuelve a abrirlo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await authenticatedFetch(`/api/orders/${order.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: customerPin })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No fue posible finalizar el pedido.');
        return;
      }
      onOrderCompleted?.();
      alert('Entrega finalizada. Tus ganancias y viajes ya se actualizaron.');
      onNavigate('dashboard');
    } catch {
      setError('No fue posible conectar para finalizar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="view-container animate-fade-in" style={{ padding: 0 }}>

      <div className="top-nav">
        <button onClick={() => onNavigate('tracking')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1>Entrega al Cliente</h1>
        <div style={{ width: 24 }}></div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>
            Pedido #{order?.code || order?.id?.slice(0, 8) || '—'}
          </p>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{order?.customerName || 'Cliente'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{order?.dropoffAddress}</p>
          {order?.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '600', marginTop: '10px' }}
            >
              <Phone size={16} /> Llamar al cliente
            </a>
          )}
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.85rem', marginTop: '12px' }}>
            <ShieldCheck size={16} /> Pedido verificado con fotos del pedido, la factura y el QR.
          </p>
        </div>

        <div className="input-group" style={{ marginBottom: '24px' }}>
          <label style={{ color: 'var(--primary)', fontWeight: '600' }}>Código de Recepción del Cliente</label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Solicítale el PIN de 4 dígitos al cliente para confirmar la entrega.</p>
          <input
            type="text"
            className="input-field"
            placeholder="0000"
            inputMode="numeric"
            maxLength="4"
            value={customerPin}
            onChange={event => setCustomerPin(event.target.value.replace(/\D/g, ''))}
            style={{ fontSize: '1.5rem', letterSpacing: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}
          />
        </div>

        {error && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</p>}

        <button
          className="btn-primary"
          disabled={submitting || customerPin.length !== 4}
          onClick={handleComplete}
          style={{ marginTop: 'auto', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Enviando...' : <><CheckCircle size={20} /> Finalizar Entrega</>}
        </button>

      </div>
    </div>
  );
}
