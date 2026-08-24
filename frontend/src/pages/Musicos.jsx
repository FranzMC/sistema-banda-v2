import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Users, Music, Plus, X, Eye, CheckCircle2, XCircle, Activity, MapPin, Calendar, Shirt, Edit2, Trash2, AlertTriangle, Search, FileDown, User } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { SortableMusicoRow } from '../components/SortableMusicoRow';
import Notification from '../components/Notification';

const initialFormState = {
  id: null,
  documento_identidad: '', nombres: '', apellidos: '', telefono: '',
  instrumento: 'TROMPETA', direccion: '', fecha_nacimiento: '',
  talla_camisa: '', talla_chamarra: '', numero_calzado: '',
  nivel: 'INTERMEDIO', activo: true, foto_perfil: null
};

export default function Musicos() {
  const userRol = JSON.parse(localStorage.getItem('user'))?.rol;
  const [musicos, setMusicos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingMusico, setViewingMusico] = useState(null); // Estado para ver detalles
  const [musicoToDelete, setMusicoToDelete] = useState(null); // Estado para confirmación de eliminación
  const [searchTerm, setSearchTerm] = useState(''); // Estado para la búsqueda
  const [instrumentoFilter, setInstrumentoFilter] = useState(''); // Estado para el filtro de instrumento
  const [isReportModalOpen, setIsReportModalOpen] = useState(false); // Estado para modal de reportes
  const [reportTitle, setReportTitle] = useState(''); // Estado para título personalizado del reporte
  // Estado para las columnas del reporte
  const [reportColumns, setReportColumns] = useState({ ci: true, nombres_apellidos: true, celular: true, instrumento: true, tallas: true, estado: true, direccion: false, fecha_nacimiento: false, nivel: false });
  
  const [formData, setFormData] = useState(initialFormState);
  const [notification, setNotification] = useState({ show: false, type: 'success', message: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px drag to activate, allows clicking buttons
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldFilteredIndex = filteredMusicos.findIndex((m) => m.id === active.id);
      const newFilteredIndex = filteredMusicos.findIndex((m) => m.id === over.id);

      // 1. Array move in filtered list
      const newFilteredList = arrayMove(filteredMusicos, oldFilteredIndex, newFilteredIndex);

      // 2. Extract original 'orden' values of these specific items, and sort them
      const originalOrders = [...filteredMusicos].map(m => m.orden || 999).sort((a, b) => a - b);

      // 3. Assign the sorted orders to the newly ordered items
      const updatedItems = newFilteredList.map((m, idx) => ({
        ...m,
        orden: originalOrders[idx]
      }));

      // 4. Update main musicos array
      const updatedMusicos = musicos.map(m => {
        const updatedItem = updatedItems.find(ui => ui.id === m.id);
        return updatedItem ? updatedItem : m;
      });
      
      updatedMusicos.sort((a, b) => (a.orden || 999) - (b.orden || 999));
      setMusicos(updatedMusicos);

      // 5. Send ONLY the updated items to backend
      try {
        const orderData = updatedItems.map(m => ({ id: m.id, order: m.orden }));
        await api.post('/musicos/update_order/', { order: orderData });
      } catch (error) {
        console.error("Error updating order:", error);
        alert("Hubo un error guardando el nuevo orden");
      }
    }
  };

  useEffect(() => {
    fetchMusicos();
  }, []);


  const fetchMusicos = () => {
    api.get('/musicos/')
      .then(response => setMusicos(response.data))
      .catch(error => console.error("Error al obtener los músicos:", error));
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setFormData({ ...formData, [name]: files[0] });
    } else if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      // CONVERTIR A MAYÚSCULAS en tiempo real si es un campo de texto
      const finalValue = (type === 'text') ? value.toUpperCase() : value;
      setFormData({ ...formData, [name]: finalValue });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Como enviamos una foto, usamos FormData en lugar de un JSON normal
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'id') return; // El id no se envía en el FormData
      if (key === 'foto_perfil' && !(formData[key] instanceof File)) return; // Evitar sobreescribir la foto con texto/null
      
      if (formData[key] !== null && formData[key] !== '') { // Solo enviar campos que tengan datos
        data.append(key, formData[key]);
      }
    });

    try {
      if (formData.id) {
        // Si existe un id, actualizamos (PATCH)
        await api.patch(`/musicos/${formData.id}/`, data);
        setNotification({ show: true, type: 'success', message: '¡Músico actualizado correctamente!' });
      } else {
        // Si no, creamos uno nuevo (POST)
        await api.post('/musicos/', data);
        setNotification({ show: true, type: 'success', message: '¡Músico creado exitosamente!' });
      }
      setIsModalOpen(false);
      fetchMusicos(); // Recargar la lista
      setFormData(initialFormState); // Limpiar formulario
    } catch (error) {
      console.error("Error completo:", error);
      // Ocultar esta alerta si es error 401 (el interceptor ya lo maneja)
      if (error.response?.status !== 401) {
        setNotification({ show: true, type: 'error', message: 'Error al guardar: ' + JSON.stringify(error.response?.data || error.message) });
      }
    }
  };

  // FUNCIÓN PARA EDITAR
  const handleEdit = (musico) => {
    setFormData({
      id: musico.id,
      documento_identidad: musico.documento_identidad || musico.ci || '',
      nombres: musico.nombres || '',
      apellidos: musico.apellidos || '',
      telefono: musico.telefono || musico.celular || '',
      instrumento: musico.instrumento || 'TROMPETA',
      direccion: musico.direccion || '',
      fecha_nacimiento: musico.fecha_nacimiento || '',
      talla_camisa: musico.talla_camisa || '',
      talla_chamarra: musico.talla_chamarra || '',
      numero_calzado: musico.numero_calzado || '',
      nivel: musico.nivel || 'INTERMEDIO',
      activo: musico.activo !== false,
      foto_perfil: null // No cargamos la foto existente en el input file
    });
    setIsModalOpen(true);
  };

  // FUNCIÓN PARA ELIMINAR (Confirmación desde el Modal)
  const confirmDelete = async () => {
    if (!musicoToDelete) return;
    try {
      await api.delete(`/musicos/${musicoToDelete.id}/`);
      setNotification({ show: true, type: 'success', message: '¡Músico eliminado correctamente!' });
      fetchMusicos(); // Recargar la lista
      setMusicoToDelete(null); // Cerrar el modal
    } catch (error) {
      if (error.response?.status !== 401) {
        setNotification({ show: true, type: 'error', message: 'Error al eliminar: ' + JSON.stringify(error.response?.data || error.message) });
      }
      setMusicoToDelete(null);
    }
  };

  // Lógica de filtrado y búsqueda
  const filteredMusicos = useMemo(() => {
    const filtered = musicos.filter(musico => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        (musico.nombres && musico.nombres.toLowerCase().includes(searchTermLower)) ||
        (musico.apellidos && musico.apellidos.toLowerCase().includes(searchTermLower)) ||
        (musico.documento_identidad && musico.documento_identidad.toLowerCase().includes(searchTermLower));

      const matchesInstrumento = instrumentoFilter === '' || musico.instrumento === instrumentoFilter;

      return matchesSearch && matchesInstrumento;
    });

    const sectionOrder = ['TROMPETA', 'CLARINETE', 'SAXO', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'PLATILLO', 'TAMBOR'];
    return filtered.sort((a, b) => {
      const instrA = (a.instrumento || '').toUpperCase();
      const instrB = (b.instrumento || '').toUpperCase();
      
      let indexA = sectionOrder.findIndex(s => instrA.includes(s));
      let indexB = sectionOrder.findIndex(s => instrB.includes(s));
      
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      
      return indexA - indexB;
    });
  }, [musicos, searchTerm, instrumentoFilter]);

  // Obtener instrumentos únicos para el filtro
  const uniqueInstruments = useMemo(() => [...new Set(musicos.map(m => m.instrumento))].sort(), [musicos]);

  // Manejar cambio en checkboxes del reporte
  const handleReportColumnChange = (e) => {
    const { name, checked } = e.target;
    setReportColumns(prev => ({ ...prev, [name]: checked }));
  };

  // FUNCIÓN PARA GENERAR REPORTE (simulada)
  const handleGenerateReport = async (format) => {
    const selectedCols = Object.keys(reportColumns).filter(col => reportColumns[col]);
    if (selectedCols.length === 0) {
      alert("Por favor, selecciona al menos una columna para el reporte.");
      return;
    }

    // Aquí iría la lógica para llamar a un endpoint del backend
    // que genere el archivo y lo devuelva para descargar.
    const queryParams = new URLSearchParams({
      tipo_reporte: format,
      search: searchTerm,
      instrumento: instrumentoFilter,
      columns: selectedCols.join(','),
      titulo: reportTitle,
    });
    
    try {
      // Indicamos responseType: 'blob' para poder recibir archivos
      const response = await api.get(`/musicos/reporte/?${queryParams.toString()}`, {
        responseType: 'blob',
      });

      // Crear un enlace invisible en el navegador para forzar la descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const finalFileName = reportTitle.trim() ? `${reportTitle.trim().replace(/[^a-zA-Z0-9 -]/g, '_')}` : 'Reporte_Musicos';
      link.setAttribute('download', `${finalFileName}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setIsReportModalOpen(false);
    } catch (error) {
      console.error("Error generando reporte:", error);
      alert("Error al generar el reporte. Verifica que instalaste openpyxl y reportlab en el backend.");
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Directorio de Músicos
          </h1>
          <p className="text-gray-500 mt-1">Gestiona el personal, instrumentos y niveles.</p>
        </div>
        {!['JEFE_SECCION', 'MUSICO'].includes(userRol) && (
          <button 
            onClick={() => {
              setFormData(initialFormState); // Asegurarse de que el formulario esté vacío
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nuevo Músico
          </button>
        )}
      </header>
      
      {/* Barra de Búsqueda y Filtros */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
          />
        </div>
        <select
          value={instrumentoFilter}
          onChange={(e) => setInstrumentoFilter(e.target.value)}
          className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-sm"
        >
          <option value="">Todas las Secciones</option>
          {uniqueInstruments.map(inst => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
        {!['JEFE_SECCION', 'MUSICO'].includes(userRol) && (
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Reporte
          </button>
        )}
      </div>

      {/* ── VISTA MÓVIL: cards ───────────────────────────────────────── */}
      <div className="md:hidden space-y-3 mb-4">
        {filteredMusicos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No se encontraron músicos</p>
          </div>
        ) : filteredMusicos.map((musico, index) => (
          <div key={musico.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
                  {musico.nombres} {musico.apellidos}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">CI: {musico.documento_identidad || '—'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {musico.instrumento}
                  </span>
                  {musico.telefono && (
                    <span className="text-xs text-gray-500">{musico.telefono}</span>
                  )}
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                    musico.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {musico.activo ? '● Activo' : '● Inactivo'}
                  </span>
                </div>
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setViewingMusico(musico)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleEdit(musico)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setMusicoToDelete(musico)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── VISTA DESKTOP: tabla ─────────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                  <th className="p-4 font-medium w-16">#</th>
                  <th className="p-4 font-medium">CI</th>
                  <th className="p-4 font-medium">Nombres y Apellidos</th>
                  <th className="p-4 font-medium">Celular</th>
                  <th className="p-4 font-medium">Instrumento</th>
                  <th className="p-4 font-medium">Tallas (C/Ch/Z)</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-center">Acciones</th>
                </tr>
              </thead>
              <SortableContext items={filteredMusicos.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-gray-50">
                  {filteredMusicos.map((musico, index) => (
                    <SortableMusicoRow 
                      key={musico.id} 
                      musico={musico} 
                      index={index} 
                      onVer={setViewingMusico} 
                      onEditar={handleEdit} 
                      onEliminar={setMusicoToDelete} 
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </div>

      {/* Modal Emergente para Nuevo Músico */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden my-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">{formData.id ? 'Editar Músico' : 'Agregar Nuevo Músico'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">Datos Personales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Carnet de Identidad (CI)</label>
                  <input type="text" name="documento_identidad" value={formData.documento_identidad} onChange={handleChange} required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombres</label>
                  <input type="text" name="nombres" value={formData.nombres} onChange={handleChange} required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apellidos</label>
                  <input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Celular</label>
                  <input type="text" name="telefono" value={formData.telefono} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Nacimiento</label>
                  <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">Perfil Musical y Tallas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instrumento</label>
                  <select name="instrumento" value={formData.instrumento} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                    <option value="TROMPETA">Trompeta</option>
                    <option value="TROMBON">Trombón</option>
                    <option value="SAXOFON">Saxofón</option>
                    <option value="CLARINETE">Clarinete</option>
                    <option value="FLAUTA">Flauta</option>
                    <option value="TUBA">Tuba</option>
                    <option value="BARITONO">Barítono</option>
                    <option value="PERCUSION">Percusión</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nivel</label>
                  <select name="nivel" value={formData.nivel} onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                    <option value="PRINCIPIANTE">Principiante</option>
                    <option value="INTERMEDIO">Intermedio</option>
                    <option value="AVANZADO">Avanzado</option>
                    <option value="MAESTRO">Maestro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Talla Camisa</label>
                  <input type="text" name="talla_camisa" value={formData.talla_camisa} onChange={handleChange} placeholder="Ej: 16 o M"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Talla Chamarra</label>
                  <input type="text" name="talla_chamarra" value={formData.talla_chamarra} onChange={handleChange} placeholder="Ej: L"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nro. Calzado</label>
                  <input type="text" name="numero_calzado" value={formData.numero_calzado} onChange={handleChange} placeholder="Ej: 42"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Foto de Perfil (Opcional)</label>
                  <input type="file" name="foto_perfil" onChange={handleChange} accept="image/*"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                <div className="flex items-center mt-6">
                  <label className="flex items-center cursor-pointer gap-2">
                    <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded" />
                    <span className="text-sm font-medium text-gray-700">Músico Activo</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm">
                  {formData.id ? 'Actualizar Músico' : 'Guardar Músico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Emergente para Ver Detalles del Músico */}
      {viewingMusico && (
        (() => {
          // Cálculos para la torta de estadísticas
          const asistenciaPorcentaje = viewingMusico.rendimiento ? parseFloat(viewingMusico.rendimiento.porcentaje_asistencia) : 0;
          const inasistencia = 100 - asistenciaPorcentaje;
          const dataChart = [
            { name: 'Asistencia', value: asistenciaPorcentaje },
            { name: 'Faltas/Tardanzas', value: inasistencia }
          ];
          const COLORS = ['#10b981', '#f43f5e']; // Verde y Rojo
          
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
            {/* Columna Izquierda: Perfil */}
            <div className="bg-gray-50 p-8 md:w-1/3 border-r border-gray-100 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full bg-blue-100 border-4 border-white shadow-md overflow-hidden mb-4 flex items-center justify-center">
                {viewingMusico.foto_perfil ? (
                  <img src={viewingMusico.foto_perfil} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-blue-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{viewingMusico.nombres}</h2>
              <h3 className="text-xl font-medium text-gray-600 mb-2">{viewingMusico.apellidos}</h3>
              <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm font-semibold tracking-wide mb-6">
                {viewingMusico.instrumento}
              </span>
              
              <div className="w-full space-y-3 text-left overflow-y-auto max-h-[40vh] pr-2">
                {/* Mostramos ABSOLUTAMENTE TODOS LOS DATOS */}
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Nivel Musical</p>
                    <p className="font-semibold">{viewingMusico.nivel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">CI / Documento</p>
                    <p className="font-semibold">{viewingMusico.documento_identidad || viewingMusico.ci}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Celular</p>
                    <p className="font-semibold">{viewingMusico.telefono || viewingMusico.celular}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Dirección</p>
                    <p className="font-semibold">{viewingMusico.direccion || 'No registrada'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Nacimiento</p>
                    <p className="font-semibold">{viewingMusico.fecha_nacimiento || 'No registrada'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="text-gray-400 text-xs">Estado Actual</p>
                    <p className="font-semibold">{viewingMusico.activo ? 'Activo en la Banda' : 'Inactivo / Suspendido'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Estadísticas y Datos Adicionales */}
            <div className="p-8 md:w-2/3 relative">
              <button onClick={() => setViewingMusico(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Shirt className="w-5 h-5 text-blue-600" /> Tallas de Uniforme
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <p className="text-gray-500 text-sm mb-1">Camisa</p>
                  <p className="text-xl font-bold text-gray-800">{viewingMusico.talla_camisa || '-'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <p className="text-gray-500 text-sm mb-1">Chamarra</p>
                  <p className="text-xl font-bold text-gray-800">{viewingMusico.talla_chamarra || '-'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <p className="text-gray-500 text-sm mb-1">Calzado</p>
                  <p className="text-xl font-bold text-gray-800">{viewingMusico.numero_calzado || '-'}</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-4 border-t pt-6">Estadísticas de Rendimiento</h3>
              <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-200 flex items-center justify-between">
                {/* Gráfico de Torta real con Recharts */}
                <div className="w-1/2 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dataChart} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                        {dataChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 text-left pl-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Asistencia Anual</p>
                    <p className="text-3xl font-bold text-emerald-600">{asistenciaPorcentaje}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Score de Lealtad (Canastón)</p>
                    <p className="text-2xl font-bold text-blue-600">{viewingMusico.rendimiento?.score_lealtad || 0} pts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
            </div>
          );
        })()
      )}

      {/* Modal de Confirmación de Eliminación */}
      {musicoToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar Músico?</h3>
            <p className="text-gray-600 mb-6">
              Estás a punto de eliminar a <span className="font-bold text-gray-800">{musicoToDelete.nombres} {musicoToDelete.apellidos}</span>. Esta acción es permanente y no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setMusicoToDelete(null)} 
                className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete} 
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Selección de Columnas de Reporte */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Generar Reporte de Músicos</h3>
                <p className="text-gray-500 mt-1">Selecciona las columnas y un título opcional.</p>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Título del Reporte (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Reporte Anual de Músicos"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 my-6">
              {Object.keys(reportColumns).map(col => (
                <label key={col} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    name={col}
                    checked={reportColumns[col]}
                    onChange={handleReportColumnChange}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-700 capitalize">{col.replace('_', ' ')}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button 
                onClick={() => handleGenerateReport('excel')} 
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Generar Excel
              </button>
              <button 
                onClick={() => handleGenerateReport('pdf')} 
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación */}
      {notification.show && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
    </div>
  );
} 

