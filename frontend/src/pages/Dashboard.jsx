import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import {
  Users, Calendar, DollarSign, Clock,
  CheckCircle, ArrowRight, Trophy, AlertCircle, CalendarCheck,
  Wallet, UserCheck, BarChart3, PieChart as PieChartIcon, Music
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#0ea5e9'];

function StatCard({ label, value, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 hover:shadow-lg transition-shadow border border-slate-100 relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ${color}`}></div>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500 mb-1 relative z-10">{label}</p>
      <h3 className="text-3xl font-bold text-slate-900 relative z-10">{value}</h3>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col gap-6 animate-pulse">
      <div className="h-16 bg-slate-200 rounded-3xl w-full"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-36 bg-slate-200 rounded-3xl"></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-80 bg-slate-200 rounded-3xl"></div>
        <div className="h-80 bg-slate-200 rounded-3xl"></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    // Polling inteligente cada 60 segundos para mantener datos vivos sin F5
    const interval = setInterval(() => {
      fetchDashboardData(false); // fetch sin mostrar loader (optimistic)
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await api.get('dashboard/');
      setDashboardData(response.data);
    } catch (err) {
      console.error(err);
      if (showLoader) setError('No se pudo cargar los datos del dashboard');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error de conexión</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => fetchDashboardData()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const isPresidente = dashboardData?.rol === 'PRESIDENTE';
  const isDirector = dashboardData?.rol === 'DIRECTOR';
  const isSubdirector = dashboardData?.rol === 'SUBDIRECTOR';
  const isJefeSeccion = dashboardData?.rol === 'JEFE_SECCION';

  return (
    <div className="min-h-screen bg-slate-50/50 p-3 md:p-5">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ===================== HEADER GLOBAL ===================== */}
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row flex-wrap items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
              Hola, <span className="text-blue-600 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">{user?.first_name || dashboardData?.usuario_nombre || user?.username || 'Usuario'}</span>
            </h1>
            <p className="text-slate-500 font-medium">Banda de Música Espectacular Mejillones "Eco de los Andes"</p>
          </div>
          <div className="mt-6 md:mt-0">
            <span className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 ${
              isPresidente ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              isDirector ? 'bg-blue-50 text-blue-600 border border-blue-200' : 
              isSubdirector ? 'bg-violet-50 text-violet-600 border border-violet-200' :
              'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              <UserCheck className="w-4 h-4" />
              {isPresidente ? 'Panel Ejecutivo - Presidencia' :
               isDirector ? 'Panel de Dirección Musical' :
               isSubdirector ? 'Panel de Administración' : 
               isJefeSeccion ? 'Panel de Jefe de Sección' : 'Portal de Usuario'}
            </span>
          </div>
        </div>

        {/* ===================== ROL: PRESIDENTE ===================== */}
        {isPresidente && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Balance (Pagos Efectivos)" value={`Bs ${dashboardData.balance_general?.total_liquidado || 0}`} icon={BarChart3} color="bg-emerald-500" trend="Capital" />
              <StatCard label="Deuda Recuperada" value={`Bs ${dashboardData.financiamientos?.total_recuperado || 0}`} icon={Wallet} color="bg-blue-500" trend={`de Bs ${dashboardData.financiamientos?.total_financiado || 0}`} />
              <StatCard label="Músicos Activos" value={dashboardData.total_musicos} icon={Users} color="bg-violet-500" trend={`vs ${dashboardData.crecimiento?.ano_pasado} en ${new Date().getFullYear()-1}`} />
              <StatCard label="Eventos del Año" value={dashboardData.total_eventos} icon={Trophy} color="bg-rose-500" trend="Totales" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Gráfico Financiero/Eventos */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Proyección de Eventos (Año Actual)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={dashboardData.eventos_por_mes || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="eventos" fill="url(#colorUv)" radius={[8, 8, 0, 0]} barSize={40} />
                      <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ranking de Indisciplina (Descuentos) Global */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Ranking de Descuentos por Sección</h3>
                  <button onClick={() => navigate('/descuentos')} className="text-sm text-blue-600 font-bold hover:text-blue-700 transition-colors">Ver Detalles</button>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={dashboardData.descuentos_seccion || []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis type="category" dataKey="seccion" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 'bold'}} width={80} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value) => [`Bs ${value}`, 'Total Descontado']} />
                      <Bar dataKey="total" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== ROL: DIRECTOR ===================== */}
        {isDirector && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Fuerza Operativa" value={dashboardData.total_musicos} icon={Users} color="bg-blue-500" trend="Músicos Activos" />
              <StatCard label="Próximos Eventos" value={dashboardData.proximos_eventos?.length || 0} icon={CalendarCheck} color="bg-emerald-500" trend="En Agenda" />
              <StatCard label="Adelantos Pendientes" value={dashboardData.adelantos_pendientes || 0} icon={AlertCircle} color="bg-amber-500" trend="Por Firmar" />
              <StatCard label="Eventos (Este Mes)" value={dashboardData.eventos_mes} icon={Trophy} color="bg-violet-500" />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Agenda Inmediata */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Próximas Presentaciones (Timeline)</h3>
                  <button onClick={() => navigate('/eventos')} className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">Gestionar Agenda</button>
                </div>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {dashboardData.proximos_eventos?.map((evento, i) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow ml-4 md:ml-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-900 text-lg">{evento.titulo}</h4>
                        </div>
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1"><Clock className="w-4 h-4"/> {new Date(evento.fecha_hora_cita).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {(!dashboardData.proximos_eventos || dashboardData.proximos_eventos.length === 0) && <p className="text-slate-500 text-center py-12 relative z-10">Agenda libre. No hay próximos eventos.</p>}
                </div>
              </div>

              {/* Distribución y Accesos */}
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Distribución por Sección</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={dashboardData.secciones_stats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="instrumento">
                          {dashboardData.secciones_stats?.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><AlertCircle className="w-32 h-32" /></div>
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2">Descuentos por Sección</h2>
                    <p className="text-rose-100 mb-6 text-sm">Identifica rápidamente las secciones con más faltas o atrasos acumulados.</p>
                    
                    <div className="space-y-3 mb-6">
                      {dashboardData.descuentos_seccion?.slice(0, 3).map((sec, i) => (
                        <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-xl backdrop-blur-sm">
                          <span className="font-bold text-sm">{sec.seccion}</span>
                          <span className="font-bold">Bs {sec.total}</span>
                        </div>
                      ))}
                      {(!dashboardData.descuentos_seccion || dashboardData.descuentos_seccion.length === 0) && <p className="text-center py-2 text-rose-200">No hay descuentos registrados.</p>}
                    </div>

                    <button onClick={() => navigate('/descuentos')} className="w-full bg-white text-rose-600 px-6 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors shadow-sm text-center">
                      Gestionar Disciplina
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== ROL: SUBDIRECTOR ===================== */}
        {isSubdirector && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Descuentos (Semana)" value={`Bs ${dashboardData.descuentos_semana || 0}`} icon={DollarSign} color="bg-rose-500" trend="Faltas/Atrasos" />
              <StatCard label="Adelantos (Semana)" value={`Bs ${dashboardData.adelantos_semana || 0}`} icon={Wallet} color="bg-amber-500" trend="Caja Chica" />
              <StatCard label="Músicos Activos" value={dashboardData.total_musicos} icon={Users} color="bg-blue-500" />
              <StatCard label="Eventos Activos" value={dashboardData.eventos_mes} icon={CalendarCheck} color="bg-emerald-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Movimientos Recientes */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Últimos Descuentos Registrados</h3>
                    <button onClick={() => navigate('/descuentos')} className="text-sm bg-rose-50 text-rose-600 px-4 py-2 rounded-xl font-bold hover:bg-rose-100 transition-colors">+ Registrar Descuento</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.ultimos_descuentos?.map((desc, i) => (
                      <div key={i} className="flex justify-between items-center p-4 border border-rose-100 rounded-2xl bg-rose-50/30">
                        <div className="flex items-center gap-3">
                          <div className="bg-rose-100 p-2 rounded-lg text-rose-600"><AlertCircle className="w-5 h-5"/></div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">Músico ID: {desc.musico}</p>
                            <p className="text-xs text-slate-500 font-medium truncate max-w-[120px]">{desc.motivo}</p>
                          </div>
                        </div>
                        <span className="font-bold text-rose-600 text-lg">-Bs {desc.monto}</span>
                      </div>
                    ))}
                    {(!dashboardData.ultimos_descuentos || dashboardData.ultimos_descuentos.length === 0) && <p className="text-slate-500 text-sm col-span-2 text-center py-4">No hay descuentos recientes</p>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Últimos Adelantos Gestionados</h3>
                    <button onClick={() => navigate('/adelantos')} className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">+ Registrar Adelanto</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.ultimos_adelantos?.map((adel, i) => (
                      <div key={i} className="flex justify-between items-center p-4 border border-blue-100 rounded-2xl bg-blue-50/30">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5"/></div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">Músico ID: {adel.musico}</p>
                            <p className="text-xs text-slate-500 font-medium truncate max-w-[120px]">{adel.motivo}</p>
                          </div>
                        </div>
                        <span className="font-bold text-blue-600 text-lg">Bs {adel.monto}</span>
                      </div>
                    ))}
                    {(!dashboardData.ultimos_adelantos || dashboardData.ultimos_adelantos.length === 0) && <p className="text-slate-500 text-sm col-span-2 text-center py-4">No hay adelantos recientes</p>}
                  </div>
                </div>
              </div>
              
              {/* Canastón Widget */}
              <div>
                {dashboardData.canaston ? (
                  <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 rounded-3xl text-white shadow-xl shadow-fuchsia-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-500">
                      <Trophy className="w-48 h-48" />
                    </div>
                    <div className="relative z-10">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-md">Activo Ahora</span>
                      <h2 className="text-3xl font-extrabold mt-6 mb-2">Canastón</h2>
                      <p className="text-fuchsia-100 mb-8 font-medium">{dashboardData.canaston.titulo}</p>
                      
                      <div className="space-y-4">
                        <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-md">
                          <p className="text-sm text-fuchsia-200 mb-1">Fecha de Entrega</p>
                          <p className="font-bold">{dashboardData.canaston.fecha_entrega ? new Date(dashboardData.canaston.fecha_entrega).toLocaleDateString() : 'Por Definir'}</p>
                        </div>
                        <button onClick={() => navigate('/canaston')} className="w-full bg-white text-fuchsia-600 px-6 py-4 rounded-2xl font-bold hover:bg-fuchsia-50 transition-colors shadow-lg">
                          Administrar Campaña
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                    <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Canastón Inactivo</h3>
                    <p className="text-slate-500 mb-6">No hay una campaña de canastón abierta actualmente.</p>
                    <button onClick={() => navigate('/canaston')} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors w-full">Abrir Nueva Campaña</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== ROL: JEFE DE SECCION ===================== */}
        {isJefeSeccion && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Control de Asistencia Rápido */}
            {dashboardData.evento_hoy && (
              <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CheckCircle className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <span className="bg-red-500/50 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-md">HOY</span>
                  <h2 className="text-2xl font-bold mt-2">Tomar Asistencia</h2>
                  <p className="text-red-100 font-medium">Evento: {dashboardData.evento_hoy.titulo}</p>
                </div>
                <button
                  onClick={() => navigate(`/asistencia-movil/${dashboardData.evento_hoy.id}`)}
                  className="relative z-10 bg-white text-red-600 hover:bg-red-50 px-8 py-4 rounded-xl font-bold transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <CheckCircle className="w-5 h-5" /> Iniciar Check-in Móvil
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Músicos a Cargo" value={dashboardData.total_musicos} icon={Users} color="bg-blue-500" trend={dashboardData.seccion} />
              <StatCard label="Eventos (Este Mes)" value={dashboardData.total_eventos} icon={CalendarCheck} color="bg-emerald-500" />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Últimos Eventos de la Banda</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.eventos_recientes?.map((evento, idx) => (
                  <div key={idx} className="p-4 border border-slate-100 rounded-2xl bg-slate-50 flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm truncate" title={evento.titulo}>{evento.titulo}</h4>
                      <p className="text-xs text-slate-500 mt-1">{new Date(evento.fecha_hora_cita).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fallback Resto de Roles */}
        {!isPresidente && !isDirector && !isSubdirector && !isJefeSeccion && (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center max-w-2xl mx-auto">
            <Music className="w-24 h-24 text-slate-200 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Bienvenido a tu Panel</h2>
            <p className="text-slate-500 text-lg">Tu rol actual es <span className="font-bold text-slate-700">{dashboardData?.rol}</span>. Utiliza el menú lateral para acceder a las funciones que tienes permitidas.</p>
          </div>
        )}

      </div>
    </div>
  );
}
