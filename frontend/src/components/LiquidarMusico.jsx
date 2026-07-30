import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Search, User, Calendar, DollarSign, CheckCircle, AlertTriangle, FileText, CheckSquare, Square, X } from 'lucide-react';

export default function LiquidarMusico({ musicos, onPlanillaGuardada }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMusico, setSelectedMusico] = useState(null);
  
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [cuenta, setCuenta] = useState(null);
  const [error, setError] = useState(null);
  
  const [selectedEventosIds, setSelectedEventosIds] = useState([]);
  const [eventosData, setEventosData] = useState({});
  
  const [selectedDescuentosIds, setSelectedDescuentosIds] = useState([]);
  const [selectedAdelantosIds, setSelectedAdelantosIds] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtro de músicos
  const filteredMusicos = useMemo(() => {
    return musicos
      .filter(m => m.activo)
      .filter(m => `${m.nombres} ${m.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [musicos, searchTerm]);

  // Cargar estado de cuenta al seleccionar músico
  useEffect(() => {
    if (!selectedMusico) {
      setCuenta(null);
      return;
    }
    
    setLoadingCuenta(true);
    setError(null);
    
    api.get(`/planillas/estado_cuenta_musico/?musico_id=${selectedMusico.id}`)
      .then(res => {
        setCuenta(res.data);
        // Inicializar form state
        const initialData = {};
        const allEventIds = [];
        res.data.eventos_pendientes.forEach(e => {
          initialData[e.id] = {
            acordado: e.monto_acordado.toString(),
            multas: e.multas_sugeridas.toString(),
            adelantos: e.adelantos_sugeridos.toString()
          };
          allEventIds.push(e.id);
        });
        setEventosData(initialData);
        setSelectedEventosIds(allEventIds); // Check all by default
        
        // Check all global discounts/adelantos by default
        setSelectedDescuentosIds(res.data.descuentos_globales.map(d => d.id));
        setSelectedAdelantosIds(res.data.adelantos_globales.map(a => a.id));
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Error al cargar estado de cuenta');
      })
      .finally(() => {
        setLoadingCuenta(false);
      });
  }, [selectedMusico]);

  const handleInputChange = (eventoId, field, value) => {
    setEventosData(prev => ({
      ...prev,
      [eventoId]: {
        ...prev[eventoId],
        [field]: value
      }
    }));
  };

  const toggleEvento = (id) => {
    setSelectedEventosIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const toggleDescuento = (id) => {
    setSelectedDescuentosIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const toggleAdelanto = (id) => {
    setSelectedAdelantosIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  // Cálculos totales
  const totals = useMemo(() => {
    let totalAcordado = 0;
    let totalMultas = 0;
    let totalAdelantos = 0;
    
    selectedEventosIds.forEach(id => {
      const data = eventosData[id];
      if (data) {
        totalAcordado += parseInt(data.acordado || 0);
        totalMultas += parseInt(data.multas || 0);
        totalAdelantos += parseInt(data.adelantos || 0);
      }
    });
    
    if (cuenta) {
      cuenta.descuentos_globales.filter(d => selectedDescuentosIds.includes(d.id)).forEach(d => {
        totalMultas += parseInt(d.monto);
      });
      cuenta.adelantos_globales.filter(a => selectedAdelantosIds.includes(a.id)).forEach(a => {
        totalAdelantos += parseInt(a.monto);
      });
    }
    
    return {
      acordado: totalAcordado,
      multas: totalMultas,
      adelantos: totalAdelantos,
      neto: totalAcordado - totalMultas - totalAdelantos
    };
  }, [selectedEventosIds, eventosData, cuenta, selectedDescuentosIds, selectedAdelantosIds]);

  const handleSubmit = async () => {
    if (selectedEventosIds.length === 0 && selectedDescuentosIds.length === 0 && selectedAdelantosIds.length === 0) {
      return alert("Selecciona al menos un contrato o deuda para procesar.");
    }
    
    if (!window.confirm("¿Confirmar liquidación? Se generará una planilla individual y se registrarán los pagos y descuentos marcados.")) {
      return;
    }
    
    setIsSubmitting(true);
    
    const payload = {
      musico_id: selectedMusico.id,
      eventos: selectedEventosIds.map(id => ({
        evento_id: id,
        acordado: parseInt(eventosData[id].acordado || 0),
        multas: parseInt(eventosData[id].multas || 0),
        adelantos: parseInt(eventosData[id].adelantos || 0)
      })),
      descuentos_ids: selectedDescuentosIds,
      adelantos_ids: selectedAdelantosIds
    };
    
    try {
      await api.post('/planillas/liquidar_musico/', payload);
      alert("¡Liquidación procesada con éxito!");
      // Refrescar cuenta
      const musicoIdCache = selectedMusico.id;
      setSelectedMusico(null);
      setTimeout(() => setSelectedMusico(musicos.find(m => m.id === musicoIdCache)), 100);
      if (onPlanillaGuardada) onPlanillaGuardada();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
      
      {/* Sidebar: Buscador de Músicos */}
      <div className="w-full lg:w-1/3 xl:w-1/4 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Seleccionar Músico
          </h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm font-medium transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {filteredMusicos.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-sm">
              No se encontraron músicos
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMusicos.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMusico(m)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    selectedMusico?.id === m.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    selectedMusico?.id === m.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {m.nombres.charAt(0)}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-bold truncate text-sm">{m.nombres} {m.apellidos}</span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${selectedMusico?.id === m.id ? 'text-blue-200' : 'text-gray-400'}`}>
                      {m.instrumento}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel: Estado de Cuenta */}
      <div className="w-full lg:w-2/3 xl:w-3/4 flex flex-col h-[calc(100vh-14rem)]">
        {!selectedMusico ? (
          <div className="flex-1 bg-white rounded-3xl border border-gray-100 border-dashed flex flex-col items-center justify-center text-gray-400 p-8">
            <User className="w-16 h-16 mb-4 text-gray-200" />
            <p className="text-lg font-bold text-gray-500">Selecciona un músico</p>
            <p className="text-sm">Busca un músico en la lista para ver su estado de cuenta y procesar pagos múltiples.</p>
          </div>
        ) : loadingCuenta ? (
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="flex-1 bg-red-50 rounded-3xl border border-red-100 flex items-center justify-center text-red-600 font-bold p-8 text-center">
            <AlertTriangle className="w-8 h-8 mr-3" />
            {error}
          </div>
        ) : !cuenta ? null : (
          <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            
            {/* Header del Estado de Cuenta */}
            <div className="p-6 bg-slate-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black">{cuenta.musico.nombre}</h2>
                <p className="text-slate-300 font-medium text-sm mt-1">Estado de Cuenta y Contratos Pendientes</p>
              </div>
              
              <div className="bg-slate-700/50 px-5 py-3 rounded-2xl flex items-center gap-4 border border-slate-600">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total a Pagar</p>
                  <p className={`text-2xl font-black ${totals.neto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Bs. {totals.neto.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (selectedEventosIds.length === 0 && selectedDescuentosIds.length === 0 && selectedAdelantosIds.length === 0)}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 px-6 py-3 rounded-xl font-black transition-all shadow-lg flex items-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  {isSubmitting ? 'Procesando...' : 'PAGAR'}
                </button>
              </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              
              {cuenta.eventos_pendientes.length === 0 && cuenta.descuentos_globales.length === 0 && cuenta.adelantos_globales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <CheckCircle className="w-16 h-16 text-green-200 mb-4" />
                  <p className="text-xl font-bold text-gray-600">Al Día</p>
                  <p className="text-sm mt-2">Este músico no tiene contratos pendientes ni deudas.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* Contratos Pendientes */}
                  {cuenta.eventos_pendientes.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Contratos por Cancelar ({cuenta.eventos_pendientes.length})
                      </h3>
                      <div className="space-y-3">
                        {cuenta.eventos_pendientes.map(e => {
                          const isSelected = selectedEventosIds.includes(e.id);
                          const autorizado = e.autorizado_para_pagar;
                          return (
                            <div key={e.id} className={`flex flex-col lg:flex-row gap-4 p-4 rounded-2xl border-2 transition-all ${!autorizado ? 'border-gray-200 bg-gray-50 opacity-70' : isSelected ? 'border-blue-500 bg-blue-50/30 shadow-sm' : 'border-gray-100 bg-white'}`}>
                              <div className={`flex items-center gap-4 flex-1 ${autorizado ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => autorizado && toggleEvento(e.id)}>
                                <button disabled={!autorizado} className={`p-1 rounded-lg transition-colors ${!autorizado ? 'text-gray-300' : isSelected ? 'text-blue-600' : 'text-gray-300'}`}>
                                  {!autorizado ? <div title="No autorizado para pagar" className="p-1 rounded-md bg-gray-200"><AlertTriangle className="w-4 h-4 text-gray-500" /></div> : isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                                </button>
                                <div>
                                  <p className="font-bold text-gray-800 text-base flex items-center gap-2">
                                    {e.titulo}
                                    {!autorizado && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider">No Autorizado</span>}
                                  </p>
                                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1 mt-1">
                                    <Calendar className="w-3 h-3" /> {e.fecha}
                                  </p>
                                </div>
                              </div>
                              
                              <div className={`flex items-center gap-3 ml-10 lg:ml-0 overflow-x-auto pb-2 lg:pb-0 ${!autorizado ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex flex-col">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 mb-1">Acordado</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={eventosData[e.id]?.acordado || ''}
                                    onChange={(ev) => handleInputChange(e.id, 'acordado', ev.target.value)}
                                    disabled={!isSelected || !autorizado}
                                    className={`w-24 px-3 py-2 text-right rounded-xl font-bold border-2 outline-none transition-all ${isSelected ? 'border-green-200 focus:border-green-500 text-green-700 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 mb-1">Multas</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={eventosData[e.id]?.multas || ''}
                                    onChange={(ev) => handleInputChange(e.id, 'multas', ev.target.value)}
                                    disabled={!isSelected || !autorizado}
                                    className={`w-24 px-3 py-2 text-right rounded-xl font-bold border-2 outline-none transition-all ${isSelected ? 'border-red-200 focus:border-red-500 text-red-600 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 mb-1">Adelantos</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={eventosData[e.id]?.adelantos || ''}
                                    onChange={(ev) => handleInputChange(e.id, 'adelantos', ev.target.value)}
                                    disabled={!isSelected || !autorizado}
                                    className={`w-24 px-3 py-2 text-right rounded-xl font-bold border-2 outline-none transition-all ${isSelected ? 'border-orange-200 focus:border-orange-500 text-orange-600 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  
                  {/* Descuentos y Adelantos Globales Pendientes */}
                  {(cuenta.descuentos_globales.length > 0 || cuenta.adelantos_globales.length > 0) && (
                    <section>
                      <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Otras Deudas y Multas Globales
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cuenta.descuentos_globales.map(d => {
                          const isSelected = selectedDescuentosIds.includes(d.id);
                          return (
                            <div key={`d_${d.id}`} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-red-400 bg-red-50/50 shadow-sm' : 'border-gray-200 bg-white opacity-60'}`} onClick={() => toggleDescuento(d.id)}>
                              <button className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-red-500' : 'text-gray-300'}`}>
                                {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                              </button>
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 text-sm">{d.motivo}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{d.fecha}</p>
                              </div>
                              <div className="font-black text-red-600 text-lg">
                                - Bs. {d.monto}
                              </div>
                            </div>
                          )
                        })}
                        
                        {cuenta.adelantos_globales.map(a => {
                          const isSelected = selectedAdelantosIds.includes(a.id);
                          return (
                            <div key={`a_${a.id}`} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-orange-400 bg-orange-50/50 shadow-sm' : 'border-gray-200 bg-white opacity-60'}`} onClick={() => toggleAdelanto(a.id)}>
                              <button className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-orange-500' : 'text-gray-300'}`}>
                                {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                              </button>
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 text-sm">{a.motivo} (Adelanto)</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{a.fecha}</p>
                              </div>
                              <div className="font-black text-orange-600 text-lg">
                                - Bs. {a.monto}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}

                </div>
              )}
            </div>
            
            {/* Footer Summary */}
            {cuenta && (
              <div className="bg-white border-t border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Acordado</p>
                  <p className="text-xl font-black text-gray-800">Bs. {totals.acordado}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Multas</p>
                  <p className="text-xl font-black text-red-500">- Bs. {totals.multas}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Adelantos</p>
                  <p className="text-xl font-black text-orange-500">- Bs. {totals.adelantos}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contratos Seleccionados</p>
                  <p className="text-xl font-black text-blue-600">{selectedEventosIds.length}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
