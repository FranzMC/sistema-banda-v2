import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Search, Medal, UserCheck, UserX, AlertCircle, Percent, DollarSign, Users, FileText } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Canaston() {
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    total_eventos_periodo: 0,
    estadisticas_musicos: [],
    descuentos_secciones: []
  });

  const fetchEstadisticas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/canaston/estadisticas/', {
        params: {
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        }
      });
      setData(res.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas de Canastón');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstadisticas();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEstadisticas();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Título principal
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185); // Azul
    doc.text('REPORTE DE ELEGIBILIDAD DE MÚSICOS - CANASTÓN', pageWidth / 2, 20, { align: 'center' });
    
    // Rango de fechas
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${fechaInicio} hasta ${fechaFin}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Total de Eventos del Período: ${data.total_eventos_periodo}`, pageWidth / 2, 34, { align: 'center' });

    // Definición de las secciones y orden exacto pedido
    const seccionesOrdenadas = [
      { titulo: 'SECCIÓN TROMPETAS', key: 'trompetas', test: (i) => i.toLowerCase().includes('trompeta') },
      { titulo: 'SECCIÓN CLARINETES Y SAXOFONES', key: 'maderas', test: (i) => i.toLowerCase().includes('clarinete') || i.toLowerCase().includes('saxof') },
      { titulo: 'SECCIÓN BARÍTONOS', key: 'baritonos', test: (i) => i.toLowerCase().includes('bar') || i.toLowerCase().includes('barítono') },
      { titulo: 'SECCIÓN TROMBONES', key: 'trombones', test: (i) => i.toLowerCase().includes('tromb') },
      { titulo: 'SECCIÓN TUBAS', key: 'tubas', test: (i) => i.toLowerCase().includes('tuba') },
      { titulo: 'SECCIÓN PERCUSIÓN (Bombos, Tambores y Platillos)', key: 'percusion', test: (i) => i.toLowerCase().includes('bombo') || i.toLowerCase().includes('tambor') || i.toLowerCase().includes('platill') || i.toLowerCase().includes('percus') }
    ];

    let currentY = 45;

    seccionesOrdenadas.forEach((seccion) => {
      // Filtrar músicos que pertenecen a esta sección
      const musicosSeccion = data.estadisticas_musicos.filter(m => seccion.test(m.instrumento));
      
      if (musicosSeccion.length === 0) return; // Saltar secciones vacías

      // Agregar título de la sección si hay espacio o forzar nueva página
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Preparar datos para la tabla
      const tableData = musicosSeccion.map(m => [
        m.nombre_completo,
        m.instrumento,
        `${m.total_asistencias} / ${m.total_eventos}`,
        `${m.porcentaje}%`,
        '' // Espacio vacío para la firma
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Nombre del Músico', 'Sección', 'Asistencias', 'Porcentaje', 'Firma del Músico']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 50 } // Columna para la firma
        },
        styles: {
          fontSize: 9,
          valign: 'middle',
          minCellHeight: 12 // Dar suficiente espacio para la firma
        },
        didDrawPage: function(data) {
          // Agregar título de la sección en la primera página de la tabla de la sección
          if (data.pageNumber === 1 || data.cursor.y === data.settings.startY) {
            doc.setFontSize(12);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "bold");
            // Se dibuja un poco más arriba de la tabla
            doc.text(seccion.titulo, 14, data.settings.startY - 4);
          }
        },
        margin: { top: 30, left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 15;
    });

    // Músicos "Otros" (los que no cayeron en las categorías principales)
    const musicosOtros = data.estadisticas_musicos.filter(m => {
      return !seccionesOrdenadas.some(seccion => seccion.test(m.instrumento));
    });

    if (musicosOtros.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      const tableDataOtros = musicosOtros.map(m => [
        m.nombre_completo,
        m.instrumento,
        `${m.total_asistencias} / ${m.total_eventos}`,
        `${m.porcentaje}%`,
        ''
      ]);
      autoTable(doc, {
        startY: currentY,
        head: [['Nombre del Músico', 'Sección', 'Asistencias', 'Porcentaje', 'Firma del Músico']],
        body: tableDataOtros,
        theme: 'grid',
        headStyles: { fillColor: [149, 165, 166], textColor: 255, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 50 }
        },
        styles: { fontSize: 9, valign: 'middle', minCellHeight: 12 },
        didDrawPage: function(data) {
          if (data.pageNumber === 1 || data.cursor.y === data.settings.startY) {
            doc.setFontSize(12);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "bold");
            doc.text("OTRAS SECCIONES", 14, data.settings.startY - 4);
          }
        },
        margin: { top: 30, left: 14, right: 14 }
      });
    }

    doc.save(`Elegibilidad_Canaston_${fechaInicio}_al_${fechaFin}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Módulo de Canastón
          </h1>
          <p className="text-gray-500">Evaluación de rendimiento y descuentos por macro-sección</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all outline-none"
                required
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all outline-none"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
            Calcular
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Descuentos por Macro Sección */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-red-500" />
            Descuentos (Jefes)
          </h2>
          {data.descuentos_secciones.map((seccion, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <span className="font-bold text-gray-800 text-lg">{seccion.macro_seccion}</span>
                <span className="font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                  ${seccion.total_descuentos.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Jefe(s): {seccion.jefes.length > 0 ? seccion.jefes.join(', ') : 'Sin asignar'}</span>
              </div>
            </div>
          ))}
          {data.descuentos_secciones.length === 0 && !loading && (
             <div className="text-center p-6 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
               No hay información para este período.
             </div>
          )}
        </div>

        {/* Tabla de Músicos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Medal className="w-6 h-6 text-blue-500" />
              Elegibilidad de Músicos
            </h2>
            <div className="flex items-center gap-3">
              <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-100">
                Total Eventos: {data.total_eventos_periodo}
              </div>
              <button
                onClick={exportToPDF}
                disabled={loading || data.estadisticas_musicos.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 text-sm shadow-sm"
                title="Exportar registros a PDF"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Músico</th>
                    <th className="px-6 py-4 font-medium">Sección</th>
                    <th className="px-6 py-4 font-medium text-center">Asistencias</th>
                    <th className="px-6 py-4 font-medium text-center">Porcentaje</th>
                    <th className="px-6 py-4 font-medium text-center">Canastón</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.estadisticas_musicos.length === 0 && !loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        No se encontraron músicos registrados en este rango
                      </td>
                    </tr>
                  ) : (
                    data.estadisticas_musicos.map((musico) => (
                      <tr key={musico.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {musico.nombre_completo}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-gray-900">{musico.instrumento}</span>
                            <span className="text-xs text-gray-400">{musico.macro_seccion}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium">
                          {musico.total_asistencias} / {musico.total_eventos}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Percent className="w-3 h-3 text-gray-400" />
                            <span className={`font-bold ${musico.es_elegible ? 'text-green-600' : 'text-orange-500'}`}>
                              {musico.porcentaje}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {musico.es_elegible ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <UserCheck className="w-3.5 h-3.5" />
                              Sí Gana
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <UserX className="w-3.5 h-3.5" />
                              No Gana
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
