import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { Save, Search, Shield, User, Lock, IdCard, CheckCircle2, ChevronRight, Activity, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Notification from '../components/Notification';

const roles = [
  { value: 'PRESIDENTE', label: 'Presidente Fundador', color: 'from-purple-500 to-indigo-600' },
  { value: 'DIRECTOR', label: 'Director', color: 'from-blue-500 to-cyan-600' },
  { value: 'SUBDIRECTOR', label: 'Subdirector', color: 'from-teal-500 to-emerald-600' },
  { value: 'JEFE_SECCION', label: 'Jefe de Sección', color: 'from-orange-500 to-amber-600' },
  { value: 'MUSICO', label: 'Músico', color: 'from-slate-500 to-slate-700' },
];

const secciones = [
  'TROMPETA', 'TROMBON', 'SAXOFON', 'CLARINETE', 
  'TUBA', 'BARITONO', 'PERCUSION'
];

export default function Usuarios() {
  const [musicos, setMusicos] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMusico, setSelectedMusico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userData, setUserData] = useState(null);
  const [selectedRol, setSelectedRol] = useState('MUSICO');
  const [selectedSeccion, setSelectedSeccion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: 'success', message: '' });

  const [modulosPorRol, setModulosPorRol] = useState({});
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Implementar debounce simple para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchMusicos(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchAllUsers();
    fetchRolesModules();
  }, []);

  const fetchRolesModules = async () => {
    try {
      const response = await api.get('/usuarios/roles_modules/');
      setModulosPorRol(response.data);
    } catch (err) {
      console.error('Error cargando módulos por rol', err);
    }
  };

  const fetchMusicos = async (search = '') => {
    try {
      const endpoint = search ? `/musicos/?search=${encodeURIComponent(search)}` : '/musicos/';
      const response = await api.get(endpoint);
      setMusicos(response.data);
    } catch (err) {
      console.error(err);
      setNotification({ show: true, type: 'error', message: 'No se pudo cargar la lista de músicos' });
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/usuarios/');
      setAllUsers(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMusicos = musicos;

  const handleSelectMusico = async (musico) => {
    setSelectedMusico(musico);
    setSelectedRol('MUSICO');
    
    try {
      const response = await api.get(`/usuarios/?musico_id=${musico.id}`);
      const usuarioData = response.data.length > 0 ? response.data[0] : null;
      
      if (usuarioData) {
        setUserData(usuarioData);
        setSelectedRol(usuarioData.rol || 'MUSICO');
        if (usuarioData.seccion_encargada) {
          setSelectedSeccion(
            typeof usuarioData.seccion_encargada === 'string'
              ? usuarioData.seccion_encargada.split(',').map(s => s.trim())
              : usuarioData.seccion_encargada
          );
        } else {
          setSelectedSeccion([]);
        }
      } else {
        setUserData(null);
        setSelectedSeccion([]);
      }
    } catch (err) {
      console.error(err);
      setNotification({ show: true, type: 'error', message: 'Error al cargar datos del usuario' });
    }
  };

  const getPinFromCI = (ci) => {
    if (!ci) return '----';
    const digits = ci.replace(/[^0-9]/g, '');
    return digits.slice(0, 4).padEnd(4, '0');
  };

  const generateUsername = (nombres, apellidos) => {
    if (!nombres) return 'usuario';
    const primerNombre = nombres.trim().split(' ')[0].toLowerCase();
    const existingUsernames = allUsers
      .filter(u => !userData || u.id !== userData.id)
      .map(u => u.username.toLowerCase());
    
    if (!existingUsernames.includes(primerNombre)) {
      return primerNombre;
    }
    
    let counter = 1;
    while (existingUsernames.includes(`${primerNombre}${counter}`)) {
      counter++;
    }
    return `${primerNombre}${counter}`;
  };

  const handleSubmit = async () => {
    if (!selectedMusico) {
      setNotification({ show: true, type: 'error', message: 'Selecciona un músico primero' });
      return;
    }

    if (selectedRol === 'JEFE_SECCION' && selectedSeccion.length === 0) {
      setNotification({ show: true, type: 'error', message: 'Debes seleccionar al menos una sección' });
      return;
    }

    setLoading(true);
    try {
      const password = getPinFromCI(selectedMusico.documento_identidad);
      const username = generateUsername(selectedMusico.nombres, selectedMusico.apellidos);
      
      const payload = {
        username: username,
        password: password,
        rol: selectedRol,
        ci: selectedMusico.documento_identidad,
        first_name: selectedMusico.nombres,
        last_name: selectedMusico.apellidos,
        telefono: selectedMusico.telefono,
        is_active: true,
        seccion_encargada: selectedRol === 'JEFE_SECCION' ? selectedSeccion.join(',') : null,
      };

      if (!userData) {
        payload.musico_data = {
          documento_identidad: selectedMusico.documento_identidad,
          nombres: selectedMusico.nombres,
          apellidos: selectedMusico.apellidos,
          telefono: selectedMusico.telefono,
        };
      }

      if (userData) {
        await api.patch(`/usuarios/${userData.id}/`, payload);
        const seccionesTexto = selectedSeccion.length > 0 ? selectedSeccion.join(', ') : 'ninguna';
        setNotification({ show: true, type: 'success', message: `¡ACTUALIZADO! ${selectedMusico.nombre_completo} ahora es ${selectedRol}` });
      } else {
        await api.post('/usuarios/', payload);
        const seccionesTexto = selectedSeccion.length > 0 ? selectedSeccion.join(', ') : 'ninguna';
        setNotification({ show: true, type: 'success', message: `¡CREADO! ${selectedMusico.nombre_completo} ahora es ${selectedRol}` });
      }
      
      const response = await api.get(`/usuarios/?musico_id=${selectedMusico.id}`);
      setUserData(response.data.length > 0 ? response.data[0] : null);
      await fetchAllUsers();
      
      setSelectedMusico(null);
      setUserData(null);
      setSelectedRol('MUSICO');
      setSelectedSeccion([]);
      setSearchTerm('');
    } catch (err) {
      console.error(err);
      setNotification({ show: true, type: 'error', message: 'ERROR AL GUARDAR EL USUARIO' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!userData || !userData.id) return;
    
    if (window.confirm(`¿Estás seguro de que deseas restablecer el PIN de ${selectedMusico.nombre_completo}?`)) {
      try {
        setLoading(true);
        const response = await api.post(`/usuarios/${userData.id}/reset_pin/`);
        setNotification({ show: true, type: 'success', message: response.data.message || 'PIN restablecido exitosamente' });
      } catch (err) {
        console.error(err);
        setNotification({ show: true, type: 'error', message: 'Error al restablecer el PIN' });
      } finally {
        setLoading(false);
      }
    }
  };

  // UI Helpers
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium */}
      <div className="flex flex-col gap-2 relative z-10">
        <div className="inline-flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">
            Usuarios y Permisos
          </h2>
        </div>
        <p className="text-slate-500 max-w-2xl text-lg ml-16">
          Gestiona los accesos, genera credenciales y controla los roles de cada integrante de la institución.
        </p>
      </div>

      {notification.show && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}

      {/* Main Container - Glassmorphism */}
      <section className="relative rounded-[2rem] border border-white/40 bg-white/60 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {!selectedMusico ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <Search className="w-5 h-5 text-indigo-500" />
                Buscar Integrante
              </h3>
              
              {/* Search Bar Premium */}
              <div className="relative group mb-8">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez o 1234567..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-white/80 border border-slate-200 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none shadow-sm placeholder:text-slate-400"
                />
              </div>

              {/* Resultados */}
              {searchTerm && filteredMusicos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMusicos.map((musico) => (
                    <button
                      key={musico.id}
                      onClick={() => handleSelectMusico(musico)}
                      className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white/50 hover:bg-white hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 text-left"
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold group-hover:from-indigo-100 group-hover:to-purple-100 group-hover:text-indigo-700 group-hover:border-indigo-300 transition-colors">
                        {getInitials(musico.nombre_completo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                          {musico.nombre_completo}
                        </p>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          <IdCard className="w-3 h-3" /> {musico.documento_identidad}
                        </p>
                      </div>
                      <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {searchTerm && filteredMusicos.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900">No se encontraron resultados</h4>
                  <p className="text-slate-500 mt-1">Intenta buscar con otro nombre o número de documento.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
              {/* Header del Usuario Seleccionado */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-200/60">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
                    {getInitials(selectedMusico.nombre_completo)}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-slate-900">
                      {selectedMusico.nombre_completo}
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-sm font-medium text-slate-600 mt-2">
                      <Activity className="w-4 h-4" />
                      {selectedMusico.instrumento}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {userData && (
                    <button
                      onClick={handleResetPin}
                      disabled={loading}
                      className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 font-semibold rounded-xl hover:bg-rose-600 hover:text-white transition-colors border border-rose-200 hover:border-rose-600 focus:ring-4 focus:ring-rose-500/20"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Restaurar PIN</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedMusico(null);
                      setUserData(null);
                      setSelectedRol('MUSICO');
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              
              {/* Widgets de Credenciales */}
              <div>
                <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Credenciales de Acceso</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white/80 border border-slate-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Nombre Corto</p>
                    <p className="text-lg font-bold text-slate-900 truncate">{selectedMusico.nombres.split(' ')[0]}</p>
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Usuario (Login)</p>
                    <p className="text-lg font-bold text-indigo-600 truncate">{generateUsername(selectedMusico.nombres, selectedMusico.apellidos)}</p>
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-500">PIN / Contraseña</p>
                      {userData?.pin_actual && (
                        <button 
                          onClick={() => setShowPin(!showPin)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title={showPin ? "Ocultar PIN" : "Mostrar PIN (Solo Presidente)"}
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-lg font-bold text-slate-900 tracking-widest">
                      {userData?.pin_actual ? (showPin ? userData.pin_actual : '****') : '****'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {userData?.pin_actual ? 'Configurado' : 'Oculto por seguridad'}
                    </p>
                  </div>
                  <div className="bg-white/80 border border-slate-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-xs font-semibold text-slate-500 mb-1">C.I.</p>
                    <p className="text-lg font-bold text-slate-900">{selectedMusico.documento_identidad || '---'}</p>
                  </div>
                </div>
              </div>

              {/* Selector de Roles Premium */}
              <div>
                <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Nivel de Autoridad</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {roles.map((role) => {
                    const isSelected = selectedRol === role.value;
                    const colorParts = role.color.split('-');
                    const mainColor = colorParts.length >= 2 ? colorParts[1] : 'indigo';
                    return (
                      <button
                        key={role.value}
                        onClick={() => setSelectedRol(role.value)}
                        className={`relative group overflow-hidden p-4 rounded-2xl border-2 transition-all duration-300 text-left h-full ${
                          isSelected
                            ? `border-transparent shadow-lg scale-[1.02] bg-white`
                            : 'border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white'
                        }`}
                        style={isSelected ? { boxShadow: `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` } : {}}
                      >
                        {isSelected && (
                          <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-10`} />
                        )}
                        <div className="relative flex items-start justify-between">
                          <div className={`font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                            {role.label}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className={`w-5 h-5 text-${mainColor}-600 drop-shadow-sm animate-in zoom-in`} />
                          )}
                        </div>
                        {isSelected && (
                          <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${role.color}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Opciones Especiales (Jefe de Sección) */}
              {selectedRol === 'JEFE_SECCION' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <h5 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Responsabilidad de Sección
                  </h5>
                  <div className="bg-orange-50/50 border border-orange-200/60 p-6 rounded-2xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {secciones.map((seccion) => {
                        const isChecked = selectedSeccion.includes(seccion);
                        return (
                          <label 
                            key={seccion} 
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              isChecked ? 'border-orange-500 bg-orange-100/50 text-orange-900' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedSeccion([...selectedSeccion, seccion]);
                                else setSelectedSeccion(selectedSeccion.filter(s => s !== seccion));
                              }}
                            />
                            <span className="text-xs font-bold text-center">{seccion}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Módulos Permitidos (Visualización en Tags) */}
              <div>
                <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Acceso a Módulos (En Vivo)</h5>
                <div className="bg-slate-900 rounded-2xl p-6 shadow-inner border border-slate-800">
                  <div className="flex flex-wrap gap-3">
                    {modulosPorRol[selectedRol]?.map((modulo, index) => (
                      <div key={index} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/5 backdrop-blur-sm text-sm font-medium text-slate-200 animate-in fade-in zoom-in duration-300" style={{animationDelay: `${index * 50}ms`}}>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        {modulo}
                      </div>
                    ))}
                    {(!modulosPorRol[selectedRol] || modulosPorRol[selectedRol].length === 0) && (
                      <div className="text-slate-500 text-sm italic py-2">Ningún módulo asignado.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones Finales */}
              <div className="flex justify-end pt-4 border-t border-slate-200/60">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 focus:ring-4 focus:ring-slate-900/20 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_100%] animate-gradient" />
                  <Save className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{loading ? 'Procesando...' : (userData ? 'Guardar Cambios' : 'Confirmar Nuevo Usuario')}</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </section>
      
      {/* Animación global CSS añadida */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}} />
    </div>
  );
}
