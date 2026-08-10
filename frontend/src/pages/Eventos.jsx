import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  CalendarDays, Plus, X, Edit2, Trash2, MessageCircle, MapPin, 
  Clock, Users, Search, ChevronRight, ChevronLeft, Calendar, 
  AlertCircle, CheckSquare, Square, Eye 
} from 'lucide-react';
import MultiEventoModal from '../components/MultiEventoModal';

const initialFormState = {
  id: null,
  titulo: '',
  uniforme: 'DIARIO',
  detalles_uniforme: '',
  lugar_concentracion: '',
  fecha_hora_cita: '',
  uniforme_personalizado: '',
  convocados: []
};

const UNIFORMES = [
  { value: 'GALA', label: 'Uniforme de Gala' },
  { value: 'DIARIO', label: 'Uniforme de Diana' },
  { value: 'OTRO', label: 'Otro (especificar)' }
];

export default function Eventos() {
  const [eventos, setEventos] = useState([]);
  const [musicos, setMusicos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [eventoToDelete, setEventoToDelete] = useState(null);
  const [viewingEvento, setViewingEvento] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  
  // Nuevos estados para UI amigable
  const [searchTerm, setSearchTerm] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const [musicoSearchTerm, setMusicoSearchTerm] = useState('');

  useEffect(() => {
    fetchEventos();
    fetchUsuarios();
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUserRol(parsedUser.rol);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen && formData.fecha_hora_cita) {
      fetchMusicos();
    } else if (!isModalOpen) {
      // Clear or fetch all when modal closes
      fetchMusicos();
    }
  }, [formData.fecha_hora_cita, isModalOpen, formData.id]);

  const fetchUsuarios = () => {
    api.get('/usuarios/')
      .then(res => setUsuarios(res.data))
      .catch(console.error);
  };

  const fetchEventos = () => {
    api.get('/eventos/')
      .then(response => setEventos(response.data))
      .catch(error => console.error("Error al obtener eventos:", error));
  };

  const fetchMusicos = () => {
    let url = '/musicos/';
    if (isModalOpen && formData.fecha_hora_cita) {
      const dateOnly = formData.fecha_hora_cita.split('T')[0];
      url += `?disponible_en_fecha=${dateOnly}`;
      if (formData.id) {
        url += `&excluir_evento_id=${formData.id}`;
      }
    }
    
    api.get(url)
      .then(response => setMusicos(response.data))
      .catch(error => console.error("Error al obtener músicos:", error));
  };

  const handleChange = (e) => {
    let { name, value, type } = e.target;
    if (type === 'text') {
      value = value.toUpperCase();
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleConvocadosChange = (musicoId) => {
    if (viewingEvento) return;
    const newConvocados = formData.convocados.includes(musicoId)
      ? formData.convocados.filter(id => id !== musicoId)
      : [...formData.convocados, musicoId];
    setFormData({ ...formData, convocados: newConvocados });
  };



  const handleSectionSelectAll = (sectionMusicos, isSelected) => {
    if (viewingEvento) return;
    const sectionIds = sectionMusicos.map(m => m.id);
    let newConvocados = [...formData.convocados];
    
    if (isSelected) {
      newConvocados = newConvocados.filter(id => !sectionIds.includes(id));
    } else {
      const idsToAdd = sectionIds.filter(id => !newConvocados.includes(id));
      newConvocados = [...newConvocados, ...idsToAdd];
    }
    
    setFormData({ ...formData, convocados: newConvocados });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...formData };
      if (dataToSubmit.uniforme !== 'OTRO' && !dataToSubmit.uniforme_personalizado) {
        dataToSubmit.uniforme_personalizado = '';
      }
      
      if (formData.id) {
        await api.put(`/eventos/${formData.id}/`, dataToSubmit);
      } else {
        await api.post('/eventos/', dataToSubmit);
      }
      setIsModalOpen(false);
      fetchEventos();
      setFormData(initialFormState);
    } catch (error) {
      alert("Error al guardar: " + JSON.stringify(error.response?.data || "Revisa los datos"));
    }
  };

  const handleEdit = (evento) => {
    setFormData({
      id: evento.id,
      titulo: evento.titulo || '',
      uniforme: evento.uniforme || 'DIARIO',
      detalles_uniforme: evento.detalles_uniforme || '',
      lugar_concentracion: evento.lugar_concentracion || '',
      fecha_hora_cita: evento.fecha_hora_cita ? evento.fecha_hora_cita.slice(0, 16) : '',
      uniforme_personalizado: evento.uniforme_personalizado || '',
      convocados: evento.convocados || []
    });
    setViewingEvento(null);
    setModalStep(1);
    setMusicoSearchTerm('');
    setIsModalOpen(true);
  };

  const handleView = (evento) => {
    setFormData({
      id: evento.id,
      titulo: evento.titulo || '',
      uniforme: evento.uniforme || 'DIARIO',
      detalles_uniforme: evento.detalles_uniforme || '',
      lugar_concentracion: evento.lugar_concentracion || '',
      fecha_hora_cita: evento.fecha_hora_cita ? evento.fecha_hora_cita.slice(0, 16) : '',
      uniforme_personalizado: evento.uniforme_personalizado || '',
      convocados: evento.convocados || []
    });
    setViewingEvento(evento);
    setModalStep(1);
    setMusicoSearchTerm('');
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setIsMultiModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventoToDelete) return;
    try {
      await api.delete(`/eventos/${eventoToDelete.id}/`);
      fetchEventos();
      setEventoToDelete(null);
    } catch (error) {
      alert("Error al eliminar: " + JSON.stringify(error.response?.data || error.message));
      setEventoToDelete(null);
    }
  };

  const handleWhatsApp = async (evento) => {
    try {
      const response = await api.get(`/eventos/${evento.id}/generar_mensaje/`);
      const mensaje = response.data.mensaje;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      alert("Error al generar mensaje: " + JSON.stringify(error.response?.data || error.message));
    }
  };

  // Filtrado de eventos en la vista principal
  const eventosFiltrados = useMemo(() => {
    return eventos.filter(e => 
      e.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.lugar_concentracion?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [eventos, searchTerm]);

  // Agrupar músicos por secciones
  const secciones = useMemo(() => {
    return [
      { id: 'trompetas', nombre: 'Trompetas', instrumentos: ['TROMPETA'] },
      { id: 'saxos', nombre: 'Saxos', instrumentos: ['SAXOFON'] },
      { id: 'clarinetes', nombre: 'Clarinetes', instrumentos: ['CLARINETE'] },
      { id: 'baritonos', nombre: 'Barítonos', instrumentos: ['BARITONO'] },
      { id: 'trombones', nombre: 'Trombones', instrumentos: ['TROMBON'] },
      { id: 'tubas', nombre: 'Tubas', instrumentos: ['TUBA'] },
      { id: 'percusion', nombre: 'Percusión', instrumentos: ['BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'] },
    ];
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row flex-wrap justify-between gap-3 items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
              <CalendarDays className="w-8 h-8" />
            </div>
            Relación Nominal y Contratos
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Administra las listas de músicos convocados para cada evento fácilmente.</p>
        </div>
        {!['JEFE_SECCION', 'MUSICO'].includes(userRol) && (
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus className="w-6 h-6" />
            Nuevo Evento
          </button>
        )}
      </header>

      {/* Buscador Superior */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 mb-8 flex items-center max-w-xl">
        <Search className="w-6 h-6 text-gray-400 ml-4 mr-3" />
        <input 
          type="text"
          placeholder="Buscar un evento por título o lugar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 text-lg px-2 py-3 outline-none"
        />
      </div>

      {/* Estado Vacío */}
      {eventosFiltrados.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-24 h-24 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No se encontraron eventos</h3>
          <p className="text-gray-500 text-lg mb-8 max-w-md mx-auto">
            {searchTerm ? "Intenta buscar con otras palabras." : "Aún no has creado ningún evento. Comienza creando tu primera relación nominal."}
          </p>
          {!searchTerm && !['JEFE_SECCION', 'MUSICO'].includes(userRol) && (
            <button onClick={openCreateModal} className="text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 px-6 py-3 rounded-xl transition-colors">
              Crear mi primer evento
            </button>
          )}
        </div>
      )}

      {/* Lista de Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {eventosFiltrados.map(evento => (
          <div key={evento.id} className="bg-white rounded-3xl shadow-[0_2px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden flex flex-col hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300">
            <div className="p-6 flex-1">
              <h3 className="text-2xl font-black text-gray-900 mb-4 line-clamp-2 leading-tight">{evento.titulo}</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 mt-1">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-0.5">Fecha y Hora</p>
                    <p className="text-gray-800 font-semibold text-lg">{new Date(evento.fecha_hora_cita).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500 mt-1">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-0.5">Concentración</p>
                    <p className="text-gray-800 font-semibold text-lg">{evento.lugar_concentracion || 'No especificada'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600 mt-1">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-0.5">Convocatoria</p>
                    <p className="text-gray-800 font-semibold text-lg">{evento.convocados?.length || 0} músicos seleccionados</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50/80 backdrop-blur border-t border-gray-100 p-4 px-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => handleView(evento)} className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors" title="Ver Detalles">
                  <Eye className="w-5 h-5" />
                </button>
                {userRol && ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRol) && (
                  <>
                    <button onClick={() => handleEdit(evento)} className="p-3 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors" title="Editar Evento">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => setEventoToDelete(evento)} className="p-3 text-red-500 hover:bg-red-100 rounded-xl transition-colors" title="Eliminar Evento">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {userRol && ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR'].includes(userRol) && (
                <button 
                  onClick={() => handleWhatsApp(evento)}
                  className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white px-5 py-3 rounded-xl font-bold transition-colors shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Rediseñado (Wizard y Modo Lectura) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Fondo oscuro desenfocado */}
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95 duration-200">
            
            {/* Header del Modal */}
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-2xl font-black text-gray-800">
                {viewingEvento ? 'Resumen del Evento' : (formData.id ? 'Editar Evento' : 'Crear Nuevo Evento')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 p-2.5 rounded-full text-gray-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {viewingEvento ? (
              // --- MODO LECTURA RESUMIDO ---
              <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 space-y-8">
                {/* Cabecera del Resumen */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="w-8 h-8" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2">{formData.titulo}</h3>
                  <div className="flex flex-wrap justify-center gap-6 mt-6">
                    <div className="flex items-center gap-2 text-gray-700 font-medium bg-gray-50 px-4 py-2 rounded-xl">
                      <Clock className="w-5 h-5 text-blue-500" />
                      {new Date(formData.fecha_hora_cita).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 font-medium bg-gray-50 px-4 py-2 rounded-xl">
                      <MapPin className="w-5 h-5 text-amber-500" />
                      {formData.lugar_concentracion || 'Lugar no especificado'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 font-medium bg-gray-50 px-4 py-2 rounded-xl">
                      <Users className="w-5 h-5 text-purple-500" />
                      {formData.convocados.length} Músicos Convocados
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-center gap-6 text-left">
                    <div className="bg-blue-50/50 px-6 py-4 rounded-2xl flex-1 max-w-sm">
                      <span className="block text-xs font-bold text-blue-400 uppercase mb-1">Uniforme Requerido</span>
                      <span className="font-bold text-gray-800">{UNIFORMES.find(u => u.value === formData.uniforme)?.label || formData.uniforme}</span>
                    </div>
                    {formData.detalles_uniforme && (
                      <div className="bg-amber-50/50 px-6 py-4 rounded-2xl flex-1 max-w-sm">
                        <span className="block text-xs font-bold text-amber-500 uppercase mb-1">Detalles Adicionales</span>
                        <span className="font-bold text-gray-800">{formData.detalles_uniforme}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de Convocados Agrupados */}
                <div>
                  <h4 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                    <Users className="w-7 h-7 text-blue-600" />
                    Lista de Músicos Asignados
                  </h4>
                  
                  {formData.convocados.length === 0 ? (
                    <div className="text-center p-8 bg-white rounded-3xl border border-gray-100">
                      <p className="text-gray-500 text-lg">No hay músicos asignados a este evento.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {secciones.map(seccion => {
                        let musicosEnSeccion = musicos.filter(m => 
                          seccion.instrumentos.includes(m.instrumento) && 
                          formData.convocados.includes(m.id)
                        );
                        
                        if (musicosEnSeccion.length === 0) return null;

                        // Ordenar percusión: Bombos, Platillos, Tambores
                        if (seccion.id === 'percusion') {
                          const ordenPercusion = { 'BOMBO': 1, 'PLATILLOS': 2, 'TAMBOR': 3, 'PERCUSION': 4 };
                          musicosEnSeccion.sort((a, b) => {
                            const ordenA = ordenPercusion[a.instrumento] || 99;
                            const ordenB = ordenPercusion[b.instrumento] || 99;
                            return ordenA - ordenB;
                          });
                        }
                        
                        return (
                          <div key={seccion.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-4">
                              <span className="font-black text-gray-800 text-lg uppercase tracking-wide">{seccion.nombre}</span>
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{musicosEnSeccion.length}</span>
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                              {musicosEnSeccion.map(musico => (
                                <div key={musico.id} className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-100 shadow-sm rounded-full hover:border-blue-300 hover:bg-blue-50 transition-colors min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                                    {musico.nombres.charAt(0)}
                                  </div>
                                  <span className="font-bold text-gray-700 text-[15px] truncate" title={`${musico.nombres} ${musico.apellidos}`}>
                                    {musico.nombres} {musico.apellidos}
                                    {seccion.id === 'percusion' && (
                                      <span className="ml-1 text-xs text-gray-400 font-medium tracking-wide">({musico.instrumento})</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // --- WIZARD PARA CREAR/EDITAR ---
              <>
                {/* Navegación por Pasos (Wizard) */}
                <div className="flex flex-wrap px-6 py-4 bg-white border-b border-gray-100">
                  <button 
                    onClick={() => setModalStep(1)} 
                    className={`flex items-center gap-3 mr-8 transition-colors ${modalStep === 1 ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${modalStep === 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>1</div>
                    <span className="font-bold text-lg hidden sm:block">Datos Básicos</span>
                  </button>
                  <div className="h-0.5 w-16 bg-gray-200 self-center hidden md:block mr-8"></div>
                  <button 
                    onClick={() => setModalStep(2)} 
                    className={`flex items-center gap-3 transition-colors ${modalStep === 2 ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${modalStep === 2 ? 'bg-blue-100' : 'bg-gray-100'}`}>2</div>
                    <span className="font-bold text-lg hidden sm:block">Convocatoria ({formData.convocados.length})</span>
                  </button>
                </div>

                {/* Contenido del Modal */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                  
                  {/* PASO 1: DATOS BÁSICOS */}
                  {modalStep === 1 && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in slide-in-from-left-4 duration-300">
                      <div className="bg-blue-50 p-4 rounded-xl flex gap-3 text-blue-800 mb-6">
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <p>Completa la información básica de cuándo y dónde se llevará a cabo la presentación de la banda.</p>
                      </div>
                      
                      <div>
                        <label className="block text-gray-700 font-bold mb-2">¿Cómo se llama el evento?</label>
                        <input type="text" name="titulo" value={formData.titulo} onChange={handleChange} required placeholder="Ej: Boda Familia Pérez, Entrada Folklórica..."
                          className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all bg-white hover:border-gray-300" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-gray-700 font-bold mb-2">Fecha y Hora Exacta</label>
                          <input type="datetime-local" name="fecha_hora_cita" value={formData.fecha_hora_cita} onChange={handleChange} required
                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all bg-white hover:border-gray-300" />
                        </div>
                        <div>
                          <label className="block text-gray-700 font-bold mb-2">Lugar de Concentración</label>
                          <input type="text" name="lugar_concentracion" value={formData.lugar_concentracion} onChange={handleChange} required placeholder="Ej: Plaza Principal"
                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all bg-white hover:border-gray-300" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-gray-700 font-bold mb-2">Tipo de Uniforme</label>
                          <select name="uniforme" value={formData.uniforme} onChange={handleChange}
                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all appearance-none bg-white hover:border-gray-300">
                            {UNIFORMES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-700 font-bold mb-2">Especifique el Uniforme</label>
                          <input type="text" name="uniforme_personalizado" value={formData.uniforme_personalizado || ''} onChange={handleChange} placeholder="Ej: Camisa blanca y jean"
                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all bg-white hover:border-gray-300" />
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <label className="block text-gray-700 font-bold mb-2">Detalles Adicionales del Uniforme</label>
                        <input type="text" name="detalles_uniforme" value={formData.detalles_uniforme || ''} onChange={handleChange} placeholder="Opcional. Ej: Corbata guinda"
                          className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 focus:ring-0 focus:border-blue-500 outline-none text-lg transition-all bg-white hover:border-gray-300" />
                      </div>
                    </div>
                  )}

                  {/* PASO 2: CONVOCATORIA (SELECCIÓN DE MÚSICOS) */}
                  {modalStep === 2 && (
                    <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                      <div className="bg-purple-50 p-4 rounded-xl flex gap-3 text-purple-800 mb-6 shrink-0">
                        <Users className="w-6 h-6 shrink-0" />
                        <p>Selecciona a los músicos que deben asistir a este evento. Puedes seleccionar secciones completas o músicos específicos.</p>
                      </div>
                      
                      {/* Buscador de músicos */}
                      <div className="relative mb-6 shrink-0">
                        <Search className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Buscar músico por nombre..."
                          value={musicoSearchTerm}
                          onChange={(e) => setMusicoSearchTerm(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-purple-500 outline-none text-lg transition-colors"
                        />
                      </div>

                      {/* Listado de secciones */}
                      <div className="space-y-8 pb-10">
                        {secciones.map(seccion => {
                          let sectionMusicos = musicos.filter(m => seccion.instrumentos.includes(m.instrumento));
                          
                          // Filtrar por término de búsqueda si existe
                          if (musicoSearchTerm) {
                            sectionMusicos = sectionMusicos.filter(m => 
                              (m.nombres + ' ' + m.apellidos).toLowerCase().includes(musicoSearchTerm.toLowerCase())
                            );
                          }
                          
                          if (sectionMusicos.length === 0) return null;
                          
                          const sectionIds = sectionMusicos.map(m => m.id);
                          const isAllSelected = sectionIds.every(id => formData.convocados.includes(id));
                          
                          return (
                            <div key={seccion.id} className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
                              {/* Header de la sección */}
                              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b-2 border-gray-100">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                  {seccion.nombre} 
                                  <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-sm font-bold ml-2">
                                    {sectionMusicos.length}
                                  </span>
                                </h3>
                                <button 
                                  onClick={() => handleSectionSelectAll(sectionMusicos, isAllSelected)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${isAllSelected ? 'bg-blue-100 text-blue-700' : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                >
                                  {isAllSelected ? (
                                    <><CheckSquare className="w-5 h-5" /> Todos Seleccionados</>
                                  ) : (
                                    <><Square className="w-5 h-5" /> Seleccionar Todos</>
                                  )}
                                </button>
                              </div>
                              
                              {/* Grid de músicos (Tarjetas amplias en lugar de checkboxes) */}
                              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {sectionMusicos.map(musico => {
                                  const isSelected = formData.convocados.includes(musico.id);
                                  const isBusy = musico.ocupado_en_fecha;
                                  return (
                                    <div 
                                      key={musico.id}
                                      onClick={() => {
                                        if (isBusy) {
                                          alert(`Este músico ya está asignado al evento: ${musico.evento_ocupado_titulo} en la misma fecha.`);
                                          return;
                                        }
                                        handleConvocadosChange(musico.id);
                                      }}
                                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${!isBusy ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 bg-red-50'} ${
                                        isSelected 
                                          ? 'border-blue-500 bg-blue-50/30' 
                                          : isBusy ? 'border-red-200' : 'border-transparent hover:border-gray-200'
                                      }`}
                                    >
                                      {viewingEvento ? (
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                          <Users className="w-4 h-4" />
                                        </div>
                                      ) : (
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                          isSelected ? 'bg-blue-500 border-blue-500 text-white' : isBusy ? 'border-red-300 bg-red-100 text-red-500' : 'border-gray-300 bg-white'
                                        }`}>
                                          {isSelected && <CheckSquare className="w-4 h-4" />}
                                          {isBusy && !isSelected && <AlertCircle className="w-4 h-4" />}
                                        </div>
                                      )}
                                      
                                      <div className="flex-1">
                                        <span className={`font-bold block ${isSelected ? 'text-blue-900' : isBusy ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                                          {musico.nombres} {musico.apellidos}
                                        </span>
                                        {isBusy && <span className="text-xs text-red-600 font-bold block">Ocupado en: {musico.evento_ocupado_titulo}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}

            {/* Footer / Controles inferiores */}
            <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
              {viewingEvento ? (
                <div className="w-full flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-8 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cerrar Resumen
                  </button>
                </div>
              ) : (
                <>
                  {modalStep > 1 ? (
                    <button 
                      type="button" 
                      onClick={() => setModalStep(modalStep - 1)} 
                      className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" /> Atrás
                    </button>
                  ) : (
                    <div></div> // Spacer
                  )}
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    
                    {modalStep < 2 ? (
                      <button 
                        type="button" 
                        onClick={() => setModalStep(modalStep + 1)} 
                        className="px-8 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                      >
                        Siguiente <ChevronRight className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleSubmit} 
                        className="px-8 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <CheckSquare className="w-5 h-5" />
                        {formData.id ? 'Guardar Cambios' : 'Crear Evento'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Rediseñado */}
      {eventoToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setEventoToDelete(null)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 text-center relative z-10 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">¿Estás seguro?</h3>
            <p className="text-gray-600 mb-8 text-lg">
              Vas a eliminar la relación nominal de <span className="font-bold text-gray-900">{eventoToDelete.titulo}</span>. Toda la asistencia y los datos se perderán para siempre.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button 
                onClick={() => setEventoToDelete(null)} 
                className="w-full px-6 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                No, mantener evento
              </button>
              <button 
                onClick={confirmDelete} 
                className="w-full px-6 py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg"
              >
                Sí, eliminarlo
              </button>
            </div>
          </div>
        </div>
      )}

      <MultiEventoModal 
        isOpen={isMultiModalOpen} 
        onClose={() => setIsMultiModalOpen(false)} 
        onSaveSuccess={fetchEventos}
        userRol={userRol}
      />
    </div>
  );
}
