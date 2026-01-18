import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // CORRECCIÓN: Quitamos 'canAccess' de aquí porque no se usa en este archivo
  const { login } = useAuth(); 
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const success = await login(pin);

      if (success) {
        // Leemos directamente del storage para asegurar que tenemos los permisos frescos
        // (El estado de React podría tardar milisegundos en actualizarse)
        const savedUser = JSON.parse(localStorage.getItem('pizza_user') || '{}');
        const modules = savedUser.allowed_modules || [];

        // Lógica de Redirección según permisos
        if (savedUser.role === 'ADMIN' || modules.includes('VENTAS')) {
            navigate('/ventas'); 
        } else if (modules.includes('CAJA')) {
            navigate('/caja');
        } else {
            navigate('/'); // Fallback
        }
      } else {
        setErrorMsg('PIN incorrecto o usuario inactivo');
        setLoading(false);
        setPin(''); 
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
            <Lock className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">PIZZA SYSTEM</h1>
          <p className="text-slate-400 text-sm mt-1">Ingresa tu PIN de acceso</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setErrorMsg(''); }}
              className="w-full bg-slate-900 text-white text-center text-4xl font-bold tracking-[1em] py-4 rounded-2xl border border-slate-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all placeholder:tracking-normal"
              placeholder="••••"
              maxLength={4}
              disabled={loading}
              autoFocus
            />
          </div>
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 flex items-center gap-2 text-red-200 text-sm justify-center animate-pulse">
                <AlertCircle size={16} /> <span>{errorMsg}</span>
            </div>
          )}
          <button type="submit" disabled={loading || pin.length < 4} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="animate-spin" /> Accediendo...</> : "INGRESAR"}
          </button>
        </form>
      </div>
    </div>
  );
}