import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Save, CheckCircle, Clock } from 'lucide-react';
import Notification from './Notification';

export default function Financiamientos({ musicos }) {
  const [deudas, setDeudas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [filterSelection, setFilterSelection] = useState({ tipo: 'TODOS', seccion: 'TROMPETA', musico_id: '' });
  const [abonoMontos, setAbonoMontos] = useState({});
  const [notification, setNotification] = useState({ show: false, type: 'success', message: '' });
  const [deudaToDelete, setDeudaToDelete] = useState(null);

  const [nuevaDeuda, setNuevaDeuda] = useState({
     motivo: '',
     monto_total: '',
     aplicarA: 'TODOS',
     seccion: 'TROMPETA',
     musico_id: ''
  });

  const secciones = ['TROMPETA', 'CLARINETE', 'SAXOFON', 'BARITONO', 'TROMBON', 'TUBA', 'BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION', 'OTRO'];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const formatMonto = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return value;
    return numberValue.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const fetchDeudas = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = `/deudas/${query ? `?${query}` : ''}`;

    api.get(url)
      .then(res => setDeudas(res.data))
      .catch(err => console.error(err));
  };

  const getFilterParams = () => {
     if (filterSelection.tipo === 'MUSICO') {
        if (!filterSelection.musico_id) {
           return null;
        }
        return { musico_id: filterSelection.musico_id };
     }

     if (filterSelection.tipo === 'SECCION') {
        return { seccion: filterSelection.seccion };
     }

     return {};
  };

  const refreshDeudas = () => {
     const params = getFilterParams();
     setFilterApplied(true);

     if (params === null) {
        setDeudas([]);
        return;
     }

     fetchDeudas(params);
  };

  useEffect(() => {
     const params = filterSelection.tipo === 'MUSICO'
       ? filterSelection.musico_id ? { musico_id: filterSelection.musico_id } : null
       : filterSelection.tipo === 'SECCION'
         ? { seccion: filterSelection.seccion }
         : {};

     setFilterApplied(true);

     if (params === null) {
        setDeudas([]);
        return;
     }

     const query = new URLSearchParams(params).toString();
     const url = `/deudas/${query ? `?${query}` : ''}`;

     api.get(url)
       .then(res => setDeudas(res.data))
       .catch(err => console.error(err));
  }, [filterSelection]);

  const handleMostrarTodos = () => {
     setFilterSelection({ tipo: 'TODOS', seccion: 'TROMPETA', musico_id: '' });
  };

  const handleCrearDeuda = async () => {
     if (!nuevaDeuda.motivo || !nuevaDeuda.monto_total) {
         setNotification({ show: true, type: 'error', message: 'Completa el motivo y el monto total' });
         return;
     }

     let musicos_ids = [];
     if (nuevaDeuda.aplicarA === 'TODOS') {
         musicos_ids = musicos.map(m => m.id);
     } else if (nuevaDeuda.aplicarA === 'SECCION') {
         musicos_ids = musicos.filter(m => m.instrumento === nuevaDeuda.seccion).map(m => m.id);
         if (musicos_ids.length === 0) {
             setNotification({ show: true, type: 'error', message: 'No hay músicos en esta sección' });
             return;
         }
     } else {
         if (!nuevaDeuda.musico_id) {
             setNotification({ show: true, type: 'error', message: 'Selecciona un músico' });
             return;
         }
         musicos_ids = [nuevaDeuda.musico_id];
     }

     setLoading(true);
     try {
         await api.post('/deudas/crear_masivo/', {
             motivo: nuevaDeuda.motivo.toUpperCase(),
             monto_total: parseFloat(nuevaDeuda.monto_total),
             musicos_ids: musicos_ids
         });
         
         setNotification({ show: true, type: 'success', message: '¡Deuda agregada exitosamente!' });
         setShowModal(false);
         setNuevaDeuda({ motivo: '', monto_total: '', aplicarA: 'TODOS', seccion: 'TROMPETA', musico_id: '' });
         refreshDeudas();
     } catch (error) {
         console.error(error);
         setNotification({ show: true, type: 'error', message: 'Error al crear deuda' });
     } finally {
         setLoading(false);
     }
  };

  const handleAbonoMontoChange = (deudaId, value) => {
      setAbonoMontos(prev => ({ ...prev, [deudaId]: value }));
  };

  const handleRegistrarAbono = async (deudaId) => {
      const monto = parseFloat(abonoMontos[deudaId]);
      const deuda = deudas.find(d => d.id === deudaId);

      if (!deuda) {
          setNotification({ show: true, type: 'error', message: 'DEUDA NO ENCONTRADA' });
          return;
      }
      if (!monto || monto <= 0) {
          setNotification({ show: true, type: 'error', message: 'INGRESA UN MONTO VALIDO' });
          return;
      }
      if (monto > Number(deuda.saldo_restante)) {
          setNotification({ show: true, type: 'error', message: 'EL MONTO NO PUEDE SUPERAR EL SALDO PENDIENTE' });
          return;
      }

      setLoading(true);
      try {
          await api.post('/abonos/', {
              deuda: deudaId,
              monto: monto
          });

          setAbonoMontos(prev => ({ ...prev, [deudaId]: '' }));
          setNotification({ show: true, type: 'success', message: '¡ABONO REGISTRADO EXITOSAMENTE!' });
          refreshDeudas();
      } catch (error) {
          console.error(error);
          setNotification({ show: true, type: 'error', message: 'Error al registrar el abono' });
      } finally {
          setLoading(false);
      }
  };

  const handleEliminarDeuda = (id) => {
      setDeudaToDelete(id);
  };

  const confirmDeleteDeuda = async () => {
      if (!deudaToDelete) return;

      setLoading(true);
      try {
          await api.delete(`/deudas/${deudaToDelete}/`);
          setNotification({ show: true, type: 'success', message: '¡DEUDA ELIMINADA CORRECTAMENTE!' });
          setDeudaToDelete(null);
          refreshDeudas();
      } catch (error) {
          console.error(error);
          setNotification({ show: true, type: 'error', message: 'ERROR AL ELIMINAR LA DEUDA!' });
          setDeudaToDelete(null);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-xl font-bold text-gray-800">Deudas y Abonos por Músico</h3>
           <p className="text-sm text-gray-500">Administra la deuda total de cada músico y registra abonos parciales directamente en la tabla.</p>
        </div>
        <button 
           onClick={() => setShowModal(true)}
           className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
        >
           <Plus className="w-5 h-5" /> Nueva Deuda
        </button>
      </div>

      <div className="mb-6 p-5 bg-violet-50 border border-violet-100 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">Filtrar financiamientos</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterSelection({ ...filterSelection, tipo: 'SECCION', musico_id: '' })}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${filterSelection.tipo === 'SECCION' ? 'bg-white text-violet-700 shadow' : 'bg-violet-100 text-violet-600'}`}>
                Sección
              </button>
              <button
                type="button"
                onClick={() => setFilterSelection({ ...filterSelection, tipo: 'MUSICO' })}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${filterSelection.tipo === 'MUSICO' ? 'bg-white text-violet-700 shadow' : 'bg-violet-100 text-violet-600'}`}>
                Músico
              </button>
              <button
                type="button"
                onClick={() => setFilterSelection({ tipo: 'TODOS', seccion: 'TROMPETA', musico_id: '' })}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${filterSelection.tipo === 'TODOS' ? 'bg-white text-violet-700 shadow' : 'bg-violet-100 text-violet-600'}`}>
                Todos
              </button>
            </div>
          </div>

          <div className="flex-1">
            {filterSelection.tipo === 'SECCION' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Sección</label>
                <select
                  value={filterSelection.seccion}
                  onChange={e => setFilterSelection({ ...filterSelection, seccion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {secciones.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {filterSelection.tipo === 'MUSICO' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Músico</label>
                <select
                  value={filterSelection.musico_id}
                  onChange={e => setFilterSelection({ ...filterSelection, musico_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">-- Seleccionar músico --</option>
                  {musicos.map(m => (
                    <option key={m.id} value={m.id}>{`${m.nombres} ${m.apellidos}`}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={handleMostrarTodos}
              className="px-4 py-2 bg-white border border-violet-200 text-violet-700 rounded-xl font-semibold hover:bg-violet-50 transition-colors"
            >Ver todos</button>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">Selecciona una sección o un músico y la tabla se actualizará automáticamente.</p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
         <div className="px-4 py-3 text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
            Ingresa un monto y pulsa «Abonar» para registrar el pago parcial. El saldo pendiente se actualiza automáticamente.
         </div>
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700">
               <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Músico</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Motivo / Concepto</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Deuda Total</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right text-green-600">Pagado</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right text-red-500">Pendiente</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Estado</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-end">Acciones</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {filterApplied && deudas.map(deuda => (
                  <tr key={deuda.id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-4 py-3 font-medium text-gray-500">{deuda.fecha_creacion}</td>
                     <td className="px-4 py-3 font-bold text-gray-800 text-xs md:text-sm whitespace-normal break-words">{deuda.musico_nombre}</td>
                     <td className="px-4 py-3 text-gray-700">{deuda.motivo}</td>
                     <td className="px-4 py-3 text-right font-bold text-gray-700">Bs. {formatMonto(deuda.monto_total)}</td>
                     <td className="px-4 py-3 text-right font-bold text-green-600">Bs. {formatMonto(deuda.monto_pagado)}</td>
                     <td className="px-4 py-3 text-right font-black text-red-500">Bs. {formatMonto(deuda.saldo_restante)} pendiente</td>
                     <td className="px-4 py-3 text-center">
                        {deuda.estado === 'PAGADA' ? (
                           <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800"><CheckCircle className="w-3 h-3"/> Pagada</span>
                        ) : (
                           <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800"><Clock className="w-3 h-3"/> Pendiente</span>
                        )}
                     </td>
                     <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-2">
                           <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={abonoMontos[deuda.id] || ''}
                                onChange={e => handleAbonoMontoChange(deuda.id, e.target.value)}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-right border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRegistrarAbono(deuda.id)}
                                className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={deuda.estado === 'PAGADA' || loading}
                              >
                                Abonar
                              </button>
                           </div>
                           <button
                              type="button"
                              onClick={() => handleEliminarDeuda(deuda.id)}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                           >
                              Eliminar
                           </button>
                        </div>
                     </td>
                  </tr>
               ))}
               {filterSelection.tipo === 'MUSICO' && !filterSelection.musico_id ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-500">Selecciona un músico para ver sus deudas.</td></tr>
               ) : (
                  deudas.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-gray-500">No hay financiamientos registrados para este filtro.</td></tr>
               )}
            </tbody>
         </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-1">Registrar Nueva Deuda</h3>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Motivo / Concepto</label>
                  <input 
                     type="text" 
                     value={nuevaDeuda.motivo} 
                     onChange={e => setNuevaDeuda({...nuevaDeuda, motivo: e.target.value})}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                     placeholder="Ej: COMPRA DE BARITONO"
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Monto Total a Pagar (Bs)</label>
                  <p className="text-[10px] text-gray-500 mb-1 leading-tight">Monto BASE o promedio. (Ej: 1700). Si alguien debe menos porque ya dio un adelanto, no te preocupes: una vez creada la deuda podrás editar el saldo restante de cada músico haciendo clic en su botón Editar.</p>
                  <input 
                     type="number" 
                     value={nuevaDeuda.monto_total} 
                     onChange={e => setNuevaDeuda({...nuevaDeuda, monto_total: e.target.value})}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                     placeholder="0.00"
                  />
               </div>

               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">A quien se aplicara esta deuda...?</label>
                  <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-lg">
                     <button onClick={() => setNuevaDeuda({...nuevaDeuda, aplicarA: 'SECCION'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaDeuda.aplicarA === 'SECCION' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Por Seccion</button>
                     <button onClick={() => setNuevaDeuda({...nuevaDeuda, aplicarA: 'INDIVIDUAL'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaDeuda.aplicarA === 'INDIVIDUAL' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Individual</button>
                     <button onClick={() => setNuevaDeuda({...nuevaDeuda, aplicarA: 'TODOS'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${nuevaDeuda.aplicarA === 'TODOS' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>A Todos</button>
                  </div>

                  {nuevaDeuda.aplicarA === 'SECCION' && (
                     <select value={nuevaDeuda.seccion} onChange={e => setNuevaDeuda({...nuevaDeuda, seccion: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                        {secciones.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  )}

                  {nuevaDeuda.aplicarA === 'INDIVIDUAL' && (
                     <select value={nuevaDeuda.musico_id} onChange={e => setNuevaDeuda({...nuevaDeuda, musico_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">-- Seleccionar músico --</option>
                        {musicos.map(m => <option key={m.id} value={m.id}>{m.nombres} {m.apellidos}</option>)}
                     </select>
                  )}
               </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCrearDeuda}
                disabled={loading}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4"/> {loading ? 'Guardando...' : 'Guardar Deuda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deudaToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar Deuda?</h3>
            <p className="text-gray-600 mb-6">Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar esta deuda?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeudaToDelete(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteDeuda}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Eliminando...' : 'Sí, Eliminar'}
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

