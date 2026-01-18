import { useState } from 'react';
import { useStore } from '../context/DataContext';
import { Calendar, Wallet, Smartphone, DollarSign, CheckCircle2, Loader2 } from 'lucide-react';
import { getPeruDate } from '../utils';

const Ventas = () => {
  const { products, addTransaction, loading, getBalance } = useStore();
  const [date, setDate] = useState(getPeruDate().split('T')[0]);
  const [totals, setTotals] = useState<Record<string, { efectivo: string; yape: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado de carga local

  const balances = getBalance();

  const handleInputChange = (productId: string, field: 'efectivo' | 'yape', value: string) => {
    if (Number(value) < 0) return;
    setTotals(prev => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  };

  const calculateInputTotal = () => {
    let sum = 0;
    Object.values(totals).forEach(val => { sum += Number(val?.efectivo || 0) + Number(val?.yape || 0); });
    return sum.toFixed(2);
  };

  const hasData = Number(calculateInputTotal()) > 0;

  const handleSave = async () => {
    if (isSubmitting) return; // Evitar doble click
    setIsSubmitting(true);

    try {
        const promises = Object.entries(totals).map(async ([productId, values]) => {
          const efectivo = Number(values?.efectivo || 0);
          const yape = Number(values?.yape || 0);
          const total = efectivo + yape;

          if (total <= 0) return;
          const product = products.find(p => p.id === productId);
          
          let method: 'EFECTIVO' | 'YAPE' | 'MIXTO' = 'EFECTIVO';
          if (efectivo > 0 && yape > 0) method = 'MIXTO';
          else if (yape > 0) method = 'YAPE';

          await addTransaction({
            amount: total, type: 'INGRESO', category: product?.name || 'Venta',
            method: method, method_details: { efectivo, yape },
            user_name: 'ADMIN', transaction_date: new Date(date).toISOString(), status: 'ACTIVO'
          });
        });

        if (promises.length === 0) {
            alert("Ingrese un monto válido");
            return;
        }

        await Promise.all(promises);
        setTotals({});
        alert("¡Venta Registrada!");
    } catch (e) {
        alert("Error al guardar venta");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-orange-500 font-bold animate-pulse">Cargando sistema...</div>;

  return (
    <div className="space-y-5">
      {/* Tarjeta de Saldos */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         
         <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
                <p className="text-slate-400 text-xs font-bold tracking-wider mb-1">SALDO ACTUAL</p>
                <h2 className="text-3xl font-black text-white">S/ {(balances.efectivo + balances.yape).toFixed(2)}</h2>
            </div>
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm relative">
                <Calendar size={20} className="text-orange-400"/>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-3 relative z-10">
            <div className="bg-[#0f172a]/50 p-3 rounded-2xl flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2">
                    <div className="bg-green-500/20 p-1.5 rounded-lg"><Wallet size={14} className="text-green-400"/></div>
                    <span className="text-xs text-slate-300 font-medium">Efectivo</span>
                </div>
                <span className="font-bold text-green-400 text-sm">{balances.efectivo.toFixed(2)}</span>
            </div>
            <div className="bg-[#0f172a]/50 p-3 rounded-2xl flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-500/20 p-1.5 rounded-lg"><Smartphone size={14} className="text-purple-400"/></div>
                    <span className="text-xs text-slate-300 font-medium">Yape</span>
                </div>
                <span className="font-bold text-purple-400 text-sm">{balances.yape.toFixed(2)}</span>
            </div>
         </div>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 gap-3">
        {products.map(product => {
            const currentEfectivo = totals[product.id]?.efectivo;
            const currentYape = totals[product.id]?.yape;
            const isActive = currentEfectivo || currentYape;

            return (
                <div key={product.id} className={`p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-slate-800 border-orange-500/50 shadow-lg shadow-orange-500/5' : 'bg-slate-800/50 border-white/5 hover:border-white/10'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full shadow-[0_0_8px] ${product.color} shadow-${product.color.replace('bg-', '')}/50`}></div>
                            <span className="font-bold text-white text-lg">{product.name}</span>
                        </div>
                        {isActive && <CheckCircle2 size={18} className="text-orange-500 animate-in zoom-in"/>}
                    </div>
                    
                    <div className="flex gap-3">
                        <div className="flex-1 relative group">
                            <label className="absolute -top-2 left-2 bg-slate-800 px-1 text-[9px] font-bold text-green-500">EFECTIVO</label>
                            <input type="number" inputMode="decimal" placeholder="0" value={currentEfectivo || ''} onChange={(e) => handleInputChange(product.id, 'efectivo', e.target.value)} className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 outline-none focus:border-green-500 text-right font-mono font-bold text-lg placeholder-slate-600 transition-colors"/>
                        </div>
                        <div className="flex-1 relative group">
                            <label className="absolute -top-2 left-2 bg-slate-800 px-1 text-[9px] font-bold text-purple-500">YAPE</label>
                            <input type="number" inputMode="decimal" placeholder="0" value={currentYape || ''} onChange={(e) => handleInputChange(product.id, 'yape', e.target.value)} className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 outline-none focus:border-purple-500 text-right font-mono font-bold text-lg placeholder-slate-600 transition-colors"/>
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      {/* Botón Flotante Total */}
      <div className={`fixed bottom-24 left-0 w-full px-4 transition-all duration-300 transform ${hasData ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl shadow-2xl shadow-orange-900/50 flex items-center justify-between px-6 border border-orange-400/30 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? (
                <div className="w-full flex justify-center"><Loader2 className="animate-spin" size={24}/></div>
            ) : (
                <>
                    <div className="flex items-center gap-2 font-bold text-orange-100">
                        <div className="bg-white/20 p-1 rounded-lg"><DollarSign size={20}/></div>
                        CONFIRMAR
                    </div>
                    <div className="text-2xl font-black">S/ {calculateInputTotal()}</div>
                </>
            )}
          </button>
      </div>
    </div>
  );
};
export default Ventas;