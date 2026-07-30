import React, { useState, useEffect } from 'react';
import { Key, User, Phone, Lock, Save, Loader2, MapPin, Calendar, CreditCard, Shirt } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Configuracion() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    documento_identidad: '',
    first_name: '',
    last_name: '',
    telefono: '',
    fecha_nacimiento: '',
    direccion: '',
    talla_camisa: '',
    talla_chamarra: '',
    numero_calzado: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        documento_identidad: user.musico_data?.documento_identidad || '',
        telefono: user.musico_data?.telefono || '',
        fecha_nacimiento: user.musico_data?.fecha_nacimiento || '',
        direccion: user.musico_data?.direccion || '',
        talla_camisa: user.musico_data?.talla_camisa || '',
        talla_chamarra: user.musico_data?.talla_chamarra || '',
        numero_calzado: user.musico_data?.numero_calzado || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si es contraseña, permitir solo números y máximo 4 dígitos
    if (name === 'password') {
      const pinValue = value.replace(/\D/g, '').slice(0, 4);
      setFormData(prev => ({ ...prev, [name]: pinValue }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSend = { ...formData };
      
      if (!dataToSend.password) {
        delete dataToSend.password;
      } else if (dataToSend.password.length !== 4) {
        toast.error("El PIN debe ser exactamente de 4 dígitos.");
        setLoading(false);
        return;
      }
      
      const response = await api.patch('/auth/me/', dataToSend);
      toast.success('Perfil actualizado correctamente. Los cambios se reflejarán completamente al reiniciar sesión.');
      
      if (dataToSend.password) {
        setFormData(prev => ({ ...prev, password: '' }));
      }
    } catch (error) {
      console.error(error);
      let errorMsg = 'Error al actualizar el perfil';
      if (error.response?.data) {
        if (typeof error.response.data === 'object' && !error.response.data.error) {
           // Extracting DRF errors
           const firstKey = Object.keys(error.response.data)[0];
           errorMsg = error.response.data[firstKey][0] || errorMsg;
        } else {
           errorMsg = error.response.data.error || errorMsg;
        }
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" />
            Configuración de Perfil
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Actualiza tus datos personales y credenciales de acceso.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">C.I. / Documento de Identidad</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="documento_identidad"
                  value={formData.documento_identidad}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. 1234567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. Juan Carlos"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / Celular</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. 70000000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. Av. Principal 123"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Talla de Camisa</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shirt className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="talla_camisa"
                  value={formData.talla_camisa}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. M"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Talla de Chamarra</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shirt className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="talla_chamarra"
                  value={formData.talla_chamarra}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. L"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Calzado</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shirt className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="numero_calzado"
                  value={formData.numero_calzado}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. 40"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border bg-gray-50"
                  placeholder="Usuario para iniciar sesión"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña (PIN 4 dígitos)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  maxLength={4}
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 block w-full md:w-1/2 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
                  placeholder="Ej. 1234 (Dejar en blanco para no cambiar)"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Solo se permiten 4 números.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
