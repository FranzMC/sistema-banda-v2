import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Check, X, Clock, Save, AlertTriangle } from 'lucide-react';

const TomaAsistenciaMovil = () => {
  const { idEvento } = useParams();
  const navigate = useNavigate();
  const [musicos, setMusicos] = useState([]);
  const [evento, setEvento] = useState(null);
  const [asistencias, setAsistencias] = useState({}); // idMusico -> { estado, hora_llegada }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [idEvento]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Cargar info del evento
      const evtRes = await api.get(`/eventos/${idEvento}/`);
      setEvento(evtRes.data);

      // Cargar músicos de la sección (el backend ya los filtra para el JEFE_SECCION)
      const musRes = await api.get('/musicos/?response=light');
      const data = musRes.data;
      setMusicos(Array.isArray(data) ? data : (data.results || []));

      // Precargar si ya hay asistencias guardadas
      const astRes = await api.get(`/asistencias/?evento=${idEvento}`);
      const astData = Array.isArray(astRes.data) ? astRes.data : (astRes.data.results || []);
      const astMap = {};
      astData.forEach(a => {
        astMap[a.musico] = {
          estado: a.estado,
          hora_llegada: a.hora_llegada
        };
      });
      setAsistencias(astMap);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos. Verifique conexión.');
      setLoading(false);
    }
  };

  const handleMarcar = (musicoId, estado) => {
    const horaActual = new Date().toTimeString().split(' ')[0].substring(0, 5);
    setAsistencias(prev => ({
      ...prev,
      [musicoId]: {
        estado,
        hora_llegada: estado !== 'AUSENTE' ? horaActual : null
      }
    }));
  };

  const handleGuardar = async () => {
    try {
      setSaving(true);
      // Convertir map a array
      const payload = Object.keys(asistencias).map(musicoId => ({
        musico_id: musicoId,
        estado: asistencias[musicoId].estado,
        hora_llegada: asistencias[musicoId].hora_llegada
      }));

      await api.post(`/eventos/${idEvento}/registrar_asistencia/`, { asistencias: payload });
      setSaving(false);
      navigate('/'); // Volver al dashboard
    } catch (err) {
      console.error(err);
      setError('Error al guardar asistencias.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header fijo para móvil */}
      <div className="bg-white shadow-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Asistencia</h1>
          <p className="text-sm text-gray-500 truncate">{evento?.titulo || 'Cargando evento...'}</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex gap-3">
            <AlertTriangle className="text-red-500 w-5 h-5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {musicos.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay músicos en su sección.</p>
          ) : (
            musicos.map(musico => {
              const ast = asistencias[musico.id] || {};
              const estado = ast.estado || null;

              return (
                <div key={musico.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">{musico.nombres} {musico.apellidos}</h3>
                      <p className="text-xs text-gray-500">{musico.instrumento}</p>
                    </div>
                  </div>
                  
                  {/* Botones de acción tipo Swipe/Toggle */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                      onClick={() => handleMarcar(musico.id, 'PRESENTE')}
                      className={`py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${
                        estado === 'PRESENTE' 
                          ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' 
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                      <span className="text-xs font-medium">Presente</span>
                    </button>
                    <button
                      onClick={() => handleMarcar(musico.id, 'TARDANZA')}
                      className={`py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${
                        estado === 'TARDANZA' 
                          ? 'bg-yellow-50 border-yellow-500 text-yellow-700 shadow-sm' 
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Clock className="w-5 h-5" />
                      <span className="text-xs font-medium">Atraso</span>
                    </button>
                    <button
                      onClick={() => handleMarcar(musico.id, 'AUSENTE')}
                      className={`py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${
                        estado === 'AUSENTE' 
                          ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' 
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <X className="w-5 h-5" />
                      <span className="text-xs font-medium">Falta</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Action Button (FAB) para guardar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 flex justify-center">
        <button
          onClick={handleGuardar}
          disabled={saving || musicos.length === 0}
          className="w-full max-w-lg bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>{saving ? 'Guardando...' : 'Guardar Asistencia'}</span>
        </button>
      </div>
    </div>
  );
};

export default TomaAsistenciaMovil;
