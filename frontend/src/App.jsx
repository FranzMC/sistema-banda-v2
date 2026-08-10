import { useState } from 'react';
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
import { LogOut, Menu, User as UserIcon } from 'lucide-react';

function ProtectedRoutes() {
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar — recibe estado y callback */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-x-hidden min-w-0">

        {/* Top Header — responsivo */}
        <header className="bg-white border-b border-gray-200 h-14 md:h-16 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-20">
          {/* Botón hamburguesa (solo móvil) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors mr-2"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Título en móvil */}
          <span className="lg:hidden text-sm font-semibold text-gray-700 truncate flex-1">
            Banda Mejillones
          </span>

          {/* Espaciador en desktop */}
          <div className="hidden lg:flex flex-1" />

          {/* Usuario y salir */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 flex-shrink-0">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-semibold text-gray-800 leading-tight">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
                </span>
                <span className="text-xs text-gray-400 capitalize leading-tight">
                  {user?.rol?.replace('_', ' ').toLowerCase()}
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-px bg-gray-200" />

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 font-medium hover:bg-red-50 transition-all border border-transparent hover:border-red-100 text-sm"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Contenido de páginas */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5">
          <Routes>
            <Route path="/"                        element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard"               element={<Dashboard />} />
            <Route path="/musicos"                 element={<Musicos />} />
            <Route path="/eventos"                 element={<Eventos />} />
            <Route path="/finanzas"                element={<Finanzas />} />
            <Route path="/financiamientos"         element={<Financiamientos />} />
            <Route path="/descuentos-seccion"      element={<DescuentosSeccion />} />
            <Route path="/adelantos-seccion"       element={<AdelantosSeccion />} />
            <Route path="/usuarios"                element={<Usuarios />} />
            <Route path="/canaston"                element={<Canaston />} />
            <Route path="/asistencia-movil/:idEvento" element={<TomaAsistenciaMovil />} />
            <Route path="/mi-resumen"              element={<MiResumen />} />
            <Route path="/mis-multas"              element={<MiResumen />} />
            <Route path="/mis-contratos"           element={<MiResumen />} />
            <Route path="/configuracion"           element={<Configuracion />} />
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
        <Toaster
          position="top-center"
          toastOptions={{
            style: { maxWidth: '90vw', fontSize: '14px' },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*"    element={<ProtectedRoutes />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
