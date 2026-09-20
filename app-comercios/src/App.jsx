import { useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import MenuManager from './components/MenuManager';

function App() {
  const [currentView, setCurrentView] = useState('auth');

  return (
    <div className="dashboard-container">
      {currentView === 'auth' && <Auth onLogin={(business) => { localStorage.setItem('businessId', business.id); localStorage.setItem('businessName', business.name || 'Mi comercio'); setCurrentView('dashboard'); }} />}
      {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} />}
      {currentView === 'menu' && <MenuManager onNavigate={setCurrentView} />}
    </div>
  );
}

export default App;
