import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter, TrendingDown, Calendar, Users, AlertTriangle, Edit2, Trash2, X, Upload, Check, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdelantosSeccion() {
  const [adelantos, setAdelantos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedSeccion, setSelectedSeccion] = useState('all');
  const [selectedEvento, setSelectedEvento] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ monto: '', motivo: '' });

  const [isPdfAdelantosProcessing, setIsPdfAdelantosProcessing] = useState(false);
  const [pdfAdelantosFile, setPdfAdelantosFile] = useState(null);
  const [clearAdelantosFile, setClearAdelantosFile] = useState(false);

  const secciones = [
    'TROMPETA', 'SAXOFON', 'CLARINETE', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'
  ];

  const handlePdfUpload = async (file) => {
    if (!file) return;
    
    setIsPdfAdelantosProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('pdf_file', file);
      formData.append('tipo', 'adelantos');
      formData.append('guardar_en_seccion', 'true');
      if (selectedEvento && selectedEvento !== 'all') {
        formData.append('evento_id', selectedEvento);
      }
      
      const res = await api.post('/descuentos/procesar_pdf/', formData);
      if (res.data.exitoso) {
        cargarDatos();
        setClearAdelantosFile(prev => !prev);
        setPdfAdelantosFile(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar archivo');
    } finally {
      setIsPdfAdelantosProcessing(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [selectedSeccion, selectedEvento]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar eventos para el filtro
      const eventosRes = await api.get('/eventos/');
      setEventos(Array.isArray(eventosRes.data) ? eventosRes.data : eventosRes.data.results || []);

      // Cargar adelantos
      let url = '/adelantos/';
      const params = new URLSearchParams();
      if (selectedSeccion !== 'all') params.append('seccion', selectedSeccion);
      if (selectedEvento !== 'all') params.append('evento', selectedEvento);
      
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get(url);
      const data = response.data;
      setAdelantos(Array.isArray(data) ? data : data.results || []);

    } catch (error) {
      if (error.response?.status === 403) {
        setError('No tienes permisos para ver este módulo.');
      } else {
        setError(error.response?.data?.detail || 'Error cargando adelantos. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const adelantosFiltrados = adelantos.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.musico_nombre?.toLowerCase().includes(term) ||
      a.motivo?.toLowerCase().includes(term) ||
      a.evento_titulo?.toLowerCase().includes(term)
    );
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

  // Calcular totales
  const totalGlobal = adelantosFiltrados.reduce((acc, a) => acc + parseFloat(a.monto || 0), 0);
  
  const totalesPorMusico = adelantosFiltrados.reduce((acc, a) => {
    if (!acc[a.musico_nombre]) {
      acc[a.musico_nombre] = 0;
    }
    acc[a.musico_nombre] += parseFloat(a.monto || 0);
    return acc;
  }, {});

  const agruparAdelantos = (lista) => {
    const grupos = {};
    lista.forEach(a => {
      const key = `${a.musico}-${a.evento}`;
      if (!grupos[key]) {
        grupos[key] = {
          id: key, 
          musico_nombre: a.musico_nombre,
          seccion: a.seccion,
          evento_titulo: a.evento_titulo,
          fecha: a.fecha,
          origen: a.origen,
          estado: a.estado,
          total_monto: 0,
          adelantos: []
        };
      }
      grupos[key].total_monto += parseFloat(a.monto);
      grupos[key].adelantos.push(a);
    });
    return Object.values(grupos);
  };

  const adelantosAgrupados = agruparAdelantos(adelantosFiltrados).sort((a, b) => {
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

  const handleEditClick = (adelanto) => {
    setEditingId(adelanto.id);
    setEditData({ monto: adelanto.monto, motivo: adelanto.motivo });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ monto: '', motivo: '' });
  };

  const handleSaveEdit = async (id) => {
    try {
      await api.patch(`/adelantos/${id}/`, editData);
      setAdelantos(adelantos.map(a => a.id === id ? { ...a, ...editData } : a));
      setEditingId(null);
    } catch (err) {
      alert("Error al actualizar el adelanto.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este adelanto?')) {
      try {
        await api.delete(`/adelantos/${id}/`);
        setAdelantos(adelantos.filter(a => a.id !== id));
      } catch (err) {
        alert("Error al eliminar el adelanto.");
      }
    }
  };

  if (loading && adelantos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // Blue
    doc.text('REPORTE DE ADELANTOS', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const eventName = selectedEvento !== 'all' ? eventos.find(e => e.id.toString() === selectedEvento.toString())?.titulo : 'Todos los eventos';
    doc.text(`Evento: ${eventName || 'Todos'}`, 14, 28);
    if (searchTerm) {
      doc.text(`Búsqueda: ${searchTerm}`, 14, 34);
    }
    
    const tableData = [];
    adelantosAgrupados.forEach(grupo => {
      const detalles = grupo.adelantos.map(d => `• ${d.motivo} (${formatearMonto(d.monto)})`).join('\n');
      tableData.push([
        formatearFecha(grupo.fecha),
        grupo.musico_nombre,
        `${grupo.evento_titulo}\n(${grupo.seccion || 'N/A'})`,
        detalles,
        formatearMonto(grupo.total_monto)
      ]);
    });

    autoTable(doc, {
      startY: searchTerm ? 38 : 32,
      head: [['Fecha', 'Músico', 'Evento / Sección', 'Detalle Adelantos', 'Total']],
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
    
    doc.save(`Adelantos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adelantos</h1>
          <p className="text-gray-600 mt-2">Gestión de adelantos reportados desde la App Móvil y el sistema.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input 
            type="file" 
            id="pdfAdelantosBtn" 
            className="hidden" 
            accept=".pdf,.xlsx,.xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setPdfAdelantosFile(e.target.files[0]);
                handlePdfUpload(e.target.files[0]);
                e.target.value = null;
              }
            }}
          />
          <label 
            htmlFor="pdfAdelantosBtn" 
            className={`bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium cursor-pointer transition-colors ${isPdfAdelantosProcessing ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isPdfAdelantosProcessing ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
               <Upload className="w-5 h-5" />
            )}
            Subir PDF
          </label>
          <button 
            onClick={cargarDatos} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjeta de resumen */}
      {adelantosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
            <p className="text-sm font-medium text-orange-700">Total Adelantos ({selectedEvento !== 'all' ? 'evento seleccionado' : 'todos'})</p>
            <p className="text-3xl font-black text-orange-600 mt-1">Bs. {totalGlobal.toLocaleString('es-BO', {minimumFractionDigits: 0})}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
            <p className="text-sm font-medium text-blue-700">Músicos con Adelanto</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{Object.keys(totalesPorMusico).length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
            <p className="text-sm font-medium text-green-700">Registros Totales</p>
            <p className="text-3xl font-black text-green-600 mt-1">{adelantosFiltrados.length}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 w-6 h-6 mt-0.5" />
          <p className="text-red-700">{error}</p>
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
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="w-full md:w-64">
            <select 
              value={selectedEvento} 
              onChange={(e) => { setSelectedEvento(e.target.value); }}
              className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-orange-50 font-medium text-orange-800"
            >
              <option value="all">📅 Todos los eventos</option>
              {eventos.map(e => (
                <option key={e.id} value={e.id}>{e.titulo}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-auto">
            <button
              onClick={exportToPDF}
              disabled={adelantosFiltrados.length === 0}
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
        {adelantosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <TrendingDown className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>No hay adelantos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha / Origen</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Músico</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evento / Sección</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Adelantos Detallados</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Adelanto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {adelantosAgrupados.map((grupo) => (
                  <tr key={grupo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{formatearFecha(grupo.fecha)}</p>
                      <p className="text-xs text-gray-500 mt-1">{grupo.origen === 'APP_MOVIL' ? 'App Móvil' : 'Web'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{grupo.musico_nombre}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{grupo.evento_titulo}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 mt-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {grupo.seccion || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="space-y-2">
                        {grupo.adelantos.map(d => (
                          <li key={d.id} className="flex items-center justify-between text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                            {editingId === d.id ? (
                              <div className="flex-1 flex gap-2 mr-2">
                                <input 
                                  type="text" 
                                  value={editData.motivo} 
                                  onChange={(e) => setEditData({...editData, motivo: e.target.value})}
                                  className="w-full px-2 py-1 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input 
                                  type="number" 
                                  value={editData.monto} 
                                  onChange={(e) => setEditData({...editData, monto: e.target.value})}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            ) : (
                              <span className="flex-1">• {d.motivo} ({formatearMonto(d.monto)})</span>
                            )}
                            
                            <div className="flex gap-2 ml-2">
                              {editingId === d.id ? (
                                <>
                                  <button onClick={() => handleSaveEdit(d.id)} className="text-green-600 hover:text-green-900"><Check className="w-4 h-4" /></button>
                                  <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900"><X className="w-4 h-4" /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleEditClick(d)} className="text-blue-600 hover:text-blue-900"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-red-600">{formatearMonto(grupo.total_monto)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        grupo.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {grupo.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
