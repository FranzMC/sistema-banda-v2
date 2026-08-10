import { useState, useEffect } from 'react';
import api from '../services/api';
import Financiamientos from '../components/Financiamientos';

export default function FinanciamientosPage() {
  const [musicos, setMusicos] = useState([]);

  const fetchMusicos = () => {
    api.get('/musicos/').then(res => setMusicos(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchMusicos();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row flex-wrap justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financiamientos</h1>
          <p className="text-gray-500 mt-1">Gestiona adelantos y financiamientos individuales para los músicos.</p>
        </div>
      </header>

      <Financiamientos musicos={musicos} />
    </div>
  );
}

