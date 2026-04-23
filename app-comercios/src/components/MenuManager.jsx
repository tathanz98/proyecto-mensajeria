import { useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Plus, QrCode, Download, Settings } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // Dependency for QR Code generation

export default function MenuManager({ onNavigate }) {
  const [showQRModal, setShowQRModal] = useState(false);
  const [menuItems, setMenuItems] = useState([
    { id: 1, name: 'Hamburguesa Clásica', price: '$8.50', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80' },
    { id: 2, name: 'Papas Fritas Grandes', price: '$3.00', image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80' }
  ]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Top Nav */}
      <nav style={{ background: 'var(--bg-surface)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h2 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}>
            <ArrowLeft size={20} /> Portal Comercio
          </h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', fontWeight: '500', color: 'var(--text-muted)', cursor: 'pointer' }}>Pedidos Activos</button>
            <button style={{ background: 'none', border: 'none', fontWeight: '600', color: 'var(--primary)', cursor: 'pointer' }}>Mi Menú / Catálogo</button>
          </div>
        </div>
      </nav>

      <div style={{ padding: '32px 0', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1>Catálogo de Productos</h1>
            <p style={{ color: 'var(--text-muted)' }}>Sube fotos de tus productos y genera tu menú digital</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => setShowQRModal(true)} style={{ color: 'var(--text-main)' }}>
              <QrCode size={18} /> Mi Menú QR
            </button>
            <button className="btn-primary">
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>
        </div>

        {/* Upload Area Placeholder */}
        <div className="panel" style={{ padding: '40px', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px', borderColor: 'var(--border-color)', background: 'var(--bg-surface-hover)', marginBottom: '32px', cursor: 'pointer' }}>
          <ImageIcon size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Sube nuevas fotos</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Arrastra y suelta imágenes o haz clic para buscar en tu dispositivo.</p>
        </div>

        {/* Menu Items Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
          {menuItems.map(item => (
            <div key={item.id} className="panel" style={{ overflow: 'hidden' }}>
              <div style={{ height: '160px', background: `url(${item.image}) center/cover` }}></div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '600' }}>{item.name}</h4>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Settings size={18} />
                  </button>
                </div>
                <p style={{ color: 'var(--primary)', fontWeight: '700' }}>{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '350px', padding: '32px', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowQRModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ArrowLeft size={24} />
            </button>
            
            <h2 style={{ marginBottom: '8px' }}>Tu Menú Digital</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Imprime este código o muéstralo a tus clientes para que vean tu carta.
            </p>

            <div style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-lg)', display: 'inline-block', boxShadow: 'var(--shadow-md)', marginBottom: '24px' }}>
              {/* Generate QR pointing to a hypothetical menu link */}
              <QRCodeSVG value="https://app.mensajeria.com/menu/restaurante-demo" size={200} />
            </div>

            <button className="btn-primary" style={{ width: '100%' }}>
              <Download size={18} /> Descargar QR
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
