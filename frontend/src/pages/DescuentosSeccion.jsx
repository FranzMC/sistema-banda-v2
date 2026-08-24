import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter, TrendingDown, Calendar, Users, AlertTriangle, Edit2, Trash2, X, Upload, FileText, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DescuentosSeccion() {
  const [descuentos, setDescuentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [editingDescuento, setEditingDescuento] = useState(null);
  const [editFormData, setEditFormData] = useState({ motivo: '', monto: '' });
  
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const secciones = [
    'TROMPETA', 'SAXOFON', 'CLARINETE', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'
  ];

  const inferSeccionFromFilename = (filename) => {
    const fn = filename.toUpperCase();
    if (fn.includes('TROMPETA')) return 'TROMPETAS';
    if (fn.includes('CLARINETE')) return 'CLARINETES';
    if (fn.includes('SAXO')) return 'SAXOS';
    if (fn.includes('BARITONO')) return 'BARITONOS';
    if (fn.includes('TROMBON')) return 'TROMBONES';
    if (fn.includes('TUBA')) return 'TUBAS';
    if (fn.includes('BOMBO')) return 'BOMBOS';
    if (fn.includes('TAMBOR')) return 'TAMBORES';
    if (fn.includes('PLATILLO')) return 'PLATILLOS';
    if (fn.includes('PERCUSION')) return 'PERCUSION';
    return '';
  };

  const handleBatchDescuentosUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsProcessingBatch(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const seccion = inferSeccionFromFilename(file.name);
        
        const formData = new FormData();
        formData.append('pdf_file', file);
        formData.append('guardar_en_seccion', 'true');
        formData.append('seccion', seccion);
        formData.append('observaciones', `Descuentos PDF de sección ${seccion} - ${file.name}`);
        
        await api.post('/descuentos/procesar_pdf/', formData);
      }
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al procesar archivo');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      let descuentosUrl = '/descuentos/';
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      
      const response = await api.get(`${descuentosUrl}?${params.toString()}`);
      const data = response.data;
      setDescuentos(Array.isArray(data) ? data : data.results || []);

    } catch (error) {
      if (error.response?.status === 403) {
        setError('No tienes permisos para ver este módulo.');
      } else {
        setError(error.response?.data?.detail || 'Error cargando descuentos. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const eventosUnicos = [...new Set(descuentos.map(d => d.evento_titulo))].filter(Boolean);

  const descuentosFiltrados = descuentos.filter(d => {
    const term = searchTerm.toLowerCase();
    const matchTerm = (
      d.musico_nombre?.toLowerCase().includes(term) ||
      d.motivo?.toLowerCase().includes(term) ||
      d.evento_titulo?.toLowerCase().includes(term) ||
      d.seccion?.toLowerCase().includes(term)
    );
    const matchEvent = selectedEvent ? d.evento_titulo === selectedEvent : true;
    return matchTerm && matchEvent;
  });

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const formatearMonto = (monto) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency', currency: 'BOB'
    }).format(monto);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este descuento?')) {
      try {
        await api.delete(`/descuentos/${id}/`);
        cargarDatos();
      } catch (err) {
        setError(err.response?.data?.detail || 'Error al eliminar el descuento.');
      }
    }
  };

  const openEditModal = (descuento) => {
    setEditingDescuento(descuento);
    setEditFormData({ motivo: descuento.motivo, monto: descuento.monto });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/descuentos/${editingDescuento.id}/`, editFormData);
      setEditingDescuento(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al editar el descuento.');
    }
  };

  const agruparDescuentos = (lista) => {
    const grupos = {};
    lista.forEach(d => {
      const key = `${d.musico}-${d.evento}`;
      if (!grupos[key]) {
        grupos[key] = {
          id: key, // usar la key como ID único para React list
          musico_nombre: d.musico_nombre,
          seccion: d.seccion,
          evento_titulo: d.evento_titulo,
          fecha_falta: d.fecha_falta,
          origen: d.origen,
          estado: d.estado,
          total_monto: 0,
          faltas: []
        };
      }
      grupos[key].total_monto += parseFloat(d.monto);
      grupos[key].faltas.push(d);
    });
    return Object.values(grupos);
  };

  const resumenPorEvento = descuentosFiltrados.reduce((acc, current) => {
    const evento = current.evento_titulo || 'Sin evento';
    if (!acc[evento]) {
      acc[evento] = { evento, total: 0, count: 0 };
    }
    acc[evento].total += parseFloat(current.monto || 0);
    acc[evento].count += 1;
    return acc;
  }, {});
  const resumenPorEventoArray = Object.values(resumenPorEvento).sort((a, b) => b.total - a.total);

  const descuentosAgrupados = agruparDescuentos(descuentosFiltrados).sort((a, b) => {
    const sectionWeight = (s) => {
      const upper = (s || '').toUpperCase();
      if (upper.includes('TROMPETA')) return 1;
      if (upper.includes('CLARINETE') || upper.includes('SAXO')) return 2;
      if (upper.includes('BARITONO')) return 3;
      if (upper.includes('TROMBON')) return 4;
      if (upper.includes('TUBA')) return 5;
      if (upper.includes('BOMBO') || upper.includes('TAMBOR') || upper.includes('PLATILLO') || upper.includes('PERCUSION')) return 6;
      return 7;
    };
    const wA = sectionWeight(a.seccion);
    const wB = sectionWeight(b.seccion);
    if (wA !== wB) return wA - wB;
    return (a.musico_nombre || '').localeCompare(b.musico_nombre || '');
  });

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // Blue
    doc.text('REPORTE DE DESCUENTOS Y FALTAS', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    if (searchTerm) {
      doc.text(`Filtro: ${searchTerm}`, 14, 28);
    }
    
    const tableData = [];
    descuentosAgrupados.forEach(d => {
      const detalles = d.faltas.map(f => `• ${f.motivo} (${formatearMonto(f.monto)})`).join('\n');
      tableData.push([
        formatearFecha(d.fecha_falta),
        d.musico_nombre,
        `${d.evento_titulo}\n(${d.seccion || 'N/A'})`,
        detalles,
        formatearMonto(d.total_monto)
      ]);
    });

    autoTable(doc, {
      startY: searchTerm ? 32 : 26,
      head: [['Fecha', 'Músico', 'Evento / Sección', 'Faltas Detalladas', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center' },
      styles: { fontSize: 9, valign: 'middle', lineColor: [234, 179, 8], lineWidth: 0.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 },
        3: { cellWidth: 80 },
        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] }
      },
    });
    
    doc.save(`Descuentos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Descuentos y Faltas</h1>
          <p className="text-gray-600 mt-2">Gestión de descuentos y faltas reportados por Jefes de Sección.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input 
            type="file" 
            id="pdfDescuentosBtn" 
            className="hidden" 
            accept=".pdf,.xlsx,.xls"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleBatchDescuentosUpload(Array.from(e.target.files));
                e.target.value = null;
              }
            }}
          />
          <label 
            htmlFor="pdfDescuentosBtn" 
            className={`bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors ${isProcessingBatch ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isProcessingBatch ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
               <Upload className="w-5 h-5" />
            )}
            Subir PDFs
          </label>
          <button 
            onClick={cargarDatos} 
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjeta de resumen */}
      {descuentosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
            <p className="text-sm font-medium text-red-700">Total Faltas (Monto)</p>
            <p className="text-3xl font-black text-red-600 mt-1">Bs. {descuentosFiltrados.reduce((acc, d) => acc + parseFloat(d.monto || 0), 0).toLocaleString('es-BO', {minimumFractionDigits: 0})}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
            <p className="text-sm font-medium text-orange-700">Músicos con Sanción</p>
            <p className="text-3xl font-black text-orange-600 mt-1">{new Set(descuentosFiltrados.map(d => d.musico_nombre)).size}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-5 border border-yellow-200">
            <p className="text-sm font-medium text-yellow-700">Registros Totales</p>
            <p className="text-3xl font-black text-yellow-600 mt-1">{descuentosFiltrados.length}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 w-6 h-6 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Resumen por Evento */}
      {resumenPorEventoArray.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Recaudación Total por Evento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {resumenPorEventoArray.map((res, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <p className="text-sm text-gray-500 font-medium truncate" title={res.evento}>{res.evento}</p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-xl font-bold text-gray-900">{formatearMonto(res.total)}</p>
                  <p className="text-xs text-gray-400 font-medium">{res.count} faltas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por músico, motivo o evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <div className="w-full md:w-auto md:min-w-[200px] relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-orange-600" />
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="pl-9 pr-8 w-full px-4 py-2 border border-orange-200 bg-orange-50 text-orange-800 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none appearance-none font-medium"
            >
              <option value="">Todos los eventos</option>
              {eventosUnicos.map((evento, index) => (
                <option key={index} value={evento}>{evento}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-orange-800">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
          
          {/* Fechas */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-36">
              <input 
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-gray-700"
                title="Fecha Inicio"
              />
            </div>
            <div className="relative flex-1 md:w-36">
              <input 
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-gray-700"
                title="Fecha Fin"
              />
            </div>
          </div>

          <div className="w-full md:w-auto">
            <button
              onClick={exportToPDF}
              disabled={descuentosFiltrados.length === 0}
              className="w-full md:w-auto px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              Generar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {descuentosAgrupados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <TrendingDown className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>No hay descuentos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha / Origen</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Músico</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evento / Sección</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Faltas Detalladas</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Descuento</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {descuentosAgrupados.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{formatearFecha(d.fecha_falta)}</p>
                      <p className="text-xs text-gray-500 mt-1">{d.origen === 'APP_MOVIL' ? 'App Móvil' : 'Web'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{d.musico_nombre}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 text-sm font-medium">{d.evento_titulo}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                        {d.seccion || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="list-disc pl-4 text-gray-600 text-sm space-y-2">
                        {d.faltas.map((falta, idx) => (
                          <li key={falta.id || idx} className="flex items-start justify-between group">
                            <span>{falta.motivo} ({formatearMonto(falta.monto)})</span>
                            <div className="flex space-x-1 ml-2">
                              <button onClick={() => openEditModal(falta)} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(falta.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-red-600">{formatearMonto(d.total_monto)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        d.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {d.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar */}
      {editingDescuento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-lg text-gray-900">Editar Descuento</h3>
              <button onClick={() => setEditingDescuento(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input
                  type="text"
                  required
                  value={editFormData.motivo}
                  onChange={(e) => setEditFormData({ ...editFormData, motivo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (Bs)</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  value={editFormData.monto}
                  onChange={(e) => setEditFormData({ ...editFormData, monto: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingDescuento(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
