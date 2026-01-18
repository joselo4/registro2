import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChefHat, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [pin, setPin] = useState('');
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const success = await login(pin);
    if (!success) {
        setError(true);
        setLoading(false);
        setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
            <div className="inline-flex bg-orange-600 p-4 rounded-2xl shadow-lg shadow-orange-900/50 mb-4">
                <ChefHat size={48} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">PIZZA SYSTEM</h1>
            <p className="text-gray-400 mt-2 text-sm">Ingresa tu PIN de acceso</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 bg-[#1e293b]/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">PIN de Seguridad</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                        type="password" 
                        value={pin}
                        onChange={(e) => { setPin(e.target.value); setError(false); }}
                        className={`w-full bg-[#0f172a] text-white text-center text-2xl font-bold py-4 rounded-xl border-2 outline-none transition-all placeholder-gray-700 ${error ? 'border-red-500 text-red-500' : 'border-gray-700 focus:border-orange-500'}`}
                        placeholder="••••"
                        maxLength={4}
                        inputMode="numeric"
                        autoFocus
                    />
                </div>
                {error && <p className="text-red-400 text-xs text-center font-bold">PIN Incorrecto</p>}
            </div>

            <button 
                type="submit" 
                disabled={loading || pin.length < 4}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
            >
                {loading ? 'Accediendo...' : 'INGRESAR'} 
                {!loading && <ArrowRight size={20}/>}
            </button>
        </form>
        
        <p className="text-center text-gray-600 text-xs mt-8">v2.0 Professional Edition</p>
      </div>
    </div>
  );
}