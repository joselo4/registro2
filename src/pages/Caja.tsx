import { useState } from 'react';
import { useStore } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Wallet, Smartphone, ArrowUpRight, ArrowDownLeft, Loader2, AlertCircle } from 'lucide-react';
import { getPeruDate, getPeruDateString } from '../utils';

const CATEGORIAS_GASTO = ['INSUMOS', 'LOGISTICA', 'PERSONAL', 'SERVICIOS', 'OTROS'];
const CATEGORIAS_INGRESO = ['VENTA_EXTRA', 'CAPITAL', 'DEVOLUCION', 'OTROS'];

export default function Caja() {
  const { addTransaction, getBalance } = useStore();
  const { user } = useAuth();
  
  // Estado para alternar entre GASTO e INGRESO
  const [mode, setMode] = useState<'GASTO' | 'INGRESO'>('GASTO');
  
  const [catSelected, setCatSelected] = useState('INSUMOS');
  const [method, setMethod] = useState<'EFECTIVO' | 'YAPE'>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(getPeruDateString()); // Fecha editable
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balances = getBalance();

  const handleSave = async () => {
    if (isSubmitting) return;
    
    const monto = Number(amount);
    if (!monto || monto <= 0) return alert("Ingrese un monto válido");

    // 1. VALIDACIÓN: Saldo (Solo para Gastos)
    if (mode === 'GASTO') {
        if (method === 'EFECTIVO' && monto > balances.efectivo) return alert(`Saldo Insuficiente en Efectivo (Disp: S/ ${balances.efectivo.toFixed(2)})`);
        if (method === 'YAPE' && monto > balances.yape) return alert(`Saldo Insuficiente en Yape (Disp: S/ ${balances.yape.toFixed(2)})`);
    }

    // 2. VALIDACIÓN: Descripción obligatoria para OTROS
    if ((catSelected === 'OTROS' || catSelected === 'VENTA_EXTRA') && !desc.trim()) {
        return alert("⚠️ Es obligatorio escribir un detalle/descripción para esta categoría.");
    }

    setIsSubmitting(true);

    try {
        // Lógica de fecha: Si es hoy, hora actual. Si es pasado, mediodía.
        let finalDateIso;
        if (date === getPeruDateString()) {
            finalDateIso = getPeruDate();
        } else {
            finalDateIso = `${date}T12:00:00-05:00`;
        }

        const success = await addTransaction({
          amount: monto,
          type: mode, // 'GASTO' o 'INGRESO'
          category: catSelected,
          method: method,
          description: desc || catSelected, // El detalle se guarda aquí
          user_name: user?.name || 'Anon',
          transaction_date: finalDateIso,
          status: 'ACTIVO'
        });

        if (success) {
            setAmount('');
            setDesc('');
            alert(`✅ ${mode} registrado correctamente`);
        } else {
            alert('❌ Error al registrar');
        }
    } catch (e) {
        console.error(e);
        alert('Error inesperado');
    } finally {
        setIsSubmitting(false);
    }
  };

  // Cambiar color según modo
  const themeColor = mode === 'GASTO' ? 'red' : 'green';
  const categorias = mode === 'GASTO' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;

  return (
    <div className="space-y-6 pb-20">
      {/* Switcher Header */}
      <div className="flex gap-2 bg-slate-800 p-1.5 rounded-2xl">
          <button onClick={() => { setMode('GASTO'); setCatSelected('INSUMOS'); }} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'GASTO' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
              <ArrowUpRight size={16}/> SALIDA / GASTO
          </button>
          <button onClick={() => { setMode('INGRESO'); setCatSelected('VENTA_EXTRA'); }} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'INGRESO' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}>
              <ArrowDownLeft size={16}/> INGRESO
          </button>
      </div>

      <div className={`p-6 rounded-3xl shadow-lg relative overflow-hidden transition-colors duration-300 ${mode === 'GASTO' ? 'bg-red-600 shadow-red-900/30' : 'bg-green-600 shadow-green-900/30'}`}>
        <div className="absolute -right-5 -top-5 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        <div>
           <div className={`text-${themeColor}-100 text-xs font-bold tracking-widest mb-1 opacity-80`}>REGISTRAR {mode}</div>
           <h2 className="text-3xl font-black text-white">S/ {amount || '0.00'}</h2>
        </div>
      </div>

      <div className="space-y-4">
        {/* Métodos */}
        <div className="bg-slate-800 p-1.5 rounded-2xl flex relative">
            {['EFECTIVO', 'YAPE'].map(m => {
                const active = method === m;
                return (
                    <button key={m} onClick={() => setMethod(m as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${active ? 'text-white shadow-lg' : 'text-slate-400'}`}>
                        {m === 'EFECTIVO' ? <Wallet size={14}/> : <Smartphone size={14}/>} {m}
                        {active && <div className={`absolute inset-0 rounded-xl -z-10 ${m === 'EFECTIVO' ? 'bg-blue-600' : 'bg-purple-600'}`}></div>}
                    </button>
                )
            })}
        </div>
        
        {/* Input Monto */}
        <div className="relative">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">S/</span>
             <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0f172a] text-white p-6 pl-14 rounded-3xl border border-slate-700 outline-none focus:border-blue-500 text-4xl font-black placeholder-slate-700 transition-colors"/>
        </div>

        {/* Categorías */}
        <div>
            <label className="text-xs text-slate-400 font-bold ml-2 mb-2 block">CATEGORÍA</label>
            <div className="flex flex-wrap gap-2">
            {categorias.map(c => (
                <button key={c} onClick={() => setCatSelected(c)} className={`text-[10px] px-4 py-3 rounded-xl border font-bold transition-all ${catSelected === c ? `bg-${themeColor}-600 border-${themeColor}-500 text-white` : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {c}
                </button>
            ))}
            </div>
        </div>

        {/* Descripción y Fecha */}
        <div className="grid grid-cols-1 gap-3">
             {/* Advertencia visual si se requiere detalle */}
            {(catSelected === 'OTROS' || catSelected === 'VENTA_EXTRA') && !desc && (
                <div className="flex items-center gap-2 text-yellow-500 text-xs font-bold ml-2 animate-pulse">
                    <AlertCircle size={12}/> Detalle obligatorio para esta categoría
                </div>
            )}
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detalle / Motivo..." className={`w-full bg-slate-800 border rounded-2xl p-4 text-sm text-white outline-none focus:border-slate-500 ${ (catSelected === 'OTROS' && !desc) ? 'border-yellow-500/50' : 'border-slate-700'}`}/>
            
            <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700">
                <span className="text-slate-400 text-xs font-bold ml-2">FECHA:</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1 text-right pr-2"/>
            </div>
        </div>

        <button 
            onClick={handleSave} 
            disabled={isSubmitting}
            className={`w-full bg-gradient-to-r ${mode === 'GASTO' ? 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400' : 'from-green-600 to-green-500 hover:from-green-500 hover:to-green-400'} text-white font-bold py-5 rounded-2xl shadow-lg transition-transform active:scale-95 text-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100`}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : `REGISTRAR ${mode}`}
        </button>
      </div>
    </div>
  );
}