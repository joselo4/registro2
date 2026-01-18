import { useState } from 'react';
import { useStore } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Wallet, Smartphone, ArrowUpRight, Loader2 } from 'lucide-react';
import { getPeruDate, getPeruDateString } from '../utils';

const CATEGORIAS = ['INSUMOS', 'LOGISTICA', 'PERSONAL', 'SERVICIOS', 'OTROS'];

export default function Caja() {
  const { addTransaction, getBalance } = useStore();
  const { user } = useAuth();
  
  const [catSelected, setCatSelected] = useState('INSUMOS');
  const [method, setMethod] = useState<'EFECTIVO' | 'YAPE'>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  
  // Usamos el helper de fecha Perú string (YYYY-MM-DD)
  const [date, setDate] = useState(getPeruDateString());
  
  // Bloqueo de botón
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balances = getBalance();

  const handleSave = async () => {
    if (isSubmitting) return; // Bloqueo
    
    const monto = Number(amount);
    if (!monto || monto <= 0) return alert("Ingrese un monto válido");

    if (method === 'EFECTIVO' && monto > balances.efectivo) return alert(`Saldo Insuficiente en Efectivo (Disp: S/ ${balances.efectivo.toFixed(2)})`);
    if (method === 'YAPE' && monto > balances.yape) return alert(`Saldo Insuficiente en Yape (Disp: S/ ${balances.yape.toFixed(2)})`);

    setIsSubmitting(true);

    try {
        // Construimos la fecha completa con hora actual Perú
        // Si el usuario no cambió la fecha, usamos getPeruDate() completo para tener la hora actual
        // Si cambió la fecha (es distinta a hoy), le ponemos hora 12:00 para evitar cambios de día
        let finalDateIso;
        if (date === getPeruDateString()) {
            finalDateIso = getPeruDate(); // Hora exacta actual
        } else {
            finalDateIso = `${date}T12:00:00-05:00`; // Mediodía del día seleccionado
        }

        const success = await addTransaction({
          amount: monto,
          type: 'GASTO',
          category: catSelected,
          method: method,
          description: desc || catSelected,
          user_name: user?.name || 'Anon',
          transaction_date: finalDateIso,
          status: 'ACTIVO'
        });

        if (success) {
            setAmount('');
            setDesc('');
            alert('✅ Gasto registrado');
        } else {
            alert('❌ Error al registrar');
        }
    } catch (e) {
        alert('Error inesperado');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-600 p-6 rounded-3xl shadow-lg shadow-red-900/30 flex justify-between items-center relative overflow-hidden">
        <div className="absolute -right-5 -top-5 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        <div>
           <div className="text-red-100 text-xs font-bold tracking-widest mb-1 opacity-80">REGISTRAR SALIDA</div>
           <h2 className="text-3xl font-black text-white">GASTO</h2>
        </div>
        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
            <ArrowUpRight className="text-white" size={28} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-800 p-1.5 rounded-2xl flex relative">
            {['EFECTIVO', 'YAPE'].map(m => {
                const active = method === m;
                return (
                    <button
                        key={m}
                        onClick={() => setMethod(m as any)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${active ? 'text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        {m === 'EFECTIVO' ? <Wallet size={14}/> : <Smartphone size={14}/>} {m}
                        {active && <div className={`absolute inset-0 rounded-xl -z-10 ${m === 'EFECTIVO' ? 'bg-green-600' : 'bg-purple-600'}`}></div>}
                    </button>
                )
            })}
        </div>
        
        <div className="relative">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">S/</span>
             <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0f172a] text-white p-6 pl-14 rounded-3xl border border-slate-700 outline-none focus:border-red-500 text-4xl font-black placeholder-slate-700 transition-colors"/>
        </div>

        <div>
            <label className="text-xs text-slate-400 font-bold ml-2 mb-2 block">CATEGORÍA</label>
            <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map(c => (
                <button key={c} onClick={() => setCatSelected(c)} className={`text-[10px] px-4 py-3 rounded-xl border font-bold transition-all ${catSelected === c ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{c}</button>
            ))}
            </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detalle opcional..." className="col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-slate-500"/>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-2xl p-2 text-xs text-center text-white outline-none"/>
        </div>

        <button 
            onClick={handleSave} 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-5 rounded-2xl shadow-lg shadow-red-900/40 transition-transform active:scale-95 text-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : "REGISTRAR GASTO"}
        </button>
      </div>
    </div>
  );
}