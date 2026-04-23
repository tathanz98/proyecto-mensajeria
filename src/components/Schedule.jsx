import { useState } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Check } from 'lucide-react';

export default function Schedule({ onNavigate }) {
  // Mock days and slots
  const days = ['Lun 24', 'Mar 25', 'Mié 26', 'Jue 27', 'Vie 28', 'Sáb 29', 'Dom 30'];
  const [selectedDay, setSelectedDay] = useState(0);

  const [reservedSlots, setReservedSlots] = useState({
    0: [1], // Monday has slot index 1 reserved
    1: [],
    2: [0, 2]
  });

  const slots = [
    { time: '08:00 AM - 12:00 PM', demand: 'Alta' },
    { time: '12:00 PM - 04:00 PM', demand: 'Muy Alta' },
    { time: '04:00 PM - 08:00 PM', demand: 'Media' },
    { time: '08:00 PM - 12:00 AM', demand: 'Baja' }
  ];

  const toggleSlot = (dayIdx, slotIdx) => {
    setReservedSlots(prev => {
      const daySlots = prev[dayIdx] || [];
      if (daySlots.includes(slotIdx)) {
        return { ...prev, [dayIdx]: daySlots.filter(id => id !== slotIdx) };
      } else {
        return { ...prev, [dayIdx]: [...daySlots, slotIdx] };
      }
    });
  };

  return (
    <div className="view-container animate-fade-in" style={{ padding: 0 }}>
      
      <div className="top-nav">
        <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1>Reserva de Horarios</h1>
        <div style={{ width: 24 }}></div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Selecciona los bloques de horas en los que deseas conectarte para trabajar.
        </p>

        {/* Days Horizontal Scroll */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '16px', marginBottom: '16px', scrollbarWidth: 'none' }}>
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDay(idx)}
              style={{
                minWidth: '80px',
                padding: '12px 8px',
                borderRadius: 'var(--radius-md)',
                background: selectedDay === idx ? 'var(--primary)' : 'var(--bg-surface)',
                border: `1px solid ${selectedDay === idx ? 'var(--primary)' : 'var(--border-color)'}`,
                color: selectedDay === idx ? 'white' : 'var(--text-main)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <CalendarIcon size={20} />
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{day}</span>
            </button>
          ))}
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="var(--primary)" /> Turnos Disponibles
        </h3>

        {/* Time Slots List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {slots.map((slot, idx) => {
            const isReserved = (reservedSlots[selectedDay] || []).includes(idx);
            
            return (
              <div 
                key={idx} 
                className="glass-panel" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  border: isReserved ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isReserved ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface)'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '4px' }}>{slot.time}</h4>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    background: slot.demand === 'Muy Alta' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: slot.demand === 'Muy Alta' ? 'var(--danger)' : 'var(--warning)',
                    fontWeight: '600'
                  }}>
                    Demanda {slot.demand}
                  </span>
                </div>
                
                <button
                  onClick={() => toggleSlot(selectedDay, idx)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isReserved ? 'var(--primary)' : 'transparent',
                    border: `2px solid ${isReserved ? 'var(--primary)' : 'var(--border-color)'}`,
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {isReserved && <Check size={20} />}
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
