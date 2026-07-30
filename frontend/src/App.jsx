import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Musicos from './pages/Musicos.jsx';
import Eventos from './pages/Eventos.jsx';
import Finanzas from './pages/Finanzas.jsx';
import Financiamientos from './pages/Financiamientos.jsx';
import DescuentosSeccion from './pages/DescuentosSeccion.jsx';
import AdelantosSeccion from './pages/AdelantosSeccion.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Canaston from './pages/Canaston.jsx';
import TomaAsistenciaMovil from './pages/TomaAsistenciaMovil.jsx';
import MiResumen from './pages/MiResumen.jsx';
import Configuracion from './pages/Configuracion.jsx';

import { LogOut, User as UserIcon } from 'lucide-react';

function ProtectedRoutes() {
  const { user, loading, logout } = useAuth();
  
  // Also check localStorage for immediate synchronous state to avoid flicker if tokens exist
  const hasToken = !!localStorage.getItem('access_token');

  if (loading && hasToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user && !hasToken) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-left">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex-1"></div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-800 leading-tight">
                  {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                </span>
                <span className="text-xs text-gray-500 leading-tight capitalize">
                  {user?.rol?.replace('_', ' ').toLowerCase()}
                </span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            
            <button 
              onClick={logout} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 font-medium hover:bg-red-50 hover:text-red-700 transition-all border border-transparent hover:border-red-100"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Salir</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/musicos" element={<Musicos />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/finanzas" element={<Finanzas />} />
            <Route path="/financiamientos" element={<Financiamientos />} />
            <Route path="/descuentos-seccion" element={<DescuentosSeccion />} />
            <Route path="/adelantos-seccion" element={<AdelantosSeccion />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/canaston" element={<Canaston />} />
            <Route path="/asistencia-movil/:idEvento" element={<TomaAsistenciaMovil />} />
            <Route path="/mi-resumen" element={<MiResumen />} />
            <Route path="/mis-multas" element={<MiResumen />} />
            <Route path="/mis-contratos" element={<MiResumen />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
