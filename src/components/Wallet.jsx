import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../api';
import { ArrowLeft, CreditCard, Building2, Plus, ArrowUpRight, Copy, ScanLine, X, Lock, Unlock, Eye, EyeOff, RefreshCw, AlertTriangle, Send } from 'lucide-react';

export default function Wallet({ onNavigate }) {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('Nequi');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [isCardLocked, setIsCardLocked] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [cvv, setCvv] = useState('843');
  const [copyMsg, setCopyMsg] = useState('');
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  
  const [financials, setFinancials] = useState({ cardBalance: 0, debt: 0, isBlocked: false });
  const [bankAccount, setBankAccount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [bankError, setBankError] = useState('');
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (userId) {
      authenticatedFetch(`/api/wallet/balance/${userId}`)
        .then(res => res.json())
        .then(data => setFinancials(data))
        .catch(err => console.error(err));
    }
    authenticatedFetch('/api/wallet/transactions')
      .then(res => res.ok ? res.json() : [])
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]));
    authenticatedFetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(user => { if (user) setBankAccount(user.bankAccount || ''); })
      .catch(() => {});
  }, [userId]);

  const handleAddBank = async (e) => {
    e.preventDefault();
    if (newBankAccount.trim() === '') return;
    setBankError('');
    try {
      const res = await authenticatedFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccount: `${newBankName} ${newBankAccount.trim()}` })
      });
      const data = await res.json();
      if (!res.ok) {
        setBankError(data.error || 'No fue posible guardar la cuenta.');
        return;
      }
      setBankAccount(data.bankAccount || '');
      setShowAddBank(false);
      setNewBankAccount('');
    } catch {
      setBankError('No fue posible conectar con el servidor.');
    }
  };

  const handleCopyCard = () => {
    navigator.clipboard.writeText('4532123456789012');
    setCopyMsg('¡Copiado!');
    setCvv(Math.floor(100 + Math.random() * 900).toString());
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const handlePayDebt = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await authenticatedFetch('/api/wallet/pay-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`¡Pago por ${paymentMethod} exitoso! Cuenta desbloqueada.`);
        setFinancials(data.user);
        setShowPaymentModal(false);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Error al procesar pago');
    }
  };

  if (financials.isBlocked) {
    return (
      <div className="view-container animate-fade-in" style={{ padding: '20px', background: 'var(--bg-dark)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <AlertTriangle size={64} color="var(--danger)" style={{ marginBottom: '24px' }} />
        <h1 style={{ color: 'var(--danger)', fontSize: '2rem', marginBottom: '16px' }}>CUENTA BLOQUEADA</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px', maxWidth: '400px' }}>
          Has alcanzado el tope máximo de deuda con la plataforma <strong>(${financials.debt.toLocaleString()} COP)</strong>. No podrás recibir nuevos pedidos hasta que realices el pago.
        </p>
        
        <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'left', marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-main)', textAlign: 'center' }}>Selecciona tu método de pago</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', textAlign: 'center' }}>
            Para liberar tu aplicación, debes realizar el pago a través de las siguientes billeteras autorizadas.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <button 
              onClick={() => { setPaymentMethod('Nequi'); setShowPaymentModal(true); }}
              style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'var(--bg-dark)', border: '2px solid #E14896', color: '#E14896', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
            >
              <Building2 size={24} /> Nequi
            </button>
            <button 
              onClick={() => { setPaymentMethod('Daviplata'); setShowPaymentModal(true); }}
              style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'var(--bg-dark)', border: '2px solid #ED1C24', color: '#ED1C24', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
            >
              <Building2 size={24} /> Daviplata
            </button>
          </div>
        </div>
        
        <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
          Volver al Inicio (Modo Lectura)
        </button>

        {/* Modal de Pago Nequi/Daviplata */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
            <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '350px', padding: '24px', position: 'relative' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
              
              <h3 style={{ marginBottom: '8px', color: paymentMethod === 'Nequi' ? '#E14896' : '#ED1C24' }}>Pago con {paymentMethod}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Estás a punto de pagar tu deuda de <strong>${financials.debt.toLocaleString()} COP</strong> para reactivar tu cuenta.</p>
              <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '16px' }}>Los pagos están temporalmente deshabilitados hasta integrar un proveedor de pagos seguro.</p>
              
              <form onSubmit={handlePayDebt}>
                <div className="input-group" style={{ marginBottom: '24px' }}>
                  <label>Número de celular ({paymentMethod})</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="300 123 4567" 
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" disabled className="btn-primary" style={{ width: '100%', background: paymentMethod === 'Nequi' ? '#E14896' : '#ED1C24', color: 'white', borderColor: 'transparent', opacity: 0.6 }}>
                  <Send size={18} style={{ marginRight: '8px' }} /> Pago no disponible
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view-container animate-fade-in" style={{ padding: 0 }}>
      
      <div className="top-nav">
        <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1>Mi Billetera</h1>
        <div style={{ width: 24 }}></div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Balances Overview */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ flex: 1, padding: '16px', borderLeft: '4px solid var(--primary)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>Saldo para Compras</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>${financials.cardBalance.toLocaleString()}</h3>
          </div>
          <div className="glass-panel" style={{ flex: 1, padding: '16px', borderLeft: '4px solid var(--danger)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>Deuda Plataforma</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--danger)' }}>${financials.debt.toLocaleString()}</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tope: $50,000</p>
          </div>
        </div>

        {/* Virtual Card Section */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={20} color="var(--primary)" /> Tarjeta Virtual (Recargada)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Usa esta tarjeta para pagar los pedidos en el restaurante. El saldo es administrado por la plataforma.
        </p>

        {/* CSS Credit Card */}
        <div style={{ 
          background: isCardLocked ? 'linear-gradient(135deg, #475569, #1e293b)' : 'linear-gradient(135deg, var(--primary), var(--bg-surface-hover))', 
          borderRadius: 'var(--radius-lg)', 
          padding: '24px', 
          color: 'white',
          boxShadow: isCardLocked ? 'none' : '0 10px 25px rgba(16, 185, 129, 0.4)',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}>
          {isCardLocked && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}>
              <Lock size={40} color="white" style={{ marginBottom: '8px' }} />
              <span style={{ fontWeight: '600' }}>Tarjeta Bloqueada</span>
            </div>
          )}
          {/* Card decorative circles */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '1.2rem', fontWeight: '700', letterSpacing: '2px' }}>MENSAJERÍA APP</span>
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="rgba(255,255,255,0.5)"/>
              <circle cx="28" cy="12" r="12" fill="rgba(255,255,255,0.5)"/>
            </svg>
          </div>
          
          <div style={{ fontSize: '1.4rem', letterSpacing: '4px', marginBottom: '16px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
            <span>{showCardDetails ? '4532' : '••••'}</span> 
            <span>{showCardDetails ? '1234' : '••••'}</span> 
            <span>{showCardDetails ? '5678' : '••••'}</span> 
            <span>9012</span>
            <button onClick={handleCopyCard} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', position: 'relative' }}>
              <Copy size={14} />
              {copyMsg && <span className="animate-fade-in" style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', background: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>{copyMsg}</span>}
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', position: 'relative', zIndex: 1 }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.8, textTransform: 'uppercase' }}>Titular</span>
              <span>JUAN PÉREZ</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.8, textTransform: 'uppercase' }}>Vence</span>
              <span>12/28</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.6rem', opacity: 0.8, textTransform: 'uppercase' }}>CVV</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{showCardDetails ? cvv : '•••'}</span>
                {showCardDetails && (
                  <button onClick={() => setCvv(Math.floor(100 + Math.random() * 900).toString())} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QR Payment Buttons & Card Controls */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <button className="btn-primary" onClick={() => setShowQRScanner(true)} style={{ flex: 2, boxShadow: 'var(--shadow-glow)' }} disabled={isCardLocked}>
            <ScanLine size={20} /> Pagar
          </button>
          
          <button 
            className="btn-secondary" 
            onClick={() => setShowCardDetails(!showCardDetails)} 
            style={{ flex: 1, padding: '10px' }}
            disabled={isCardLocked}
          >
            {showCardDetails ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          
          <button 
            className="btn-secondary" 
            onClick={() => setIsCardLocked(!isCardLocked)} 
            style={{ flex: 1, padding: '10px', color: isCardLocked ? 'var(--danger)' : 'var(--text-main)', borderColor: isCardLocked ? 'var(--danger)' : 'var(--border-color)' }}
          >
            {isCardLocked ? <Unlock size={20} /> : <Lock size={20} />}
          </button>
        </div>


        {/* Bank Account Section */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={20} color="var(--primary)" /> Cuentas de Depósitos
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Configura tus cuentas de Nequi, Daviplata, Bancolombia, etc. para recibir tus pagos.
        </p>

        {bankAccount ? (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: 'var(--bg-surface-hover)', padding: '12px', borderRadius: '50%' }}>
              <Building2 size={24} color="var(--text-main)" />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '4px' }}>Cuenta registrada</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bankAccount}</p>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
            Aún no tienes una cuenta registrada para recibir tus pagos.
          </p>
        )}

        <button onClick={() => { setBankError(''); setShowAddBank(true); }} className="btn-secondary" style={{ width: '100%', color: 'var(--primary)', borderColor: 'var(--primary)', marginTop: '8px', marginBottom: '32px' }}>
          <Plus size={20} /> {bankAccount ? 'Cambiar cuenta bancaria' : 'Añadir cuenta bancaria'}
        </button>

        {/* Movimientos reales del libro contable */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Movimientos recientes
        </h3>

        {!transactions.length && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Todavía no tienes movimientos. Se registran al finalizar cada entrega.
          </p>
        )}

        {transactions.map(transaction => {
          const isEarning = transaction.type === 'EARNING';
          return (
            <div key={transaction.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                  {isEarning ? 'Ganancia por entrega' : transaction.type === 'PLATFORM_FEE' ? 'Comisión de plataforma' : transaction.type}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {new Date(transaction.createdAt).toLocaleString()}
                </p>
              </div>
              <strong style={{ color: isEarning ? 'var(--success)' : 'var(--danger)' }}>
                {transaction.amount > 0 ? '+' : ''}{Number(transaction.amount).toLocaleString()} COP
              </strong>
            </div>
          );
        })}

        <div style={{ flex: 1 }}></div>

        <button className="btn-primary" disabled style={{ marginTop: 'auto', opacity: 0.5, cursor: 'not-allowed' }}>
          <ArrowUpRight size={20} /> Retiro disponible próximamente
        </button>

      </div>

      {/* QR Scanner Full Screen Modal */}
      {showQRScanner && (
        <div className="animate-slide-up" style={{ position: 'fixed', inset: 0, background: 'var(--bg-dark)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div className="top-nav">
            <button onClick={() => setShowQRScanner(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h1>Escanear QR</h1>
            <div style={{ width: 24 }}></div>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', textAlign: 'center', fontSize: '1.1rem' }}>
              Apunta la cámara al <strong>código QR del restaurante</strong> para pagar el pedido con tu tarjeta virtual.
            </p>
            
            <div style={{ 
              width: '280px', height: '280px', 
              border: '2px solid var(--primary)', borderRadius: '24px', 
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 0 50px rgba(16, 185, 129, 0.2)'
            }}>
              {/* Fake camera feed background (Point of Sale machine) */}
              <div style={{ position: 'absolute', inset: 0, background: 'url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80) center/cover', opacity: 0.3 }}></div>
              
              {/* Corner brackets */}
              <div style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '4px solid var(--primary)', borderLeft: '4px solid var(--primary)' }}></div>
              <div style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '4px solid var(--primary)', borderRight: '4px solid var(--primary)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '4px solid var(--primary)', borderLeft: '4px solid var(--primary)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '4px solid var(--primary)', borderRight: '4px solid var(--primary)' }}></div>

              {/* Animated scanning line */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, height: '4px',
                background: 'var(--primary)',
                boxShadow: '0 0 15px var(--primary)',
                animation: 'scan 2.5s infinite linear'
              }}></div>
            </div>
            
            <button className="btn-secondary" onClick={() => setShowQRScanner(false)} style={{ marginTop: '40px', maxWidth: '280px' }}>
              Cancelar
            </button>
          </div>
          
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddBank && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '16px' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowAddBank(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
            
            <h3 style={{ marginBottom: '24px', fontSize: '1.2rem' }}>Registrar Cuenta Bancaria</h3>
            
            <form onSubmit={handleAddBank}>
              <div className="input-group">
                <label>Banco / Billetera</label>
                <select 
                  className="input-field" 
                  value={newBankName} 
                  onChange={(e) => setNewBankName(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Nequi">Nequi</option>
                  <option value="Daviplata">Daviplata</option>
                  <option value="Bancolombia">Bancolombia</option>
                  <option value="Nubank">Nubank</option>
                  <option value="BBVA">BBVA</option>
                  <option value="Banco de Bogotá">Banco de Bogotá</option>
                  <option value="Dale!">Dale!</option>
                  <option value="Otro">Otro Banco...</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '32px' }}>
                <label>Número de Cuenta o Celular</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ej: 300 123 4567" 
                  required
                  value={newBankAccount}
                  onChange={(e) => setNewBankAccount(e.target.value)}
                />
              </div>

              {bankError && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.85rem' }}>{bankError}</p>}

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Vincular Cuenta
              </button>
            </form>
          </div>
        </div>
      )}



    </div>
  );
}
