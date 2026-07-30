import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, FileText, Trophy, LogOut, Music, TrendingDown, TrendingUp, DollarSign, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  
  // En lugar de hacer una petición manual, usamos los datos del usuario logueado
  const userModules = user?.modulos || [];
  const loading = !user;

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'DASHBOARD' },
    { path: '/musicos', icon: Users, label: 'Músicos', moduleKey: 'MUSICOS' },
    { path: '/eventos', icon: CalendarDays, label: 'Relación Nominal / Eventos', moduleKey: 'EVENTOS' },
    { path: '/finanzas', icon: FileText, label: 'Liquidaciones', moduleKey: 'LIQUIDACIONES' },
    { path: '/financiamientos', icon: DollarSign, label: 'Financiamientos', moduleKey: 'FINANCIAMIENTO' },
    { path: '/descuentos-seccion', icon: TrendingDown, label: 'Descuentos por Sección', moduleKey: 'DESCUENTOS' },
    { path: '/adelantos-seccion', icon: TrendingUp, label: 'Adelantos por Sección', moduleKey: 'ADELANTOS' },
    { path: '/usuarios', icon: Key, label: 'Usuarios & Roles', moduleKey: 'ADMIN_USUARIOS' },
    { path: '/canaston', icon: Trophy, label: 'Canastón', moduleKey: 'CANASTON' },
    { path: '/mi-resumen', icon: DollarSign, label: 'Mi Resumen', moduleKey: 'MI_RESUMEN' },
    { path: '/mis-multas', icon: TrendingDown, label: 'Mis Multas', moduleKey: 'MIS_MULTAS' },
    { path: '/mis-contratos', icon: FileText, label: 'Mis Contratos', moduleKey: 'MIS_CONTRATOS' },
    { path: '/configuracion', icon: Key, label: 'Mi Perfil (Configuración)', moduleKey: 'CONFIGURACION' },
  ];

  const getMenuItemsByRole = (rol) => {
    switch(rol) {
      case 'PRESIDENTE':
      case 'PRESIDENTE FUNDADOR':
        return allMenuItems.filter(i => !['MIS_MULTAS', 'MIS_CONTRATOS'].includes(i.moduleKey));
      case 'DIRECTOR':
      case 'SUBDIRECTOR':
        return allMenuItems.filter(i => !['ADMIN_USUARIOS', 'MIS_MULTAS', 'MIS_CONTRATOS'].includes(i.moduleKey));
      case 'JEFE_SECCION':
        return allMenuItems.filter(i => ['DASHBOARD', 'MUSICOS', 'EVENTOS', 'DESCUENTOS', 'CONFIGURACION'].includes(i.moduleKey));
      case 'MUSICO':
        return allMenuItems.filter(i => ['DASHBOARD', 'EVENTOS', 'MI_RESUMEN', 'MIS_MULTAS', 'MIS_CONTRATOS', 'CONFIGURACION'].includes(i.moduleKey)).map(item => {
          if (item.moduleKey === 'EVENTOS') {
            return { ...item, label: 'Relación Nominal' }; // Rename specific for Musico
          }
          return item;
        });
      default:
        return allMenuItems.filter(i => ['DASHBOARD', 'CONFIGURACION'].includes(i.moduleKey));
    }
  };

  const menuItems = loading ? [] : getMenuItemsByRole(user?.rol);

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Music className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 leading-none">Banda Mejillones de Bolivia</h1>
          <span className="text-xs text-gray-500">Panel de Director</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

    </aside>
  );
}
