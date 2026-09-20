import { useState } from 'react';
import { Store, MapPin, Tag, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(false); // Default to register for businesses
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:3000' : '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/auth${isLogin ? '/login' : '/register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : { email, password, name, role: 'BUSINESS', bankAccount: 'No aplica' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No fue posible acceder al comercio.');
      onLogin({ id: data.userId || data.user?.id, name: data.user?.name || name });
    } catch (submitError) {
      setError(submitError.message || 'No fue posible conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      
      <div className="panel" style={{ width: '100%', maxWidth: '480px', padding: '32px', textAlign: 'center' }}>
        
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', marginBottom: '24px' }}>
          <Store size={40} />
        </div>
        
        <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
          {isLogin ? 'Acceso a Comercios' : 'Registra tu Negocio'}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          {isLogin ? 'Gestiona tus pedidos y menú' : 'Únete a nuestra red en Colombia y más allá'}
        </p>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          
          {!isLogin && (
            <>
              <div className="input-group">
                <label>Nombre del Establecimiento</label>
                <div style={{ position: 'relative' }}>
                  <Store size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input type="text" className="input-field" placeholder="Ej: Hamburguesas El Corral" style={{ paddingLeft: '40px' }} required value={name} onChange={event => setName(event.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>País</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                    <select className="input-field" style={{ paddingLeft: '40px' }}>
                      <option>Colombia</option>
                      <option>México</option>
                      <option>Perú</option>
                      <option>Argentina</option>
                    </select>
                  </div>
                </div>

                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Categoría</label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                    <select className="input-field" style={{ paddingLeft: '40px' }}>
                      <option>Restaurante</option>
                      <option>Farmacia</option>
                      <option>Supermercado</option>
                      <option>Licores</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="input-group">
            <label>Correo Electrónico Corporativo</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
              <input type="email" className="input-field" placeholder="contacto@negocio.com" style={{ paddingLeft: '40px' }} required value={email} onChange={event => setEmail(event.target.value)} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '32px' }}>
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
              <input type="password" className="input-field" placeholder="Mín. 8 caracteres, mayúscula y número" style={{ paddingLeft: '40px' }} required value={password} onChange={event => setPassword(event.target.value)} />
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem', marginBottom: '24px', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Conectando...' : isLogin ? 'Ingresar al Portal' : 'Comenzar a Vender'}
            <ArrowRight size={20} />
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isLogin ? '¿No tienes tu negocio registrado?' : '¿Ya tienes una cuenta?'}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', marginLeft: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {isLogin ? 'Regístralo aquí' : 'Inicia sesión'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
