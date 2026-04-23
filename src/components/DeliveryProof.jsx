import { useState } from 'react';
import { Camera, Upload, CheckCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';

export default function DeliveryProof({ onNavigate }) {
  const [photoTaken, setPhotoTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerPin, setCustomerPin] = useState('');

  const handleComplete = () => {
    if (customerPin.length !== 4) {
      alert('Debes ingresar el código de 4 dígitos proporcionado por el cliente.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onNavigate('dashboard');
    }, 1500);
  };

  return (
    <div className="view-container animate-fade-in" style={{ padding: 0 }}>
      
      <div className="top-nav">
        <button onClick={() => onNavigate('tracking')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1>Evidencia de Entrega</h1>
        <div style={{ width: 24 }}></div> {/* spacer */}
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Toma una foto del pedido entregado o la puerta del cliente para finalizar el viaje.
        </p>

        {/* Camera Viewport Placeholder */}
        <div style={{ 
          flex: 1,
          background: photoTaken ? 'url(https://images.unsplash.com/photo-1620619767323-b95a89183081?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80) center/cover' : 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: `2px dashed ${photoTaken ? 'var(--primary)' : 'var(--border-color)'}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          
          {!photoTaken ? (
            <>
              <Camera size={64} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Cámara Activa</p>
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '50%', color: 'white' }}>
                <CheckCircle size={48} />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {!photoTaken ? (
            <>
              <button className="btn-secondary" style={{ flex: 1 }}>
                <ImageIcon size={20} /> Galería
              </button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => setPhotoTaken(true)}>
                <Camera size={20} /> Tomar Foto
              </button>
            </>
          ) : (
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPhotoTaken(false)}>
              Volver a tomar
            </button>
          )}
        </div>

        <div className="input-group">
          <label>Notas adicionales (Opcional)</label>
          <textarea 
            className="input-field" 
            placeholder="Ej: Lo dejé en recepción..." 
            rows="2"
            style={{ resize: 'none' }}
          ></textarea>
        </div>

        <div className="input-group" style={{ marginBottom: '24px' }}>
          <label style={{ color: 'var(--primary)', fontWeight: '600' }}>Código de Recepción del Cliente</label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Solicítale el PIN al cliente para confirmar la entrega.</p>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Ej: 9876" 
            maxLength="4"
            value={customerPin}
            onChange={(e) => setCustomerPin(e.target.value)}
            style={{ fontSize: '1.2rem', letterSpacing: '4px', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}
          />
        </div>

        <button 
          className="btn-primary" 
          disabled={!photoTaken || submitting || customerPin.length !== 4}
          onClick={handleComplete}
          style={{ 
            marginTop: 'auto',
            background: !photoTaken ? 'var(--bg-surface-hover)' : 'var(--primary)',
            opacity: (!photoTaken || submitting) ? 0.7 : 1
          }}
        >
          {submitting ? 'Enviando...' : 'Finalizar Entrega'}
        </button>

      </div>
    </div>
  );
}
