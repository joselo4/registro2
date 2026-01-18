import { useState, useMemo } from 'react';
import { useStore } from '../context/DataContext';
import { Edit2, ArrowRightLeft, FileSpreadsheet, Wallet, Smartphone, ShoppingBag } from 'lucide-react';
import { supabase } from '../supabase';
import { formatPeruDate, getPeruDateString } from '../utils';

export default function Historial() {
  const { transactions, refreshData } = useStore();
  
  const [dateStart, setDateStart] = useState(getPeruDateString());
  const [dateEnd, setDateEnd] = useState(getPeruDateString());
  const [typeFilter, setTypeFilter] = useState('TODO');

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [justification, setJustification] = useState('');

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDateStr = t.transaction_date || t.created_at || '';
      const dateObj = new Date(tDateStr);
      const peruDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(dateObj); 
      
      const isDateMatch = peruDateStr >= dateStart && peruDateStr <= dateEnd;
      const isTypeMatch = typeFilter === 'TODO' || (typeFilter === 'ANULADO' ? t.status === 'ANULADO' : t.type === typeFilter && t.status !== 'ANULADO');

      return isDateMatch && isTypeMatch;
    });
  }, [transactions, dateStart, dateEnd, typeFilter]);

  const handleVoid = async () => {
    if (!editingItem || !justification) return alert("Justificación requerida");
    await supabase.from('transactions').update({ status: 'ANULADO', justification: justification }).eq('id', editingItem.id);
    setEditingItem(null); setJustification(''); refreshData();
  };

  const exportExcel = () => {
      if(filteredData.length === 0) return alert("No hay datos para exportar");
      const headers = "Fecha;Hora;Usuario;Tipo;Categoria;Metodo;Monto Total;Efectivo;Yape;Estado;Motivo\n";
      const rows = filteredData.map(t => {
          const dtFull = formatPeruDate(t.transaction_date || t.created_at!);
          const [fecha, hora] = dtFull.split(' ');
          const efectivo = t.method_details?.efectivo || (t.method === 'EFECTIVO' ? t.amount : 0);
          const yape = t.method_details?.yape || (t.method === 'YAPE' ? t.amount : 0);
          
          return [fecha, hora, t.user_name, t.type, `"${t.category}"`, t.method, Number(t.amount).toFixed(2).replace('.', ','), Number(efectivo).toFixed(2).replace('.', ','), Number(yape).toFixed(2).replace('.', ','), t.status, `"${t.justification || ''}"`].join(';');
      }).join('\n');
      const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reporte.csv`;
      link.click();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-[#1e293b] p-4 rounded-3xl border border-gray-700 space-y-3 shadow-lg">
         <div className="flex items-center gap-2">
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-[#0f172a] text-xs p-3 rounded-xl text-white flex-1 outline-none border border-gray-700"/>
            <span className="text-gray-500 font-bold">-</span>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-[#0f172a] text-xs p-3 rounded-xl text-white flex-1 outline-none border border-gray-700"/>
         </div>
         <div className="flex gap-2">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="flex-1 bg-[#0f172a] text-white text-xs p-3 rounded-xl outline-none border border-gray-700 font-bold">
                <option value="TODO">TODO</option>
                <option value="INGRESO">INGRESOS</option>
                <option value="GASTO">GASTOS</option>
                <option value="TRANSFERENCIA">TRANSFERENCIAS</option>
                <option value="ANULADO">ANULADOS</option>
            </select>
            <button onClick={exportExcel} className="bg-green-600 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-transform"><FileSpreadsheet size={20}/></button>
         </div>
      </div>

      <div className="space-y-3">
        {filteredData.map(t => (
          <div key={t.id} className={`p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden transition-all ${t.status === 'ANULADO' ? 'bg-red-900/10 border-red-900/50 opacity-70' : 'bg-[#1e293b] border-gray-800 shadow-sm'}`}>
            {t.status === 'ANULADO' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-red-500/10 font-black text-5xl uppercase -rotate-12">ANULADO</span></div>}
            
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-xs font-bold text-white uppercase mb-1.5 flex items-center gap-2">
                        {t.type === 'TRANSFERENCIA' ? <ArrowRightLeft size={14} className="text-blue-400"/> : t.type === 'INGRESO' ? <ShoppingBag size={14} className="text-green-400"/> : null}
                        {t.category}
                    </div>
                    <div className="text-[11px] text-slate-300 italic mb-2 leading-snug">
                        {t.description || "Sin detalle"}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 font-medium">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">{formatPeruDate(t.transaction_date || t.created_at!)}</span>
                        <span>{t.user_name}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`font-black text-base ${t.type === 'INGRESO' ? 'text-green-500' : t.type === 'GASTO' ? 'text-red-500' : 'text-blue-500'}`}>
                        {t.type === 'INGRESO' ? '+' : t.type === 'GASTO' ? '-' : ''} S/ {Number(t.amount).toFixed(2)}
                    </div>
                </div>
            </div>

            {(t.type === 'INGRESO' || t.type === 'GASTO' || t.type === 'TRANSFERENCIA') && (
                <div className="bg-[#0f172a]/60 p-2 rounded-lg flex justify-between items-center text-[10px] border border-white/5">
                    {t.method === 'MIXTO' && t.method_details ? (
                        <>
                            <div className="flex items-center gap-1 text-green-400 font-bold"><Wallet size={10}/> Efec: S/ {Number(t.method_details.efectivo).toFixed(2)}</div>
                            <div className="flex items-center gap-1 text-purple-400 font-bold"><Smartphone size={10}/> Yape: S/ {Number(t.method_details.yape).toFixed(2)}</div>
                        </>
                    ) : (
                        <div className={`flex items-center gap-1 w-full font-bold ${t.method === 'EFECTIVO' ? 'text-green-400' : 'text-purple-400'}`}>
                            {t.method === 'EFECTIVO' ? <Wallet size={12}/> : <Smartphone size={12}/>}
                            {t.method}
                        </div>
                    )}
                </div>
            )}

            {t.status !== 'ANULADO' && (
                <button onClick={() => setEditingItem(t)} className="self-end flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg hover:text-white hover:bg-slate-700 transition-colors">
                    <Edit2 size={10}/> Editar
                </button>
            )}
          </div>
        ))}
      </div>
      
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] px-4 backdrop-blur-sm">
          <div className="bg-[#1e293b] p-6 rounded-3xl w-full max-w-sm border border-gray-700 shadow-2xl">
             <h3 className="text-white font-bold mb-1 text-lg">Anular Operación</h3>
             <textarea className="w-full bg-[#0f172a] text-white p-4 rounded-2xl mb-4 text-sm outline-none border border-gray-700 h-24" placeholder="Justificación..." value={justification} onChange={e => setJustification(e.target.value)}/>
             <div className="flex gap-3">
                <button onClick={() => setEditingItem(null)} className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold">Cancelar</button>
                <button onClick={handleVoid} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">ANULAR</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}