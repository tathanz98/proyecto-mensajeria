import { useCallback, useEffect, useState } from 'react';
import { LogOut, Package, Clock, CheckCircle, ShieldCheck, X, Plus, RefreshCw, Settings, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';

const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:3000' : '');

const statusMeta = {
  PENDING: { label: 'Buscando domiciliario', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' },
  ACCEPTED: { label: 'Domiciliario asignado', color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' },
  PICKED_UP: { label: 'En camino al cliente', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' },
  DELIVERED: { label: 'Entregado', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }
};

const emptyForm = {
  customerName: '',
  customerPhone: '',
  pickupAddress: '',
  dropoffAddress: '',
  price: '25000',
  notes: ''
};

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No fue posible completar la solicitud.');
  return data;
}

function mapsUrl(lat, lng, address) {
  const query = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : `${address}, Colombia`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function Dashboard({ onNavigate, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [validatingOrder, setValidatingOrder] = useState(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [socket, setSocket] = useState(null);
  const [summary, setSummary] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const businessName = localStorage.getItem('businessName') || 'Mi comercio';
  const limitReached = summary?.canCreate === false;

  const loadOrders = useCallback(async () => {
    setError('');
    try {
      const [data, summaryData] = await Promise.all([
        apiFetch('/api/orders/mine?status=ACTIVE'),
        apiFetch('/api/orders/business/summary')
      ]);
      setOrders(data);
      setSummary(summaryData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openSettings = () => {
    setError('');
    setLimitInput(summary?.dailyOrderLimit ?? '');
    setSettingsOpen(true);
  };

  const saveLimit = async (value) => {
    setSavingLimit(true);
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ dailyOrderLimit: value === '' || value === null ? null : Number(value) })
      });
      const refreshed = await apiFetch('/api/orders/business/summary');
      setSummary(refreshed);
      setSettingsOpen(false);
      setNotice(value === '' || value === null
        ? 'Límite diario eliminado: podrás crear pedidos sin tope.'
        : `Límite diario guardado: ${refreshed.dailyOrderLimit} ${refreshed.dailyOrderLimit === 1 ? 'pedido' : 'pedidos'} por día.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingLimit(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const connection = io(apiBase, { auth: { token } });

    connection.on('order_accepted', ({ orderId, courierName }) => {
      setOrders(previous => previous.map(order => (
        order.id === orderId ? { ...order, status: 'ACCEPTED', courierName } : order
      )));
    });

    connection.on('order_updated', updated => {
      setOrders(previous => {
        if (!previous.some(order => order.id === updated.id)) return previous;
        if (updated.status === 'DELIVERED') return previous.filter(order => order.id !== updated.id);
        return previous.map(order => (order.id === updated.id ? { ...order, ...updated } : order));
      });
    });

    setSocket(connection);
    return () => connection.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;
    orders.forEach(order => socket.emit('join_order', order.id));
  }, [socket, orders]);

  const updateForm = field => event => setForm(current => ({ ...current, [field]: event.target.value }));

  const handleCreateOrder = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const order = await apiFetch('/api/orders/create', {
        method: 'POST',
        body: JSON.stringify({ ...form, price: Number(form.price) })
      });
      setOrders(current => [order, ...current]);
      setForm(emptyForm);
      setCreating(false);
      apiFetch('/api/orders/business/summary').then(setSummary).catch(() => {});
      if (order.geocoded && (!order.geocoded.pickup || !order.geocoded.dropoff)) {
        setNotice('El pedido fue creado, pero no pudimos ubicar una de las direcciones en el mapa. El domiciliario podrá navegar con la dirección escrita.');
      }
    } catch (createError) {
      setError(createError.message);
      apiFetch('/api/orders/business/summary').then(setSummary).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      <nav style={{ background: 'var(--bg-surface)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h2 style={{ color: 'var(--primary)', margin: 0 }}>Portal Comercio</h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button style={{ background: 'none', border: 'none', fontWeight: '600', color: 'var(--primary)', cursor: 'pointer' }}>Pedidos Activos</button>
            <button onClick={() => onNavigate('menu')} style={{ background: 'none', border: 'none', fontWeight: '500', color: 'var(--text-muted)', cursor: 'pointer' }}>Mi Menú / Catálogo</button>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogOut size={20} /> Salir
        </button>
      </nav>

      <div style={{ padding: '32px 0', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Panel de Pedidos</h1>
            <p style={{ color: 'var(--text-muted)' }}>{businessName}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={loadOrders} title="Actualizar pedidos" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex' }}>
              <RefreshCw size={18} />
            </button>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>Pedidos de hoy</p>
              <strong style={{ fontSize: '0.95rem' }}>
                {summary ? `${summary.ordersToday}${summary.dailyOrderLimit ? ` / ${summary.dailyOrderLimit}` : ' · sin límite'}` : '—'}
              </strong>
            </div>
            <button onClick={openSettings} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
              <Settings size={18} /> Límite diario
            </button>
            <button
              onClick={() => setCreating(true)}
              disabled={limitReached}
              title={limitReached ? 'Alcanzaste el límite diario configurado' : undefined}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: '600', cursor: limitReached ? 'not-allowed' : 'pointer', opacity: limitReached ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> Nuevo Pedido
            </button>
            <div style={{ background: 'var(--bg-surface)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }}></div>
              <span style={{ fontWeight: '600' }}>Restaurante Abierto</span>
            </div>
          </div>
        </div>

        {limitReached && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            Alcanzaste tu límite de {summary.dailyOrderLimit} {summary.dailyOrderLimit === 1 ? 'pedido' : 'pedidos'} por día. Ajusta el límite para seguir despachando hoy.
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            {notice}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando pedidos...</p>
        ) : !orders.length ? (
          <div className="panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ marginBottom: '12px' }} />
            <p>No tienes pedidos activos. Crea uno para que los domiciliarios lo reciban.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {orders.map(order => {
              const meta = statusMeta[order.status] || statusMeta.PENDING;
              return (
                <div key={order.id} className="panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      #{order.code || order.id.slice(0, 8)}
                      {order.verificationStatus === 'VERIFIED' && (
                        <ShieldCheck size={16} color="var(--success)" title="Pedido verificado por el domiciliario" />
                      )}
                    </span>
                    <span style={{ background: meta.background, color: meta.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>Cliente</p>
                      <p style={{ fontWeight: '500' }}>{order.customerName}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{order.customerPhone}</p>
                    </div>

                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>Entregar en</p>
                      <p style={{ fontWeight: '500' }}>{order.dropoffAddress}</p>
                      <a
                        href={mapsUrl(order.dropoffLat, order.dropoffLng, order.dropoffAddress)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '600' }}
                      >
                        Ver en el mapa
                      </a>
                    </div>

                    {order.notes && (
                      <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>Notas</p>
                        <p style={{ fontSize: '0.9rem' }}>{order.notes}</p>
                      </div>
                    )}

                    <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Domiciliario</p>
                      <p style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Package size={16} /> {order.courierName || 'Aún sin asignar'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Valor del domicilio</span>
                    <strong>${Number(order.price).toLocaleString('es-CO')} COP</strong>
                  </div>

                  {order.status === 'ACCEPTED' ? (
                    <button
                      className="btn-primary"
                      style={{ width: '100%', background: 'var(--text-main)' }}
                      onClick={() => setValidatingOrder(order)}
                    >
                      <ShieldCheck size={18} /> Ver PIN de recogida
                    </button>
                  ) : order.status === 'PENDING' ? (
                    <button className="btn-secondary" style={{ width: '100%' }} disabled>
                      <Clock size={18} /> Esperando domiciliario
                    </button>
                  ) : (
                    <button className="btn-secondary" style={{ width: '100%' }} disabled>
                      <CheckCircle size={18} /> En camino al cliente
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px' }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setCreating(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>

            <h2 style={{ marginBottom: '8px' }}>Nuevo Pedido</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Los domiciliarios conectados recibirán la solicitud en tiempo real.
            </p>

            <form onSubmit={handleCreateOrder}>
              <div className="input-group">
                <label>Nombre del cliente</label>
                <input className="input-field" value={form.customerName} onChange={updateForm('customerName')} placeholder="Ej: Laura Gómez" required />
              </div>

              <div className="input-group">
                <label>Teléfono del cliente</label>
                <input className="input-field" value={form.customerPhone} onChange={updateForm('customerPhone')} placeholder="Ej: 300 123 4567" required />
              </div>

              <div className="input-group">
                <label>Dirección de recogida</label>
                <input className="input-field" value={form.pickupAddress} onChange={updateForm('pickupAddress')} placeholder="Dónde recoge el domiciliario" required />
              </div>

              <div className="input-group">
                <label>Dirección de entrega</label>
                <input className="input-field" value={form.dropoffAddress} onChange={updateForm('dropoffAddress')} placeholder="Dónde se entrega al cliente" required />
              </div>

              <div className="input-group">
                <label>Valor del domicilio (COP)</label>
                <input className="input-field" type="number" min="5001" step="1" value={form.price} onChange={updateForm('price')} required />
              </div>

              <div className="input-group" style={{ marginBottom: '24px' }}>
                <label>Notas para el domiciliario (opcional)</label>
                <textarea className="input-field" rows="3" maxLength={400} value={form.notes} onChange={updateForm('notes')} placeholder="Ej: entregar en portería, llamar al llegar" />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={submitting}>
                {submitting ? 'Enviando pedido...' : 'Enviar pedido a domiciliarios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {validatingOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px' }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setValidatingOrder(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <ShieldCheck size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
              <h2>Código de Seguridad</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                Pedido <strong style={{ color: 'var(--text-main)' }}>#{validatingOrder.code || validatingOrder.id.slice(0, 8)}</strong> · Cliente: <strong style={{ color: 'var(--text-main)' }}>{validatingOrder.customerName}</strong>
              </p>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                Díctale este código al domiciliario ({validatingOrder.courierName}) para que confirme la recogida del pedido.
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
              {validatingOrder.pickupPin}
            </div>

            {validatingOrder.qrToken ? (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <p style={{ fontWeight: '600', marginBottom: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={18} /> QR del pedido
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', background: 'white', padding: '12px', borderRadius: '12px', width: 'fit-content', margin: '0 auto 10px' }}>
                  <QRCodeSVG
                    value={JSON.stringify({ pedido: validatingOrder.code, token: validatingOrder.qrToken })}
                    size={160}
                  />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  El domiciliario debe fotografiar este QR, la factura y el pedido antes de verificar la recogida.
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '24px' }}>
                Este pedido no tiene un QR generado. Crea el pedido de nuevo para obtenerlo.
              </p>
            )}

            <button onClick={() => setValidatingOrder(null)} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
              Listo
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px' }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setSettingsOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>

            <h2 style={{ marginBottom: '8px' }}>Pedidos por día</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Define cuántos pedidos puede despachar tu comercio cada día. Al llegar al límite no se podrán crear más hasta el día siguiente o hasta que amplíes el cupo.
            </p>

            <div style={{ padding: '12px 16px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Pedidos creados hoy</span>
              <strong>
                {summary?.ordersToday ?? 0}{summary?.dailyOrderLimit ? ` / ${summary.dailyOrderLimit}` : ''}
              </strong>
            </div>

            <div className="input-group">
              <label>Límite diario</label>
              <input
                className="input-field"
                type="number"
                min="1"
                max="500"
                step="1"
                value={limitInput}
                onChange={event => setLimitInput(event.target.value)}
                placeholder="Sin límite"
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                Déjalo vacío para no limitar los pedidos.
              </p>
            </div>

            {error && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => saveLimit(null)} disabled={savingLimit}>
                Quitar límite
              </button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => saveLimit(limitInput)} disabled={savingLimit}>
                {savingLimit ? 'Guardando...' : 'Guardar límite'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
