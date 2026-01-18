import { useState } from 'react';
import { useStore } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
// CORRECCIÓN: Se eliminó 'AlertCircle' de aquí porque no se usa
import { Wallet, Smartphone, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Loader2 } from 'lucide-react';
import { getPeruDate, getPeruDateString } from '../utils';

const CATEGORIAS_GASTO = ['INSUMOS', 'LOGISTICA', 'PERSONAL', 'SERVICIOS', 'OTROS'];
const CATEGORIAS_INGRESO = ['VENTA_EXTRA', 'CAPITAL', 'DEVOLUCION', 'OTROS'];

export default function Caja() {
  const { addTransaction, getBalance } = useStore();
  const { user } = useAuth();
  
  // Modos: GASTO, INGRESO, TRANSFERENCIA
  const [mode, setMode] = useState<'GASTO' | 'INGRESO' | 'TRANSFERENCIA'>('GASTO');
  
  const [catSelected, setCatSelected] = useState('INSUMOS');
  // En Transferencia, 'method' es el ORIGEN
  const [method, setMethod] = useState<'EFECTIVO' | 'YAPE'>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(getPeruDateString());
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const balances = getBalance();

  const handleSave = async () => {
    if (isSubmitting) return;
    const monto = Number(amount);
    if (!monto || monto <= 0) return alert("Ingrese un monto válido");

    // VALIDACIÓN DE SALDOS
    if (mode === 'GASTO' || mode === 'TRANSFERENCIA') {
        if (method === 'EFECTIVO' && monto > balances.efectivo) return alert(`Saldo Insuficiente en Efectivo (Disp: S/ ${balances.efectivo.toFixed(2)})`);
        if (method === 'YAPE' && monto > balances.yape) return alert(`Saldo Insuficiente en Yape (Disp: S/ ${balances.yape.toFixed(2)})`);
    }

    if (mode !== 'TRANSFERENCIA' && (catSelected === 'OTROS' || catSelected === 'VENTA_EXTRA') && !desc.trim()) {
        return alert("⚠️ Detalle obligatorio para esta categoría.");
    }

    setIsSubmitting(true);

    try {
        let finalDateIso = date === getPeruDateString() ? getPeruDate() : `${date}T12:00:00-05:00`;
        
        // LÓGICA PARA CONECTAR CON DATACONTEXT
        let finalType = mode;
        let finalCategory = catSelected;
        let finalDesc = desc;

        if (mode === 'TRANSFERENCIA') {
            // Enviamos las claves secretas que DataContext espera
            if (method === 'EFECTIVO') {
                finalCategory = 'EFECTIVO_A_YAPE'; 
                finalDesc = desc || 'Transferencia de Efectivo a Yape';
            } else {
                finalCategory = 'YAPE_A_EFECTIVO';
                finalDesc = desc || 'Transferencia de Yape a Efectivo';
            }
        } else if (!desc) {
            finalDesc = catSelected;
        }

        const success = await addTransaction({
          amount: monto,
          type: finalType as any, 
          category: finalCategory,
          method: method, 
          description: finalDesc,
          user_name: user?.name || 'Anon',
          transaction_date: finalDateIso,
          status: 'ACTIVO'
        });

        if (success) {
            setAmount(''); setDesc(''); alert(`✅ ${mode} registrado correctamente`);
        } else {
            alert('❌ Error al registrar');
        }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const getColor = () => {
      if (mode === 'GASTO') return 'red';
      if (mode === 'INGRESO') return 'green';
      return 'blue';
  };
  const theme = getColor();

  return (
    <div className="space-y-6 pb-24">
      <div className="flex gap-1 bg-slate-800 p-1.5 rounded-2xl overflow-x-auto">
          <button onClick={() => { setMode('GASTO'); setCatSelected('INSUMOS'); }} className={`flex-1 py-3 px-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 ${mode === 'GASTO' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>
              <ArrowUpRight size={14}/> GASTO
          </button>
          <button onClick={() => { setMode('INGRESO'); setCatSelected('VENTA_EXTRA'); }} className={`flex-1 py-3 px-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 ${mode === 'INGRESO' ? 'bg-green-600 text-white' : 'text-slate-400'}`}>
              <ArrowDownLeft size={14}/> INGRESO
          </button>
          <button onClick={() => { setMode('TRANSFERENCIA'); setDesc(''); }} className={`flex-1 py-3 px-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 ${mode === 'TRANSFERENCIA' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
              <ArrowRightLeft size={14}/> TRANSFERIR
          </button>
      </div>

      <div className={`p-6 rounded-3xl shadow-lg relative overflow-hidden transition-colors duration-300 bg-${theme}-600`}>
        <div className={`text-${theme}-100 text-xs font-bold tracking-widest mb-1 opacity-80 uppercase`}>
            {mode === 'TRANSFERENCIA' ? 'MOVER DINERO' : `REGISTRAR ${mode}`}
        </div>
        <h2 className="text-3xl font-black text-white">S/ {amount || '0.00'}</h2>
      </div>

      <div className="space-y-4">
        <div>
            <label className="text-xs text-slate-400 font-bold ml-2 mb-2 block">
                {mode === 'TRANSFERENCIA' ? 'ORIGEN (¿De dónde sale?)' : 'MÉTODO DE PAGO'}
            </label>
            <div className="bg-slate-800 p-1.5 rounded-2xl flex">
                {['EFECTIVO', 'YAPE'].map(m => (
                    <button key={m} onClick={() => setMethod(m as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${method === m ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}>
                        {m === 'EFECTIVO' ? <Wallet size={14}/> : <Smartphone size={14}/>} {m}
                    </button>
                ))}
            </div>
            {mode === 'TRANSFERENCIA' && (
                <div className="text-center text-xs text-blue-400 mt-2 font-bold animate-pulse">
                    Se moverá a: {method === 'EFECTIVO' ? 'YAPE 📱' : 'EFECTIVO 💵'}
                </div>
            )}
        </div>
        
        <div className="relative">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">S/</span>
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0f172a] text-white p-6 pl-14 rounded-3xl border border-slate-700 outline-none focus:border-blue-500 text-4xl font-black"/>
        </div>

        {mode !== 'TRANSFERENCIA' && (
            <div>
                <label className="text-xs text-slate-400 font-bold ml-2 mb-2 block">CATEGORÍA</label>
                <div className="flex flex-wrap gap-2">
                {(mode === 'GASTO' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map(c => (
                    <button key={c} onClick={() => setCatSelected(c)} className={`text-[10px] px-4 py-3 rounded-xl border font-bold transition-all ${catSelected === c ? `bg-${theme}-600 border-${theme}-500 text-white` : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                    {c}
                    </button>
                ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-3">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={mode === 'TRANSFERENCIA' ? "Nota opcional..." : "Detalle / Motivo..."} className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none"/>
            <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700">
                <span className="text-slate-400 text-xs font-bold ml-2">FECHA:</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1 text-right pr-2"/>
            </div>
        </div>

        <button onClick={handleSave} disabled={isSubmitting} className={`w-full bg-${theme}-600 hover:bg-${theme}-500 text-white font-bold py-5 rounded-2xl shadow-lg mt-4 flex justify-center items-center gap-2`}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : `CONFIRMAR ${mode}`}
        </button>
      </div>
    </div>
  );
}