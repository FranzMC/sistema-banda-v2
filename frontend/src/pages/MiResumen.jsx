import { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Calendar, 
  AlertCircle, 
  FileText, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Clock,
  CheckCircle,
  Clock3,
  TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';

function ResumenCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`p-4 rounded-2xl ${color} text-white shadow-sm`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
        {subtitle && <p className="text-sm font-semibold text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function MiResumen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determinar pestaña activa base a la URL
  const [activeTab, setActiveTab] = useState('resumen');

  useEffect(() => {
    if (location.pathname === '/mis-multas') {
      setActiveTab('descuentos');
    } else if (location.pathname === '/mis-contratos') {
      setActiveTab('contratos');
    } else {
      setActiveTab('resumen');
    }
  }, [location.pathname]);

  const handleTabChange = (tab, path) => {
    setActiveTab(tab);
    navigate(path);
  };

  // Estados para filtros de fecha
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    fetchResumen();
  }, []);

  const fetchResumen = async (start = '', end = '') => {
    try {
      if (start || end) {
        setIsFiltering(true);
      } else {
        setLoading(true);
      }
      
      const params = {};
      if (start) params.fecha_inicio = start;
      if (end) params.fecha_fin = end;

      const res = await api.get('musico/resumen/', { params });
      setData(res.data);
    } catch (error) {
      toast.error('No se pudo cargar el resumen');
      console.error(error);
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const handleFilter = () => {
    fetchResumen(fechaInicio, fechaFin);
  };

  const handleClearFilter = () => {
    setFechaInicio('');
    setFechaFin('');
    fetchResumen('', '');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 mt-6">
      
      {/* HEADER & TABS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mi Estado Financiero</h1>
          <p className="text-slate-500 font-medium text-sm">Gestiona tus ingresos y multas del {currentYear}</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto w-full sm:w-auto">
          <button 
            onClick={() => handleTabChange('resumen', '/mi-resumen')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'resumen' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Resumen
          </button>
          <button 
            onClick={() => handleTabChange('descuentos', '/mis-multas')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'descuentos' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Descuentos
          </button>
          <button 
            onClick={() => handleTabChange('contratos', '/mis-contratos')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'contratos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Contratos
          </button>
        </div>
      </div>

      {/* CONTENIDO PESTAÑA RESUMEN */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          <ResumenCard 
            title={`Total Ganado (${currentYear})`}
            value={`Bs ${data.pagos.total_anual}`}
            icon={DollarSign}
            color="bg-emerald-500"
            subtitle={`${data.pagos.historial.length} pagos recibidos`}
          />
          <ResumenCard 
            title={`Eventos (${currentYear})`}
            value={data.contratos.total_asistidos_anual}
            icon={Calendar}
            color="bg-blue-500"
            subtitle={`${data.contratos.pagados} pagados / ${data.contratos.pendientes} pendientes`}
          />
          <ResumenCard 
            title="Total Descuentos"
            value={`- Bs ${data.descuentos.total_monto}`}
            icon={AlertCircle}
            color="bg-rose-500"
            subtitle={`En ${data.descuentos.contratos_afectados} contratos`}
          />
          <ResumenCard 
            title="Deudas y Adelantos"
            value={`Bs ${parseFloat(data.deudas.total_deudas) + parseFloat(data.deudas.total_adelantos)}`}
            icon={ArrowDownCircle}
            color="bg-amber-500"
            subtitle={`Deuda: ${data.deudas.total_deudas} / Adelantos: ${data.deudas.total_adelantos}`}
          />
        </div>
      )}

      {/* CONTENIDO PESTAÑA DESCUENTOS */}
      {activeTab === 'descuentos' && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-rose-100 p-2 rounded-xl"><TrendingDown className="w-6 h-6 text-rose-600" /></div>
              <h3 className="text-xl font-bold text-slate-800">Historial de Multas y Descuentos</h3>
            </div>
            
            {/* Filtros de Fecha */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <input 
                type="date" 
                value={fechaInicio} 
                onChange={e => setFechaInicio(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
              <span className="text-slate-400 font-medium">a</span>
              <input 
                type="date" 
                value={fechaFin} 
                onChange={e => setFechaFin(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
              <button 
                onClick={handleFilter}
                disabled={isFiltering}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isFiltering ? 'Filtrando...' : 'Filtrar'}
              </button>
              {(fechaInicio || fechaFin) && (
                <button 
                  onClick={handleClearFilter}
                  className="text-slate-500 hover:text-rose-600 text-sm font-bold px-2 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          
          <div className="mb-6 bg-rose-50 p-4 rounded-2xl flex items-center justify-between border border-rose-100">
             <div>
               <p className="text-xs font-bold text-rose-400 uppercase">Periodo: {data.descuentos.periodo}</p>
               <h4 className="text-rose-700 font-bold mt-1">Total Descontado en el periodo</h4>
             </div>
             <span className="text-3xl font-black text-rose-600">Bs {parseFloat(data.descuentos.total_monto).toFixed(2)}</span>
          </div>

          <div className="space-y-4">
            {data.descuentos.historial.length > 0 ? (
              data.descuentos.historial.map((desc) => (
                <div key={desc.id} className="flex justify-between items-center p-5 border border-rose-100 rounded-2xl bg-rose-50/50 hover:bg-rose-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="bg-white p-3 rounded-full shadow-sm border border-rose-100">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{desc.evento}</p>
                        <p className="text-sm font-medium text-rose-600 mt-1">{desc.motivo}</p>
                        <p className="text-xs text-slate-500 mt-1"><Clock className="w-3 h-3 inline mr-1" /> {desc.fecha}</p>
                    </div>
                  </div>
                  <div className="text-right">
                      <span className="text-xl font-black text-rose-600">-Bs {desc.monto}</span>
                      <p className="text-xs font-bold text-slate-400 uppercase mt-1">{desc.estado}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-medium">No tienes descuentos registrados en este periodo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA CONTRATOS */}
      {activeTab === 'contratos' && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 animate-in fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-100 p-2 rounded-xl"><FileText className="w-6 h-6 text-emerald-600" /></div>
            <h3 className="text-xl font-bold text-slate-800">Mis Contratos y Pagos</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.contratos.historial_contratos && data.contratos.historial_contratos.length > 0 ? (
              data.contratos.historial_contratos.map((contrato) => (
                <div key={contrato.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  
                  {/* Status Indicator */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg ${contrato.estado === 'PAGADO' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    {contrato.estado}
                  </div>

                  <h4 className="font-bold text-slate-800 mb-4 pr-16 truncate" title={contrato.evento}>{contrato.evento || "Evento"}</h4>
                  
                  <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm">
                      <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Acordado:</span>
                          <span className="font-bold text-slate-700">Bs. {parseFloat(contrato.monto_acordado).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-rose-400 font-medium">Descuentos:</span>
                          <span className="font-bold text-rose-500">-Bs. {parseFloat(contrato.descuentos || 0).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-amber-500 font-medium">Adelantos:</span>
                          <span className="font-bold text-amber-600">-Bs. {parseFloat(contrato.adelantos || 0).toFixed(0)}</span>
                      </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        {contrato.estado === 'PAGADO' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock3 className="w-4 h-4 text-amber-500" />}
                        {contrato.estado === 'PAGADO' ? 'Liquidado' : 'Pendiente'}
                    </span>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Saldo Neto</p>
                        <span className={`text-xl font-black ${contrato.estado === 'PAGADO' ? 'text-emerald-600' : 'text-slate-800'}`}>Bs. {parseFloat(contrato.saldo).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-medium">No se encontraron contratos registrados.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
