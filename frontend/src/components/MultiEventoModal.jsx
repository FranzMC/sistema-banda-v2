import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Plus, Calendar, Users, AlertCircle, Search, ChevronDown, ChevronUp, UserMinus, CheckSquare, Square, Music } from 'lucide-react';
import api from '../services/api';

// ─── Constantes ───────────────────────────────────────────────────────────────

const UNIFORMES = [
  { value: 'GALA', label: 'Gala' },
  { value: 'DIARIO', label: 'Diario' },
  { value: 'VIAJE', label: 'Viaje' },
  { value: 'VELADA', label: 'Velada' },
  { value: 'DIANA', label: 'Diana' },
  { value: 'RECOJO', label: 'Recojo' },
  { value: 'OTRO', label: 'Otro' },
];

const EVENT_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', badge: 'bg-blue-500 text-white', ring: 'ring-blue-400', dot: '#3b82f6' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white', ring: 'ring-emerald-400', dot: '#10b981' },
  { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-700', badge: 'bg-violet-500 text-white', ring: 'ring-violet-400', dot: '#8b5cf6' },
  { bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', badge: 'bg-orange-500 text-white', ring: 'ring-orange-400', dot: '#f97316' },
  { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-700', badge: 'bg-rose-500 text-white', ring: 'ring-rose-400', dot: '#f43f5e' },
];

// Orden oficial
const SECTION_ORDER = ['TROMPETA', 'CLARINETE_SAXO', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS'];

const SECTION_LABELS = {
  TROMPETA: 'TROMPETAS',
  CLARINETE_SAXO: 'CLARINETES Y SAXOS',
  BARITONO: 'BARÍTONO',
  TROMBON: 'TROMBÓN',
  TUBA: 'TUBAS',
  BOMBO: 'BOMBOS',
  TAMBOR: 'TAMBORES',
  PLATILLOS: 'PLATILLOS',
};

const getSectionGroup = (instrumento) => {
  if (!instrumento) return 'OTROS';
  const u = instrumento.toUpperCase();
  if (u === 'CLARINETE' || u === 'SAXOFON' || u === 'SAXO') return 'CLARINETE_SAXO';
  if (['TROMPETA', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS'].includes(u)) return u;
  return 'OTROS';
};

// ─── Sub-modal: Selector de Músicos ──────────────────────────────────────────

function MusicoPicker({
  isOpen, onClose,
  musicos, loading,
  activeEvento, activeColor, activeIdx,
  eventos,
  assignedInActive, assignedElsewhere,
  onToggle, onDesconvocar,
  desconvocandoId,
}) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('ALL');

  // Grupos con orden correcto
  const secciones = useMemo(() => {
    const g = {};
    musicos.forEach(m => {
      const grp = getSectionGroup(m.instrumento);
      if (!g[grp]) g[grp] = [];
      g[grp].push(m);
    });
    return g;
  }, [musicos]);

  const seccionesOrdenadas = useMemo(() => {
    const have = SECTION_ORDER.filter(s => secciones[s]?.length > 0);
    Object.keys(secciones).forEach(s => { if (!SECTION_ORDER.includes(s)) have.push(s); });
    return have;
  }, [secciones]);

  const filtered = useMemo(() => {
    return musicos.filter(m => {
      const grp = getSectionGroup(m.instrumento);
      const matchSec = section === 'ALL' || grp === section;
      const matchQ = !search || `${m.nombres} ${m.apellidos}`.toLowerCase().includes(search.toLowerCase());
      return matchSec && matchQ;
    });
  }, [musicos, section, search]);

  const filteredGrupos = useMemo(() => {
    const g = {};
    filtered.forEach(m => {
      const grp = getSectionGroup(m.instrumento);
      if (!g[grp]) g[grp] = [];
      g[grp].push(m);
    });
    return g;
  }, [filtered]);

  const filteredOrdenados = useMemo(() => {
    const have = SECTION_ORDER.filter(s => filteredGrupos[s]?.length > 0);
    Object.keys(filteredGrupos).forEach(s => { if (!SECTION_ORDER.includes(s)) have.push(s); });
    return have;
  }, [filteredGrupos]);

  // Seleccionar todos los filtrados disponibles (no ocupados ni en otro evento)
  const selectableFiltered = filtered.filter(m => !m.ocupado_en_fecha && !assignedElsewhere.has(m.id));
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every(m => assignedInActive.has(m.id));

  const handleSelectAll = () => {
    selectableFiltered.forEach(m => {
      if (!assignedInActive.has(m.id)) onToggle(m.id);
    });
  };
  const handleDeselectAll = () => {
    selectableFiltered.forEach(m => {
      if (assignedInActive.has(m.id)) onToggle(m.id);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="flex-1 flex flex-col bg-white rounded-t-3xl mt-16 overflow-hidden shadow-2xl">

        {/* Header del picker */}
        <div className={`flex-none px-6 py-5 border-b border-slate-100 ${activeColor.light}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${activeColor.bg} flex items-center justify-center text-white font-black text-lg`}>
                {activeIdx + 1}
              </div>
              <div>
                <h2 className={`text-xl font-black ${activeColor.text}`}>
                  Asignando músicos → {activeEvento?.titulo || `Evento ${activeIdx + 1}`}
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  {assignedInActive.size} seleccionados • {musicos.filter(m => !m.ocupado_en_fecha && !assignedElsewhere.has(m.id)).length} disponibles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Botón seleccionar todos / deseleccionar todos */}
              {!allFilteredSelected ? (
                <button
                  onClick={handleSelectAll}
                  disabled={selectableFiltered.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-40"
                >
                  <CheckSquare className="w-4 h-4" />
                  Seleccionar Todos ({selectableFiltered.filter(m => !assignedInActive.has(m.id)).length})
                </button>
              ) : (
                <button
                  onClick={handleDeselectAll}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm transition-all"
                >
                  <Square className="w-4 h-4" />
                  Deseleccionar Todos
                </button>
              )}
              <button
                onClick={onClose}
                className={`px-5 py-2.5 ${activeColor.bg} text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-md`}
              >
                ✓ Listo ({assignedInActive.size})
              </button>
            </div>
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 mt-4 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar músico por nombre..."
              className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder-slate-400"
              autoFocus
            />
            {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>}
          </div>

          {/* Filtros por sección */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSection('ALL')}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${section === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              Todos ({musicos.length})
            </button>
            {seccionesOrdenadas.map(grp => (
              <button
                key={grp}
                onClick={() => setSection(grp)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${section === grp ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {SECTION_LABELS[grp] || grp} ({secciones[grp]?.length || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Lista de músicos – con scroll propio e independiente */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="font-medium">Cargando músicos...</p>
            </div>
          ) : (
            filteredOrdenados.map(grp => (
              <div key={grp} className="mb-6">
                {/* Encabezado de sección */}
                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white/95 py-2 z-10">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{SECTION_LABELS[grp] || grp}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {filteredGrupos[grp].filter(m => assignedInActive.has(m.id)).length}/{filteredGrupos[grp].length}
                  </span>
                </div>

                {/* Grid 3 columnas en pantalla grande */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredGrupos[grp].map(m => {
                    const isBusy = m.ocupado_en_fecha;
                    const isElsewhere = assignedElsewhere.has(m.id);
                    const isSelected = assignedInActive.has(m.id);
                    const isBlocked = isBusy;
                    const isDesconvocando = desconvocandoId === m.id;

                    return (
                      <div
                        key={m.id}
                        className={`rounded-2xl border-2 transition-all duration-150 overflow-hidden
                          ${isSelected ? `${activeColor.light} ${activeColor.border} shadow-md` :
                            isBlocked ? 'bg-red-50 border-red-100' :
                            isElsewhere ? 'bg-amber-50 border-amber-200' :
                            'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                          }
                        `}
                      >
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer"
                          onClick={() => !isBlocked && !isElsewhere && onToggle(m.id)}
                          style={{ cursor: isBlocked || isElsewhere ? 'default' : 'pointer' }}
                        >
                          {/* Avatar / check */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm
                            ${isSelected ? `${activeColor.bg} text-white shadow-md` :
                              isBlocked ? 'bg-red-200 text-red-500' :
                              isElsewhere ? 'bg-amber-200 text-amber-600' :
                              'bg-slate-100 text-slate-500'
                            }
                          `}>
                            {isSelected ? '✓' : isBlocked ? '✕' : (m.nombres?.[0]?.toUpperCase() || '?')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm leading-tight ${isSelected ? activeColor.text : isBlocked ? 'text-red-400 line-through' : isElsewhere ? 'text-amber-700' : 'text-slate-800'}`}>
                              {m.nombres} {m.apellidos}
                            </p>
                            {isSelected && <p className={`text-xs font-semibold mt-0.5 ${activeColor.text}`}>✓ Seleccionado</p>}
                            {isElsewhere && !isBusy && (
                              <p className="text-xs text-amber-600 font-semibold mt-0.5">
                                → {eventos.find(e => e.convocados.includes(m.id))?.titulo || 'Otro evento'}
                              </p>
                            )}
                            {isBusy && (
                              <p className="text-xs text-red-500 font-semibold mt-0.5 truncate">
                                ⊘ {m.evento_ocupado_titulo || 'otro contrato'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botón desconvocar para músicos ocupados en contrato DB */}
                        {isBusy && m.evento_ocupado_id && (
                          <button
                            onClick={() => onDesconvocar(m)}
                            disabled={isDesconvocando}
                            className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-red-100 hover:bg-red-200 text-red-600 border-t border-red-100 px-3 py-2 transition-all disabled:opacity-50"
                          >
                            {isDesconvocando ? (
                              <><div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Quitando...</>
                            ) : (
                              <><UserMinus className="w-3 h-3" />Quitar de "{m.evento_ocupado_titulo}"</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          {!loading && filteredOrdenados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Music className="w-12 h-12 mb-3 stroke-1" />
              <p className="font-medium">No se encontraron músicos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Componente Principal ─────────────────────────────────────────────────────

export default function MultiEventoModal({ isOpen, onClose, onSaveSuccess, userRol }) {
  const [fecha, setFecha] = useState('');
  const [activeEventoId, setActiveEventoId] = useState('ev-1');
  const [eventos, setEventos] = useState([
    { id: 'ev-1', titulo: '', uniforme: 'GALA', hora: '08:00', detalles_uniforme: '', lugar_concentracion: '', uniforme_personalizado: '', convocados: [] }
  ]);
  const [musicos, setMusicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [desconvocandoId, setDesconvocandoId] = useState(null);

  useEffect(() => {
    if (fecha && isOpen) fetchMusicos();
    else setMusicos([]);
  }, [fecha, isOpen]);

  const fetchMusicos = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/musicos/?disponible_en_fecha=${fecha}`);
      setMusicos(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAddEvento = () => {
    const newId = `ev-${Date.now()}`;
    setEventos([...eventos, { id: newId, titulo: '', uniforme: 'GALA', hora: '08:00', detalles_uniforme: '', lugar_concentracion: '', uniforme_personalizado: '', convocados: [] }]);
    setActiveEventoId(newId);
  };

  const handleRemoveEvento = (id) => {
    if (eventos.length === 1) return;
    const rest = eventos.filter(e => e.id !== id);
    setEventos(rest);
    if (activeEventoId === id) setActiveEventoId(rest[0].id);
  };

  const handleEventoChange = (id, field, value) => {
    setEventos(eventos.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const toggleMusico = useCallback((musicoId) => {
    setEventos(prev => prev.map(ev => {
      if (ev.id !== activeEventoId) return ev;
      const isIn = ev.convocados.includes(musicoId);
      return { ...ev, convocados: isIn ? ev.convocados.filter(id => id !== musicoId) : [...ev.convocados, musicoId] };
    }));
  }, [activeEventoId]);

  const removeMusico = (musicoId, eventoId) => {
    setEventos(eventos.map(e => e.id === eventoId ? { ...e, convocados: e.convocados.filter(id => id !== musicoId) } : e));
  };

  const handleDesconvocar = async (musico) => {
    if (!musico.evento_ocupado_id) return;
    if (!window.confirm(`¿Quitar a ${musico.nombres} ${musico.apellidos} del evento "${musico.evento_ocupado_titulo}"?`)) return;
    try {
      setDesconvocandoId(musico.id);
      await api.post(`/eventos/${musico.evento_ocupado_id}/desconvocar_musico/`, { musico_id: musico.id });
      await fetchMusicos();
    } catch (e) {
      alert('Error al desconvocar: ' + (e.response?.data?.error || 'Intenta de nuevo'));
    } finally { setDesconvocandoId(null); }
  };

  const handleSave = async () => {
    if (!fecha) { alert('Seleccione una fecha primero'); return; }
    const payload = eventos.map(({ id, hora, ...rest }) => ({
      ...rest,
      titulo: rest.titulo.trim() || 'Sin título',
      uniforme_personalizado: rest.uniforme_personalizado?.trim() || '',
      fecha_hora_cita: hora ? `${fecha}T${hora}` : `${fecha}T08:00`,
    }));
    try {
      await api.post('/eventos/bulk_create/', payload);
      onSaveSuccess();
      onClose();
    } catch (error) {
      alert('Error al guardar: ' + JSON.stringify(error.response?.data || 'Revisa los datos'));
    }
  };

  if (!isOpen) return null;

  const activeEvento = eventos.find(e => e.id === activeEventoId) || eventos[0];
  const activeIdx = eventos.findIndex(e => e.id === activeEventoId);
  const activeColor = EVENT_COLORS[activeIdx % EVENT_COLORS.length];

  const assignedElsewhere = new Set(eventos.filter(e => e.id !== activeEventoId).flatMap(e => e.convocados));
  const assignedInActive = new Set(activeEvento?.convocados || []);

  const totalConvocados = eventos.reduce((s, e) => s + e.convocados.length, 0);
  const getMusicoById = (id) => musicos.find(m => m.id === id);

  return (
    <>
      {/* ── MODAL PRINCIPAL ── */}
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* HEADER */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Creación de Múltiples Contratos</h1>
              <p className="text-sm text-slate-500">{totalConvocados > 0 ? `${totalConvocados} músicos asignados · ${eventos.length} evento(s)` : 'Configura los eventos y asigna músicos'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors text-sm">Cancelar</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-sm">✓ Guardar Todo</button>
          </div>
        </div>

        {/* PANEL DE CONFIGURACIÓN */}
        <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
          {/* Fecha + Tabs de eventos */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha</div>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="text-sm font-bold text-slate-800 bg-transparent outline-none cursor-pointer" />
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {eventos.map((ev, idx) => {
                const color = EVENT_COLORS[idx % EVENT_COLORS.length];
                const isActive = ev.id === activeEventoId;
                return (
                  <button key={ev.id} onClick={() => setActiveEventoId(ev.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-bold text-sm ${isActive ? `${color.light} ${color.border} ${color.text}` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-white ${color.bg}`}>{idx + 1}</span>
                    <span className="max-w-[130px] truncate">{ev.titulo || `Evento ${idx + 1}`}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive ? color.badge : 'bg-slate-100 text-slate-500'}`}>{ev.convocados.length}</span>
                    {isActive && eventos.length > 1 && (
                      <span onClick={e => { e.stopPropagation(); handleRemoveEvento(ev.id); }} className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
              <button onClick={handleAddEvento} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all font-bold text-sm">
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
            <button onClick={() => setConfigExpanded(!configExpanded)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 font-semibold ml-auto">
              {configExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {configExpanded ? 'Ocultar' : 'Configurar'}
            </button>
          </div>

          {/* Formulario del evento activo */}
          {configExpanded && activeEvento && (
            <div className={`mt-4 p-4 rounded-2xl border-2 ${activeColor.border} ${activeColor.light}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full ${activeColor.bg} flex items-center justify-center text-white text-xs font-black`}>{activeIdx + 1}</div>
                <span className={`font-black text-sm ${activeColor.text}`}>Configurando Evento {activeIdx + 1}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nombre del Evento *</label>
                  <input type="text" value={activeEvento.titulo} onChange={e => handleEventoChange(activeEvento.id, 'titulo', e.target.value)} placeholder="Ej: Diana, Procesión, Gala..." className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Hora</label>
                  <input type="time" value={activeEvento.hora || '08:00'} onChange={e => handleEventoChange(activeEvento.id, 'hora', e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Uniforme</label>
                  <select value={activeEvento.uniforme} onChange={e => handleEventoChange(activeEvento.id, 'uniforme', e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400 transition-all">
                    {UNIFORMES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Especifique el Uniforme</label>
                  <input type="text" value={activeEvento.uniforme_personalizado || ''} onChange={e => handleEventoChange(activeEvento.id, 'uniforme_personalizado', e.target.value)} placeholder="Ej: Pantalón negro, camisa blanca..." className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Lugar de Concentración</label>
                  <input type="text" value={activeEvento.lugar_concentracion} onChange={e => handleEventoChange(activeEvento.id, 'lugar_concentracion', e.target.value)} placeholder="Ej: Plaza Principal, Iglesia..." className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
                </div>
              </div>
            </div>
          )}
          {!fecha && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700">Selecciona una fecha para ver los músicos disponibles.</span>
            </div>
          )}
        </div>

        {/* CUERPO: RESUMEN DE EVENTOS */}
        {fecha ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Botón principal para abrir el picker */}
              <div className={`rounded-2xl border-2 border-dashed ${activeColor.border} ${activeColor.light} p-6 text-center`}>
                <div className={`w-14 h-14 rounded-2xl ${activeColor.bg} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-lg font-black mb-1 ${activeColor.text}`}>
                  Asignar músicos al Evento {activeIdx + 1}: {activeEvento?.titulo || '(sin nombre)'}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  {assignedInActive.size > 0 ? `${assignedInActive.size} músico(s) seleccionados` : 'Ningún músico seleccionado aún'}
                </p>
                <button
                  onClick={() => setShowPicker(true)}
                  className={`inline-flex items-center gap-2 px-8 py-3 ${activeColor.bg} text-white rounded-2xl font-black text-base shadow-lg hover:opacity-90 transition-all`}
                >
                  <Users className="w-5 h-5" />
                  {assignedInActive.size > 0 ? `Ver/Editar Selección (${assignedInActive.size})` : 'Seleccionar Músicos'}
                </button>
              </div>

              {/* Resumen de todos los eventos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventos.map((ev, idx) => {
                  const color = EVENT_COLORS[idx % EVENT_COLORS.length];
                  const isActive = ev.id === activeEventoId;
                  return (
                    <div key={ev.id} className={`rounded-2xl border-2 overflow-hidden transition-all ${isActive ? `${color.border} shadow-md` : 'border-slate-200'}`}>
                      <div
                        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${isActive ? color.light : 'bg-white'}`}
                        onClick={() => setActiveEventoId(ev.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center text-white font-black text-sm`}>{idx + 1}</div>
                          <div>
                            <p className={`font-black text-sm ${isActive ? color.text : 'text-slate-700'}`}>{ev.titulo || `Evento ${idx + 1}`}</p>
                            {ev.lugar_concentracion && <p className="text-xs text-slate-400">{ev.lugar_concentracion}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black px-2.5 py-1 rounded-full ${color.badge}`}>{ev.convocados.length}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setActiveEventoId(ev.id); setShowPicker(true); }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition-all ${isActive ? `${color.light} ${color.border} ${color.text}` : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                            {ev.convocados.length > 0 ? 'Editar' : '+ Asignar'}
                          </button>
                        </div>
                      </div>
                      {ev.convocados.length > 0 && (() => {
                        // Agrupar convocados por sección en el orden oficial
                        const porSeccion = {};
                        ev.convocados.forEach(mid => {
                          const m = getMusicoById(mid);
                          if (!m) return;
                          const grp = getSectionGroup(m.instrumento);
                          if (!porSeccion[grp]) porSeccion[grp] = [];
                          porSeccion[grp].push(m);
                        });
                        const secOrdenadas = [
                          ...SECTION_ORDER.filter(s => porSeccion[s]?.length > 0),
                          ...Object.keys(porSeccion).filter(s => !SECTION_ORDER.includes(s) && porSeccion[s]?.length > 0)
                        ];
                        let numero = 0;
                        return (
                          <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-3">
                            {secOrdenadas.map(grp => (
                              <div key={grp}>
                                {/* Encabezado de sección */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${color.light} ${color.text}`}>
                                    {SECTION_LABELS[grp] || grp}
                                  </span>
                                  <div className="flex-1 h-px bg-slate-100" />
                                  <span className="text-[10px] font-bold text-slate-400">{porSeccion[grp].length}</span>
                                </div>
                                {/* Músicos de esta sección, numerados */}
                                <div className="flex flex-col gap-1">
                                  {porSeccion[grp].map(m => {
                                    numero += 1;
                                    return (
                                      <span key={m.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold ${color.light} ${color.text} border ${color.border}`}>
                                        <span className={`w-5 h-5 rounded-full ${color.bg} text-white flex items-center justify-center text-[9px] font-black flex-shrink-0`}>
                                          {numero}
                                        </span>
                                        <span className="flex-1">{m.nombres} {m.apellidos}</span>
                                        <button
                                          onClick={() => removeMusico(m.id, ev.id)}
                                          className="w-4 h-4 rounded-full hover:bg-red-200 hover:text-red-600 flex items-center justify-center transition-colors flex-shrink-0"
                                          title="Quitar"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Calendar className="w-16 h-16 mb-4 stroke-1" />
            <h3 className="text-lg font-black text-slate-600 mb-1">Selecciona una fecha para comenzar</h3>
            <p className="text-sm font-medium">Se cargarán los músicos disponibles para esa fecha.</p>
          </div>
        )}
      </div>

      {/* ── MODAL PICKER DE MÚSICOS ── */}
      <MusicoPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        musicos={musicos}
        loading={loading}
        activeEvento={activeEvento}
        activeColor={activeColor}
        activeIdx={activeIdx}
        eventos={eventos}
        assignedInActive={assignedInActive}
        assignedElsewhere={assignedElsewhere}
        onToggle={toggleMusico}
        onDesconvocar={handleDesconvocar}
        desconvocandoId={desconvocandoId}
      />
    </>
  );
}