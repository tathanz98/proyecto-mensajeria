import { useState, useRef } from 'react';
import { Mail, Lock, User, ArrowRight, Package, Camera, FileText, CheckCircle, X, AlertCircle, Upload, RotateCcw, ShieldCheck } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1); // 1: Info, 2: Docs, 3: Welcome
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState('Moto');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState(null);
  
  // Forgot Password States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [resetCode, setResetCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!isLogin && !acceptTerms) {
      setError('Debes leer y aceptar el contrato de prestación de servicios para continuar.');
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
      
      if (!res.ok) {
        setError(data.error || 'Error en la autenticación');
        return;
      }
      
      localStorage.setItem('token', data.token || 'demo-token');
      localStorage.setItem('userId', data.userId || data.user?.id);
      
      if (isLogin) {
        if (data.user.isVerified) {
          alert('¡Sesión iniciada con éxito!');
          onLogin();
        } else {
          // Si no está verificado, lo forzamos a la pantalla de subir fotos
          setRegistrationStep(2);
        }
      } else {
        setRegistrationStep(2);
      }
    } catch (err) {
      setError('Error de red. Asegúrate de que el Backend esté corriendo en el puerto 3000.');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      if (resetStep === 1) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(`Se ha enviado un código a tu correo. (Demo - Código: ${data.simulatedCode})`);
          setResetStep(2);
        } else setError(data.error);
      } else if (resetStep === 2) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: resetCode })
        });
        const data = await res.json();
        if (res.ok) {
          setTempToken(data.tempToken);
          setSuccessMsg('Código verificado. Ingresa tu nueva contraseña.');
          setResetStep(3);
        } else setError(data.error);
      } else if (resetStep === 3) {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken, newPassword: password })
        });
        const data = await res.json();
        if (res.ok) {
          alert('¡Contraseña cambiada con éxito! Inicia sesión.');
          setForgotPasswordMode(false);
          setResetStep(1);
          setSuccessMsg('');
        } else setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // KYC States
  const [selfieFile, setSelfieFile] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Refs para inputs ocultos
  const selfieInputCam = useRef(null);
  const selfieInputFile = useRef(null);
  const idFrontInputCam = useRef(null);
  const idFrontInputFile = useRef(null);
  const idBackInputCam = useRef(null);
  const idBackInputFile = useRef(null);

  const handleFileChange = (setter, previewSetter) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setter(file);
    previewSetter(URL.createObjectURL(file));
    // limpiar el valor del input para que se pueda volver a seleccionar el mismo archivo
    e.target.value = '';
  };

  const clearDoc = (setter, previewSetter) => {
    setter(null);
    previewSetter(null);
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
        body: formData, // El navegador pone automáticamente multipart/form-data
      });
      if (res.ok) {
        setRegistrationStep(3);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error al verificar documentos.');
      }
    } catch (error) {
      setError('Error de conexión.');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleFinishWelcome = () => {
    onLogin();
  };

  // Componente reutilizable para cada documento
  const DocUploader = ({ label, icon: Icon, file, preview, inputCamRef, inputFileRef, setter, previewSetter }) => (
    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
      {/* Inputs ocultos */}
      <input
        ref={inputCamRef}
        type="file"
        accept="image/*"
        capture={label.includes('Selfie') ? 'user' : 'environment'}
        style={{ display: 'none' }}
        onChange={handleFileChange(setter, previewSetter)}
      />
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange(setter, previewSetter)}
      />

      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
        {label}
      </label>

      {preview ? (
        /* Preview de la imagen capturada */
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--primary)', background: 'var(--bg-surface)' }}>
          <img
            src={preview}
            alt={label}
            style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
            <div style={{ background: 'rgba(16,185,129,0.9)', borderRadius: '50%', padding: '4px', display: 'flex' }}>
              <CheckCircle size={16} color="white" />
            </div>
            <button
              type="button"
              onClick={() => clearDoc(setter, previewSetter)}
              style={{ background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex' }}
              title="Cambiar foto"
            >
              <X size={16} color="white" />
            </button>
          </div>
          <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={14} color="var(--primary)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>Foto lista — toca ✕ para cambiar</span>
          </div>
        </div>
      ) : (
        /* Botones cuando no hay foto */
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => inputCamRef.current?.click()}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '16px 8px', borderRadius: '12px', border: '1.5px dashed var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(16,185,129,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <Icon size={24} />
            <span>{label.includes('Selfie') ? '📷 Selfie' : '📷 Cámara'}</span>
          </button>
          <button
            type="button"
            onClick={() => inputFileRef.current?.click()}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '16px 8px', borderRadius: '12px', border: '1.5px dashed var(--border-color)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <Upload size={24} />
            <span>📁 Subir archivo</span>
          </button>
        </div>
      )}
    </div>
  );

  if (registrationStep === 2) {
    const allReady = selfieFile && idFrontFile && idBackFile;
    const readyCount = [selfieFile, idFrontFile, idBackFile].filter(Boolean).length;
    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'flex-start', paddingTop: '16px' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '28px 24px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', marginBottom: '14px' }}>
              <ShieldCheck size={40} color="var(--primary)" />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '6px' }}>Verificación de Identidad</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Necesitamos validar tu identidad antes de empezar.<br />
              Puedes <strong style={{ color: 'var(--text-main)' }}>tomar fotos</strong> o <strong style={{ color: 'var(--text-main)' }}>subir archivos</strong>.
            </p>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Documentos</span>
            <span>{readyCount}/3</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
            {[selfieFile, idFrontFile, idBackFile].map((f, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '999px', background: f ? 'var(--primary)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s ease' }} />
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleDocumentUpload}>

            <DocUploader
              label="1. Tómate una Selfie"
              icon={Camera}
              file={selfieFile}
              preview={selfiePreview}
              inputCamRef={selfieInputCam}
              inputFileRef={selfieInputFile}
              setter={setSelfieFile}
              previewSetter={setSelfiePreview}
            />

            <DocUploader
              label="2. Cédula — Lado Frontal"
              icon={FileText}
              file={idFrontFile}
              preview={idFrontPreview}
              inputCamRef={idFrontInputCam}
              inputFileRef={idFrontInputFile}
              setter={setIdFrontFile}
              previewSetter={setIdFrontPreview}
            />

            <DocUploader
              label="3. Cédula — Lado Trasero"
              icon={FileText}
              file={idBackFile}
              preview={idBackPreview}
              inputCamRef={idBackInputCam}
              inputFileRef={idBackInputFile}
              setter={setIdBackFile}
              previewSetter={setIdBackPreview}
            />

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center', lineHeight: '1.5', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              💡 Sin cámara, usa <strong style={{ color: 'var(--text-main)' }}>"Subir archivo"</strong> para adjuntar una imagen o PDF desde tu computador.
            </p>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', opacity: (!allReady || uploadingDocs) ? 0.4 : 1, transition: 'opacity 0.3s' }}
              disabled={!allReady || uploadingDocs}
            >
              {uploadingDocs ? (
                <>
                  <RotateCcw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Enviando documentos...
                </>
              ) : (
                <>
                  {allReady ? '✅' : `${readyCount}/3`} Enviar Documentos <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (registrationStep === 3) {
    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', marginBottom: '24px' }}>
            <CheckCircle size={64} color="var(--success)" />
          </div>
          
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '16px' }}>¡Bienvenido al Equipo!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Tus documentos están en revisión rápida. Mientras tanto, ya puedes configurar tu Billetera y prepararte para recibir tu primer pedido.
          </p>

          <button onClick={handleFinishWelcome} className="btn-primary" style={{ width: '100%' }}>
            Entrar a la App <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  if (forgotPasswordMode) {
    return (
      <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <ShieldCheck size={48} color="var(--primary)" />
            <h2 style={{ marginTop: '16px' }}>Recuperar Contraseña</h2>
          </div>
          
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> {error}</div>}
          {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{successMsg}</div>}

          <form onSubmit={handleForgotPassword}>
            {resetStep === 1 && (
              <div className="input-group">
                <label>Correo Electrónico</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required className="input-field" />
              </div>
            )}
            
            {resetStep === 2 && (
              <div className="input-group">
                <label>Código de 6 dígitos</label>
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="Ej: 123456" maxLength={6} required className="input-field" style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }} />
              </div>
            )}

            {resetStep === 3 && (
              <div className="input-group">
                <label>Nueva Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required className="input-field" />
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

  return (
    <div className="view-container animate-fade-in" style={{ justifyContent: 'center', alignItems: 'center' }}>
      
      <div className="glass-panel animate-slide-up" style={{ width: '100%', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', marginBottom: '24px' }}>
          <Package size={48} color="var(--primary)" />
        </div>
        
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '8px' }}>
          {isLogin ? 'Bienvenido de nuevo' : 'Únete al equipo'}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          {isLogin ? 'Inicia sesión para comenzar a repartir' : 'Crea tu cuenta de repartidor'}
        </p>

        {error && (
          <div className="animate-slide-up" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
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
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Juan Pérez" 
                  style={{ paddingLeft: '40px' }} 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="input-group">
              <label>Tipo de Vehículo</label>
              <select 
                className="input-field" 
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                style={{ width: '100%' }}
              >
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
              <input 
                type="email" 
                className="input-field" 
                placeholder="correo@ejemplo.com" 
                style={{ paddingLeft: '40px' }} 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '32px' }}>
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="input-field" 
                placeholder="••••••••" 
                style={{ paddingLeft: '40px' }} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {!isLogin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', textAlign: 'left' }}>
              <input 
                type="checkbox" 
                id="terms" 
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
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
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', marginLeft: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>

      {/* Contract Modal */}
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
              
              <p style={{ marginBottom: '12px' }}><strong>3. Prestaciones de Ley:</strong> El domiciliario autoriza expresamente a la plataforma para que retenga y automatice el pago de su seguridad social (Salud 4%, Pensión 4%) y aprovisionamiento de prima de servicios, garantizando así su cobertura integral legal según la normativa colombiana vigente.</p>
              
              <p style={{ marginBottom: '12px' }}><strong>4. Confidencialidad y Seguridad:</strong> El domiciliario se compromete a no compartir los Códigos PIN de seguridad proporcionados para la recolección y entrega de los pedidos bajo ninguna circunstancia, y a verificar la identidad mediante el sistema de 4 dígitos estipulado.</p>
              
              <p>Al hacer clic en aceptar, confirmas que has leído y entendido en su totalidad los términos aquí descritos y consientes la validación de tus datos personales e identidad por parte de la plataforma.</p>
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
