import { useState, useEffect } from 'react';
import api from '../services/api';
import { CalendarDays, Wallet } from 'lucide-react';
import LiquidarEvento from '../components/LiquidarEvento';

export default function Finanzas() {
  const [musicos, setMusicos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [selectedEvento, setSelectedEvento] = useState(() => {
    return window.localStorage.getItem('finanzas_selected_evento') || '';
  });

  useEffect(() => {
    window.localStorage.setItem('finanzas_selected_evento', selectedEvento);
  }, [selectedEvento]);

  const fetchDatos = () => {
    api.get('/musicos/').then(res => setMusicos(res.data)).catch(console.error);
    api.get('/eventos/').then(res => setEventos(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-600" />
            Liquidación Masiva
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los pagos por contrato de manera masiva.</p>
        </div>
        
        <div className="flex gap-3">
          <select 
            value={selectedEvento} 
            onChange={(e) => setSelectedEvento(e.target.value)}
            className="px-4 py-2 border-2 border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px] font-bold text-gray-800 shadow-sm bg-white"
          >
            <option value="">-- Seleccione un Contrato --</option>
            {eventos.map(e => <option key={e.id} value={e.id}>{e.titulo} ({new Date(e.fecha_hora_cita).toLocaleDateString()})</option>)}
          </select>
        </div>
      </header>
      
      {/* Content */}
      <div className="transition-all mt-4">
         <LiquidarEvento 
            eventos={eventos} 
            musicos={musicos} 
            selectedEvento={selectedEvento} 
            setSelectedEvento={setSelectedEvento} 
            onPlanillaGuardada={fetchDatos} 
         />
      </div>
    </div>
  );
}
