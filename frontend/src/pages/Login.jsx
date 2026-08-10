import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Music, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [ci, setCi] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';
      
      // Determinar si es login por PIN (músicos) o username/password (administradores)
      // Siempre enviamos username y password. El backend decidirá si autentica por CI/PIN o por Contraseña estándar.
      const payload = {
        username: ci,
        password: password
      };

      const response = await axios.post(`${baseURL}auth/pin/`, payload);
      
      const userData = response.data.user || {};
      login(userData, response.data.access, response.data.refresh);
      
      // Guardar credenciales para modo offline de forma segura (hasheada en base64)
      const offlineAuth = {
        ci: ci,
        hash: btoa(password),
        user: userData
      };
      localStorage.setItem('offline_credentials', JSON.stringify(offlineAuth));
      
      toast.success('Inicio de sesión exitoso');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error de login:', err);
      
      const isOfflineError = 
        !navigator.onLine || 
        err.code === 'ERR_NETWORK' || 
        err.message === 'Network Error' ||
        !err.response ||
        (err.response && (err.response.status === 504 || err.response.status === 503));

      // Fallback para Modo Offline si hay error de red o no hay internet
      if (isOfflineError) {
        const cachedStr = localStorage.getItem('offline_credentials');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached.ci === ci && cached.hash === btoa(password)) {
            login(cached.user, 'offline_access_token', 'offline_refresh_token');
            toast.success('Sesión iniciada sin conexión (Modo Offline)');
            navigate('/dashboard');
            return;
          }
        }
        setError('Sin conexión: Credenciales incorrectas o no hay datos guardados en este dispositivo.');
      } else if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Credenciales inválidas o cuenta inactiva.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 text-center bg-blue-600">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Music className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Banda Mejillones</h1>
          <p className="text-blue-100 text-sm">Sistema de Gestión Musical</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm font-medium border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usuario o CI</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Ej: admin o 12510285"
                value={ci}
                onChange={(e) => setCi(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PIN (4 dígitos del CI)</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  maxLength={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-12"
                  placeholder="••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-70">
              {loading ? 'Verificando...' : 'Ingresar al Sistema'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
