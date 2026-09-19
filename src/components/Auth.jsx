import { useState, useRef } from 'react';
import {
  Camera, Upload, X, CheckCircle, ArrowRight, Package,
  User, Mail, Lock, AlertCircle, ShieldCheck
} from 'lucide-react';

// ─── Componente separado para subir cada documento ───────────────────────────
function DocUploader({ label, isSelfie, file, preview, onCapture, onFile, onClear }) {
  const camRef = useRef(null);
  const fileRef = useRef(null);

  const handleChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    e.target.value = '';
    if (e.target === camRef.current) onCapture(f, url);
    else onFile(f, url);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Input cámara oculto */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture={isSelfie ? 'user' : 'environment'}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      {/* Input archivo oculto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
        {label}
      </p>

      {preview ? (
        // Vista previa de la foto capturada
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
          <img src={preview} alt={label} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }} />
          {/* Botones sobre la imagen */}
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => camRef.current?.click()}
              title="Recapturar con cámara"
              style={{ background: 'rgba(16,185,129,0.9)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}
            >
              <Camera size={16} color="white" />
            </button>
            <button
              type="button"
              onClick={() => onClear()}
              title="Eliminar foto"
              style={{ background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}
            >
              <X size={16} color="white" />
            </button>
          </div>
          <div style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={13} color="var(--primary)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '600' }}>
              {file?.name || 'Foto lista'} — toca 🗑 para cambiar
            </span>
          </div>
        </div>
      ) : (
        // Botones para elegir método
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Botón cámara */}
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px', padding: '18px 8px',
              borderRadius: '12px', border: '2px dashed rgba(16,185,129,0.4)',
              background: 'rgba(16,185,129,0.05)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Camera size={26} color="var(--primary)" />
            <span>{isSelfie ? 'Tomar Selfie' : 'Usar Cámara'}</span>
          </button>

          {/* Botón subir archivo */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px', padding: '18px 8px',
              borderRadius: '12px', border: '2px dashed rgba(99,102,241,0.4)',
              background: 'rgba(99,102,241,0.05)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Upload size={26} color="#6366f1" />
            <span>Subir Archivo</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal Auth ────────────────────────────────────────────────
export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState('Moto');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState(null);

  // Forgot Password
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetCode, setResetCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // KYC
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!isLogin && !acceptTerms) {
      setError('Debes leer y aceptar el Contrato de Prestación de Servicios.');
      return;
    }
    try {
      const endpoint = isLogin ? '/login' : '/register';
      const body = isLogin
        ? { email, password }
        : { email, password, name, vehicle, role: 'COURIER', bankAccount: 'Bancolombia' };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error en la autenticación'); return; }

      localStorage.setItem('token', data.token || 'demo-token');
      localStorage.setItem('userId', data.userId || data.user?.id);

      if (isLogin) {
        if (data.user.isVerified) { onLogin(); }
        else { setRegistrationStep(2); }
      } else {
        setRegistrationStep(2);
      }
    } catch {
      setError('Error de red. Asegúrate de que el Backend esté corriendo en el puerto 3000.');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      if (resetStep === 1) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) { setSuccessMsg(`Código enviado. (Demo - Código: ${data.simulatedCode})`); setResetStep(2); }
        else setError(data.error);
      } else if (resetStep === 2) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-code`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: resetCode })
        });
        const data = await res.json();
        if (res.ok) { setTempToken(data.tempToken); setSuccessMsg('Código verificado. Ingresa tu nueva contraseña.'); setResetStep(3); }
        else setError(data.error);
      } else if (resetStep === 3) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken, newPassword: password })
        });
        const data = await res.json();
        if (res.ok) { alert('¡Contraseña cambiada! Inicia sesión.'); setForgotPasswordMode(false); setResetStep(1); setSuccessMsg(''); }
        else setError(data.error);
      }
    } catch { setError('Error de conexión'); }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!selfieFile || !idFrontFile || !idBackFile) {
      setError('Debes subir las 3 fotos requeridas.');
      return;
    }
    setUploadingDocs(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('userId', localStorage.getItem('userId'));
      formData.append('selfie', selfieFile);
      formData.append('idFront', idFrontFile);
      formData.append('idBack', idBackFile);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/upload-docs`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) { setRegistrationStep(3); }
      else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error al verificar documentos.');
      }
    } catch { setError('Error de conexión.'); }
    finally { setUploadingDocs(false); }
  };

  // ── Step 2: Verificación KYC ───────────────────────────────────────────────
  if (registrationStep === 2) {
    const readyCount = [selfieFile, idFrontFile, idBackFile].filter(Boolean).length;
    const allReady = readyCount === 3;

    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'flex-start', paddingTop: '16px' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '28px 24px' }}>

          {/* Cabecera */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', marginBottom: '14px' }}>
              <ShieldCheck size={40} color="var(--primary)" />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '6px' }}>Verificación de Identidad</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Toma una foto con tu cámara o sube un archivo.<br />
              <strong style={{ color: 'var(--text-main)' }}>Sin cámara</strong>, usa "Subir Archivo" desde tu PC o galería.
            </p>
          </div>

          {/* Barra de progreso */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            <span>Progreso</span><span>{readyCount} / 3 documentos</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
            {[selfieFile, idFrontFile, idBackFile].map((f, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: '5px', borderRadius: '3px',
                  background: f ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s'
                }}
              />
            ))}
          </div>

          {error && (
            <div className="animate-slide-up" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleDocumentUpload}>
            <DocUploader
              label="1. 🤳 Selfie (rostro descubierto)"
              isSelfie={true}
              file={selfieFile}
              preview={selfiePreview}
              onCapture={(f, url) => { setSelfieFile(f); setSelfiePreview(url); }}
              onFile={(f, url) => { setSelfieFile(f); setSelfiePreview(url); }}
              onClear={() => { setSelfieFile(null); setSelfiePreview(null); }}
            />

            <DocUploader
              label="2. 🪪 Cédula (frente)"
              isSelfie={false}
              file={idFrontFile}
              preview={idFrontPreview}
              onCapture={(f, url) => { setIdFrontFile(f); setIdFrontPreview(url); }}
              onFile={(f, url) => { setIdFrontFile(f); setIdFrontPreview(url); }}
              onClear={() => { setIdFrontFile(null); setIdFrontPreview(null); }}
            />

            <DocUploader
              label="3. 🪪 Cédula (reverso)"
              isSelfie={false}
              file={idBackFile}
              preview={idBackPreview}
              onCapture={(f, url) => { setIdBackFile(f); setIdBackPreview(url); }}
              onFile={(f, url) => { setIdBackFile(f); setIdBackPreview(url); }}
              onClear={() => { setIdBackFile(null); setIdBackPreview(null); }}
            />

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center', lineHeight: '1.5', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              💡 Si no tienes cámara, toca <strong style={{ color: 'var(--text-main)' }}>"Subir Archivo"</strong> para adjuntar una imagen o PDF desde tu computador o galería.
            </p>

            <button
              type="submit"
              className="btn-primary"
              disabled={!allReady || uploadingDocs}
              style={{ width: '100%' }}
            >
              {uploadingDocs ? 'Verificando...' : 'Enviar para Verificación'} <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 3: Bienvenida ───────────────────────────────────────────────────────
  if (registrationStep === 3) {
    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', marginBottom: '24px' }}>
            <CheckCircle size={48} color="var(--primary)" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '16px' }}>¡Bienvenido al Equipo!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Tus documentos están en revisión rápida. Mientras tanto, ya puedes configurar tu Billetera y prepararte para recibir tu primer pedido.
          </p>
          <button onClick={onLogin} className="btn-primary" style={{ width: '100%' }}>
            Entrar a la App <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ── Recuperar contraseña ──────────────────────────────────────────────────
  if (forgotPasswordMode) {
    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>Recuperar Contraseña</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
            {resetStep === 1
              ? 'Ingresa tu correo para recibir un código.'
              : resetStep === 2
              ? 'Ingresa el código que recibiste.'
              : 'Crea tu nueva contraseña.'}
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--primary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'left' }}>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleForgotPassword}>
            {resetStep === 1 && (
              <div className="input-group">
                <label>Correo Electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" required className="input-field" />
              </div>
            )}
            {resetStep === 2 && (
              <div className="input-group">
                <label>Código de 6 dígitos</label>
                <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="Ej: 123456" maxLength={6} required className="input-field" />
              </div>
            )}
            {resetStep === 3 && (
              <div className="input-group">
                <label>Nueva Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="input-field" />
              </div>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '24px' }}>
              {resetStep === 1 ? 'Enviar Código' : resetStep === 2 ? 'Verificar Código' : 'Restablecer'}
            </button>
            <button type="button" onClick={() => { setForgotPasswordMode(false); setResetStep(1); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', width: '100%', marginTop: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Volver al inicio de sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 1: Login / Registro ───────────────────────────────────────────────
  return (
    <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', marginBottom: '24px' }}>
          <Package size={48} color="var(--primary)" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '8px' }}>
          {isLogin ? 'Bienvenido de nuevo' : 'Únete al equipo'}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          {isLogin ? 'Inicia sesión para comenzar a repartir' : 'Crea tu cuenta de repartidor'}
        </p>

        {error && (
          <div className="animate-slide-up" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '0.9rem', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label>Nombre Completo</label>
              <div style={{ position: 'relative' }}>
                <User size={20} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" placeholder="Juan Pérez" style={{ paddingLeft: '40px' }} required value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="input-group">
              <label>Tipo de Vehículo</label>
              <select className="input-field" value={vehicle} onChange={e => setVehicle(e.target.value)} style={{ width: '100%' }}>
                <option value="Moto">🏍️ Motocicleta</option>
                <option value="Bicicleta">🚲 Bicicleta</option>
                <option value="Carro">🚗 Carro</option>
              </select>
            </div>
          )}

          <div className="input-group">
            <label>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input type="email" className="input-field" placeholder="correo@ejemplo.com" style={{ paddingLeft: '40px' }} required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '32px' }}>
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input type="password" className="input-field" placeholder="••••••••" style={{ paddingLeft: '40px' }} required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          {!isLogin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', textAlign: 'left' }}>
              <input type="checkbox" id="terms" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <label htmlFor="terms" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                He leído y acepto el <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', padding: 0 }}>Contrato de Prestación de Servicios</button>.
              </label>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '24px' }}>
            {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
            <ArrowRight size={20} />
          </button>
        </form>

        {isLogin && (
          <p style={{ textAlign: 'center', marginBottom: '24px', fontSize: '0.9rem' }}>
            <button onClick={() => { setForgotPasswordMode(true); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button type="button" onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', marginLeft: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>

      {/* Modal Contrato */}
      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <button onClick={() => setShowTerms(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', padding: '24px 24px 0 24px' }}>Contrato de Prestación de Servicios</h3>
            <div style={{ overflowY: 'auto', padding: '0 24px 24px 24px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px' }}><strong>1. Naturaleza del Contrato:</strong> El presente acuerdo es de naturaleza comercial e independiente. El Domiciliario actuará como contratista independiente y no existirá relación laboral con la plataforma.</p>
              <p style={{ marginBottom: '12px' }}><strong>2. Tarifas y Descuentos:</strong> La plataforma deducirá un valor fijo de <strong>$5,000 COP</strong> por cada servicio completado de forma exitosa en concepto de uso tecnológico.</p>
              <p style={{ marginBottom: '12px' }}><strong>3. Prestaciones de Ley:</strong> El domiciliario autoriza expresamente a la plataforma para que retenga y automatice el pago de su seguridad social (Salud 4%, Pensión 4%) y aprovisionamiento de prima de servicios.</p>
              <p style={{ marginBottom: '12px' }}><strong>4. Confidencialidad y Seguridad:</strong> El domiciliario se compromete a no compartir los Códigos PIN de seguridad proporcionados para la recolección y entrega de los pedidos bajo ninguna circunstancia.</p>
              <p>Al hacer clic en aceptar, confirmas que has leído y entendido en su totalidad los términos aquí descritos.</p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" onClick={() => { setAcceptTerms(true); setShowTerms(false); }} className="btn-primary" style={{ width: '100%' }}>
                Aceptar Contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
