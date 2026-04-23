import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MessageSquare, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for leafet default markers
const pickupIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #f59e0b; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const dropoffIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #ef4444; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const driverIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #10b981; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(16,185,129,0.8);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

export default function OrderTracking({ onNavigate }) {
  const [stage, setStage] = useState('pickup'); // 'pickup' or 'dropoff'
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  // Bogota coordinates
  const pickupLocation = [4.6097, -74.0817];
  const dropoffLocation = [4.6180, -74.0850];
  
  // Dynamic driver location to simulate movement
  const [driverLocation, setDriverLocation] = useState([4.6050, -74.0800]);

  // Simulate GPS movement
  useEffect(() => {
    const target = stage === 'pickup' ? pickupLocation : dropoffLocation;
    const interval = setInterval(() => {
      setDriverLocation(prev => {
        const moveLat = prev[0] + (target[0] - prev[0]) * 0.05;
        const moveLng = prev[1] + (target[1] - prev[1]) * 0.05;
        return [moveLat, moveLng];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  const pathCoords = [driverLocation, stage === 'pickup' ? pickupLocation : dropoffLocation];
  const fullPath = [pickupLocation, dropoffLocation];

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* Interactive Map Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <MapContainer 
          center={pickupLocation} 
          zoom={14} 
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          {/* Dark theme map tiles */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          />
          
          <Marker position={pickupLocation} icon={pickupIcon} />
          <Marker position={dropoffLocation} icon={dropoffIcon} />
          <Marker position={driverLocation} icon={driverIcon} />
          
          {/* Draw the full path in gray and active path in primary color */}
          <Polyline positions={fullPath} color="#334155" weight={4} dashArray="5, 10" />
          <Polyline positions={pathCoords} color="#10b981" weight={5} />
        </MapContainer>
      </div>

      {/* Top Bar overlay */}
      <div style={{ position: 'relative', zIndex: 10, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => onNavigate('dashboard')} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={20} />
        </button>
        
        <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--border-color)', fontWeight: '600', boxShadow: 'var(--shadow-glass)' }}>
          {stage === 'pickup' ? 'Yendo al Restaurante' : 'Yendo al Cliente'}
        </div>

        <button style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', cursor: 'pointer' }}>
          <Phone size={20} />
        </button>
      </div>

      <div style={{ flex: 1 }}></div>

      {/* Bottom Sheet Card */}
      <div className="glass-panel animate-slide-up" style={{ 
        position: 'relative', zIndex: 10, 
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        padding: '24px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.8)'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '4px' }}>
              {stage === 'pickup' ? 'Hamburguesas El Corral' : 'Juan Pérez'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {stage === 'pickup' ? 'Calle 123 #45-67, Centro' : 'Cra 89 #12-34, Apt 502'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>
              {stage === 'pickup' ? '8 min' : '12 min'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>2.5 km</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }}>
            <MessageSquare size={18} /> Chat
          </button>
          <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }}>
            <Navigation size={18} /> Navegar
          </button>
        </div>

        {stage === 'pickup' ? (
          <button className="btn-primary" onClick={() => setShowPinModal(true)}>
            Confirmar Recogida
          </button>
        ) : (
          <button className="btn-primary" onClick={() => onNavigate('proof')} style={{ background: 'var(--warning)', color: 'white' }}>
            Llegué al Destino
          </button>
        )}
      </div>

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Código del Restaurante</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              Pídele al restaurante el código de 4 dígitos para poder llevarte el pedido.
            </p>
            
            <input 
              type="text" 
              maxLength="4" 
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="0000"
              style={{ 
                width: '100%', textAlign: 'center', fontSize: '2.5rem', letterSpacing: '12px', 
                padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-dark)', 
                border: '2px solid var(--border-color)', color: 'white', marginBottom: '24px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPinModal(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => {
                if(pinInput === '1234') {
                  setShowPinModal(false);
                  setStage('dropoff');
                  setPinInput('');
                } else {
                  alert('Código incorrecto. Intenta 1234 para esta prueba.');
                }
              }}>
                Verificar y Recoger
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
