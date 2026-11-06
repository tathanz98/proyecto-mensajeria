import { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import MenuManager from './components/MenuManager';

const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:3000' : '');

function App() {
  const [currentView, setCurrentView] = useState('auth');
  const [checkingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('token')));

  // Si hay token guardado se valida antes de mostrar el portal.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingSession(false);
      return;
    }
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.ok) setCurrentView('dashboard'); else localStorage.clear(); })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = ({ id, name, token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('businessId', id);
    localStorage.setItem('businessName', name || 'Mi comercio');
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    setCurrentView('auth');
  };

  if (checkingSession) {
    return <div style={{ padding: '48px', color: 'var(--text-muted)' }}>Cargando tu comercio...</div>;
  }

  return (
    <div className="dashboard-container">
      {currentView === 'auth' && <Auth onLogin={handleLogin} />}
      {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} onLogout={handleLogout} />}
      {currentView === 'menu' && <MenuManager onNavigate={setCurrentView} />}
    </div>
  );
}

export default App;
