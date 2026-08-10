import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, FileText,
  Trophy, Music, TrendingDown, TrendingUp, DollarSign,
  Key, X, Menu, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const allMenuItems = [
    { path: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard',              moduleKey: 'DASHBOARD' },
    { path: '/musicos',            icon: Users,           label: 'Músicos',                moduleKey: 'MUSICOS' },
    { path: '/eventos',            icon: CalendarDays,    label: 'Relación Nominal',        moduleKey: 'EVENTOS' },
    { path: '/finanzas',           icon: FileText,        label: 'Liquidaciones',           moduleKey: 'LIQUIDACIONES' },
    { path: '/financiamientos',    icon: DollarSign,      label: 'Financiamientos',         moduleKey: 'FINANCIAMIENTO' },
    { path: '/descuentos-seccion', icon: TrendingDown,    label: 'Descuentos por Sección',  moduleKey: 'DESCUENTOS' },
    { path: '/adelantos-seccion',  icon: TrendingUp,      label: 'Adelantos por Sección',   moduleKey: 'ADELANTOS' },
    { path: '/usuarios',           icon: Key,             label: 'Usuarios & Roles',        moduleKey: 'ADMIN_USUARIOS' },
    { path: '/canaston',           icon: Trophy,          label: 'Canastón',                moduleKey: 'CANASTON' },
    { path: '/mi-resumen',         icon: DollarSign,      label: 'Mi Resumen',              moduleKey: 'MI_RESUMEN' },
    { path: '/mis-multas',         icon: TrendingDown,    label: 'Mis Multas',              moduleKey: 'MIS_MULTAS' },
    { path: '/mis-contratos',      icon: FileText,        label: 'Mis Contratos',           moduleKey: 'MIS_CONTRATOS' },
    { path: '/configuracion',      icon: Key,             label: 'Mi Perfil',               moduleKey: 'CONFIGURACION' },
  ];

  const getMenuItemsByRole = (rol) => {
    switch (rol) {
      case 'PRESIDENTE':
      case 'PRESIDENTE FUNDADOR':
        return allMenuItems.filter(i => !['MIS_MULTAS', 'MIS_CONTRATOS'].includes(i.moduleKey));
      case 'DIRECTOR':
      case 'SUBDIRECTOR':
        return allMenuItems.filter(i => !['ADMIN_USUARIOS', 'MIS_MULTAS', 'MIS_CONTRATOS'].includes(i.moduleKey));
      case 'JEFE_SECCION':
        return allMenuItems.filter(i => ['DASHBOARD', 'MUSICOS', 'EVENTOS', 'DESCUENTOS', 'CONFIGURACION'].includes(i.moduleKey));
      case 'MUSICO':
        return allMenuItems.filter(i => ['DASHBOARD', 'EVENTOS', 'MI_RESUMEN', 'MIS_MULTAS', 'MIS_CONTRATOS', 'CONFIGURACION'].includes(i.moduleKey));
      default:
        return allMenuItems.filter(i => ['DASHBOARD', 'CONFIGURACION'].includes(i.moduleKey));
    }
  };

  const menuItems = user ? getMenuItemsByRole(user.rol) : [];
  const roleLabel = user?.rol?.replace('_', ' ').toLowerCase() || '';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">Banda Mejillones</h1>
            <span className="text-xs text-gray-400 capitalize">{roleLabel}</span>
          </div>
        </div>
        {/* Botón cerrar solo en móvil */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-sm group ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <span className="truncate">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-400" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer usuario */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-700">
              {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
            </p>
            <p className="text-xs text-gray-400 capitalize truncate">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:flex-shrink-0 lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          shadow-xl lg:shadow-none border-r border-gray-200
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
