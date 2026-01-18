import { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/DataContext';
import { supabase } from '../supabase';
import { getPeruDate } from '../utils';
import { Trash2, Plus, User, Box, Coffee, Settings, Save, X, Edit2, ArrowRightLeft, ShieldAlert, Download, Database, Upload, Send, Loader2 } from 'lucide-react';

export default function Admin() {
  const { products, stockItems, appUsers, config, addTransaction, updateConfig, refreshData, getBalance } = useStore();
  const [tab, setTab] = useState('PRODUCTOS');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados y Config
  const [newProd, setNewProd] = useState({ name: '', color: 'bg-blue-600' });
  const [newStock, setNewStock] = useState({ name: '', priority: 'INSUMO' });
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'EMPLEADO' });
  const [transferAmount, setTransferAmount] = useState('');
  const [sysConfig, setSysConfig] = useState({ business_name: '', telegram_token: '', telegram_chat_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Estado Global de Carga
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
        setSysConfig({ 
            business_name: config.business_name || '', 
            telegram_token: config.telegram_token || '', 
            telegram_chat_id: config.telegram_chat_id || '' 
        });
    }
  }, [config]);

  // Helper para envolver acciones async
  const runAction = async (action: () => Promise<void>) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try { await action(); } catch (e) { console.error(e); alert("Error inesperado"); } finally { setIsSubmitting(false); }
  };

  // --- CONFIG OPS ---
  const saveSystemConfig = () => runAction(async () => {
      const success = await updateConfig({ ...sysConfig, id: config?.id });
      if (success) alert("✅ Configuración guardada.");
      else alert("❌ Error al guardar.");
  });

  // --- DB & TELEGRAM OPS ---
  const getBackupData = () => ({ date: getPeruDate(), config, products, stockItems, appUsers, transactions: [] });

  const downloadBackup = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getBackupData()));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `backup_${config.business_name}_${Date.now()}.json`;
      a.click();
  };

  const sendToTelegram = () => runAction(async () => {
      if(!sysConfig.telegram_token || !sysConfig.telegram_chat_id) return alert("Falta configurar Telegram.");
      
      const backupData = JSON.stringify(getBackupData(), null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const formData = new FormData();
      formData.append('chat_id', sysConfig.telegram_chat_id);
      formData.append('document', blob, `backup_${getPeruDate().split('T')[0]}.json`);

      try {
          const res = await fetch(`https://api.telegram.org/bot${sysConfig.telegram_token}/sendDocument`, {
              method: 'POST', body: formData
          });
          const data = await res.json();
          if(data.ok) alert("✅ Backup enviado a Telegram.");
          else alert("❌ Error Telegram: " + data.description);
      } catch (e) { alert("Error de conexión"); }
  });

  const handleRestore = (event: any) => runAction(async () => {
      const file = event.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
          const data = JSON.parse(text);
          if(confirm("⚠️ ¿RESTAURAR BASE DE DATOS?")) {
              if(data.products) await supabase.from('products').insert(data.products);
              if(data.stockItems) await supabase.from('stock_items').insert(data.stockItems);
              if(data.appUsers) await supabase.from('app_users').insert(data.appUsers);
              alert("Restauración completada.");
              await refreshData();
          }
      } catch(err) { alert("Archivo inválido"); }
  });

  const nukeDatabase = () => runAction(async () => {
      const pin = prompt("⚠️ PIN MAESTRO (0000) PARA BORRAR TODO:");
      if(pin === '0000') {
          await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
          alert("✅ Datos borrados."); 
          await refreshData();
      } else if (pin !== null) alert("PIN Incorrecto.");
  });

  // --- CRUD & SYSTEM OPS ---
  
  // AQUÍ ESTABA EL ERROR: handleTransfer AHORA ESTÁ DEFINIDO Y USA getBalance
  const handleTransfer = (direction: 'E_A_Y' | 'Y_A_E') => runAction(async () => {
      const monto = Number(transferAmount);
      if (!monto || monto <= 0) return alert("Monto inválido");
      
      const balances = getBalance(); // Aquí usamos getBalance (Error 3 resuelto)
      
      if (direction === 'E_A_Y' && monto > balances.efectivo) return alert(`Saldo insuficiente Efec (S/ ${balances.efectivo.toFixed(2)})`);
      if (direction === 'Y_A_E' && monto > balances.yape) return alert(`Saldo insuficiente Yape (S/ ${balances.yape.toFixed(2)})`);

      await addTransaction({
          amount: monto, type: 'TRANSFERENCIA', category: direction === 'E_A_Y' ? 'EFECTIVO_A_YAPE' : 'YAPE_A_EFECTIVO',
          method: 'MIXTO', description: direction === 'E_A_Y' ? "Efectivo a Yape" : "Yape a Efectivo",
          status: 'ACTIVO', transaction_date: getPeruDate()
      });
      setTransferAmount(''); alert("Transferencia realizada");
  });

  const handleOp = (type: string) => runAction(async () => {
      if(!confirm(`¿Confirmar ${type}?`)) return;
      await addTransaction({ amount: 0, type: type as any, method: 'EFECTIVO', description: `Manual: ${type}`, status: 'ACTIVO', transaction_date: getPeruDate() });
      alert("Registrado");
  });

  const saveProduct = () => runAction(async () => {
    if (editingId) { await supabase.from('products').update({ name: editForm.name, color: editForm.color }).eq('id', editingId); setEditingId(null); } 
    else { if(!newProd.name) return; await supabase.from('products').insert([{ name: newProd.name, color: newProd.color, price: 0, is_active: true }]); setNewProd({...newProd, name: ''}); }
    await refreshData();
  });

  const saveStock = () => runAction(async () => {
    if (editingId) { await supabase.from('stock_items').update({ name: editForm.name, priority: editForm.priority }).eq('id', editingId); setEditingId(null); }
    else { if(!newStock.name) return; await supabase.from('stock_items').insert([{ name: newStock.name, priority: newStock.priority, is_active: true }]); setNewStock({...newStock, name: ''}); }
    await refreshData();
  });

  const saveUser = () => runAction(async () => {
      if (editingId) { await supabase.from('app_users').update({ name: editForm.name, pin: editForm.pin, role: editForm.role }).eq('id', editingId); setEditingId(null); }
      else { if(!newUser.name) return; await supabase.from('app_users').insert([newUser]); setNewUser({...newUser, name: '', pin: '', role: 'EMPLEADO'}); }
      await refreshData();
  });

  const delItem = (table: string, id: string, logic = false) => runAction(async () => {
      if(!confirm("¿Eliminar?")) return;
      if(logic) await supabase.from(table).update({ is_active: false }).eq('id', id);
      else await supabase.from(table).delete().eq('id', id);
      await refreshData();
  });

  const colors = ['bg-blue-600', 'bg-red-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-gray-600'];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex bg-[#0f172a] p-1 rounded-xl overflow-x-auto sticky top-0 z-10 shadow-lg border border-gray-800">
         {['PRODUCTOS', 'STOCK', 'USUARIOS', 'SISTEMA', 'CONFIG'].map(t => (
             <button key={t} onClick={() => { setTab(t); setEditingId(null); }} className={`flex-1 text-[10px] font-bold py-3 px-4 rounded-lg transition-all ${tab === t ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400'}`}>{t}</button>
         ))}
      </div>

      {tab === 'CONFIG' && (
           <div className="space-y-6">
               <div className="bg-[#1e293b] p-5 rounded-xl border border-gray-700 shadow-lg">
                   <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Settings className="text-orange-500"/> CONFIGURACIÓN</h3>
                   <label className="text-xs text-gray-400 block mb-1">Nombre de la Tienda</label>
                   <input value={sysConfig.business_name} onChange={e => setSysConfig({...sysConfig, business_name: e.target.value})} className="w-full bg-[#0f172a] text-white p-3 rounded-lg mb-4 border border-gray-700"/>
                   <label className="text-xs text-gray-400 block mb-1">Telegram Token</label>
                   <input value={sysConfig.telegram_token} onChange={e => setSysConfig({...sysConfig, telegram_token: e.target.value})} className="w-full bg-[#0f172a] text-white p-3 rounded-lg mb-4 border border-gray-700" placeholder="Bot Token"/>
                   <label className="text-xs text-gray-400 block mb-1">Telegram Chat ID</label>
                   <input value={sysConfig.telegram_chat_id} onChange={e => setSysConfig({...sysConfig, telegram_chat_id: e.target.value})} className="w-full bg-[#0f172a] text-white p-3 rounded-lg mb-4 border border-gray-700" placeholder="Chat ID"/>
                   <button onClick={saveSystemConfig} disabled={isSubmitting} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold flex justify-center disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin"/> : "GUARDAR CONFIGURACIÓN"}</button>
               </div>
               
               <div className="bg-[#1e293b] p-5 rounded-xl border border-gray-700 shadow-lg">
                   <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Database className="text-blue-500"/> BASE DE DATOS</h3>
                   <div className="grid grid-cols-1 gap-3">
                        <button onClick={downloadBackup} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Download size={18}/> BACKUP JSON</button>
                        <button onClick={sendToTelegram} disabled={isSubmitting} className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin"/> : <><Send size={18}/> BACKUP TELEGRAM</>}</button>
                        <div className="relative border-t border-gray-700 pt-3"><input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json"/><button onClick={() => fileInputRef.current?.click()} disabled={isSubmitting} className="w-full bg-slate-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-600"><Upload size={18}/> RESTAURAR JSON</button></div>
                        <button onClick={nukeDatabase} disabled={isSubmitting} className="w-full bg-red-900/50 text-red-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-800 mt-2"><Trash2 size={18}/> RESET TOTAL</button>
                   </div>
               </div>
           </div>
      )}

      {tab === 'PRODUCTOS' && (
          <div className="space-y-4">
             <div className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 shadow-lg">
                <div className="flex justify-between items-center mb-3"><h3 className="text-white font-bold text-sm flex gap-2 items-center"><Coffee size={16} className="text-orange-500"/> {editingId ? 'EDITAR' : 'NUEVO'}</h3>{editingId && <button onClick={() => setEditingId(null)}><X className="text-gray-400"/></button>}</div>
                <div className="flex gap-2 mb-3">
                    <input value={editingId ? editForm.name : newProd.name} onChange={e => editingId ? setEditForm({...editForm, name: e.target.value}) : setNewProd({...newProd, name: e.target.value})} placeholder="Nombre..." className="flex-1 bg-[#0f172a] text-white p-3 rounded-lg text-sm border border-gray-700 outline-none"/>
                    <button onClick={saveProduct} disabled={isSubmitting} className="bg-green-600 text-white p-3 rounded-lg shadow-lg min-w-[50px] flex items-center justify-center disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin"/> : editingId ? <Save size={20}/> : <Plus size={20}/>}</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{colors.map(c => <button key={c} onClick={() => editingId ? setEditForm({...editForm, color: c}) : setNewProd({...newProd, color: c})} className={`w-8 h-8 rounded-full ${c} flex-shrink-0 transition-transform ${(editingId ? editForm.color : newProd.color) === c ? 'ring-2 ring-white scale-110' : 'opacity-40'}`}/>)}</div>
             </div>
             <div className="grid grid-cols-1 gap-2">{products.map(p => (<div key={p.id} className="bg-[#1e293b] p-3 rounded-xl flex justify-between items-center border border-gray-800"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full ${p.color} border border-white/20`}/><span className="text-white font-medium">{p.name}</span></div><div className="flex gap-1"><button onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, color: p.color }); }} disabled={isSubmitting} className="p-2 text-blue-400 bg-blue-900/20 rounded-lg"><Edit2 size={18}/></button><button onClick={() => delItem('products', p.id, true)} disabled={isSubmitting} className="p-2 text-red-400 bg-red-900/20 rounded-lg"><Trash2 size={18}/></button></div></div>))}</div>
          </div>
      )}

      {tab === 'STOCK' && (
          <div className="space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 shadow-lg">
                <div className="flex justify-between items-center mb-3"><h3 className="text-white font-bold text-sm flex gap-2 items-center"><Box size={16} className="text-blue-500"/> {editingId ? 'EDITAR' : 'NUEVO'}</h3>{editingId && <button onClick={() => setEditingId(null)}><X className="text-gray-400"/></button>}</div>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <input value={editingId ? editForm.name : newStock.name} onChange={e => editingId ? setEditForm({...editForm, name: e.target.value}) : setNewStock({...newStock, name: e.target.value})} placeholder="Nombre..." className="flex-1 bg-[#0f172a] text-white p-3 rounded-lg text-sm border border-gray-700 outline-none"/>
                        <button onClick={saveStock} disabled={isSubmitting} className="bg-green-600 text-white p-3 rounded-lg shadow-lg flex items-center justify-center min-w-[50px] disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin"/> : editingId ? <Save size={20}/> : <Plus size={20}/>}</button>
                    </div>
                    <div className="flex gap-2">{['INSUMO', 'URGENTE'].map(prio => (<button key={prio} onClick={() => editingId ? setEditForm({...editForm, priority: prio}) : setNewStock({...newStock, priority: prio})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${(editingId ? editForm.priority : newStock.priority) === prio ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#0f172a] border-gray-700 text-gray-500'}`}>{prio}</button>))}</div>
                </div>
             </div>
             <div className="grid grid-cols-1 gap-2">{stockItems.map(s => (<div key={s.id} className="bg-[#1e293b] p-3 rounded-xl flex justify-between items-center border border-gray-800"><div><div className="text-white font-medium">{s.name}</div><div className={`text-[10px] px-2 rounded w-fit mt-1 ${s.priority === 'URGENTE' ? 'bg-red-900 text-red-200' : 'bg-gray-700 text-gray-300'}`}>{s.priority}</div></div><div className="flex gap-1"><button onClick={() => { setEditingId(s.id); setEditForm({ name: s.name, priority: s.priority }); }} disabled={isSubmitting} className="p-2 text-blue-400 bg-blue-900/20 rounded-lg"><Edit2 size={18}/></button><button onClick={() => delItem('stock_items', s.id, true)} disabled={isSubmitting} className="p-2 text-red-400 bg-red-900/20 rounded-lg"><Trash2 size={18}/></button></div></div>))}</div>
          </div>
      )}

      {tab === 'USUARIOS' && (
          <div className="space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 shadow-lg">
                <div className="flex justify-between items-center mb-3"><h3 className="text-white font-bold text-sm flex gap-2 items-center"><User size={16}/> {editingId ? 'EDITAR' : 'NUEVO'}</h3>{editingId && <button onClick={() => setEditingId(null)}><X className="text-gray-400"/></button>}</div>
                <input value={editingId ? editForm.name : newUser.name} onChange={e => editingId ? setEditForm({...editForm, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})} placeholder="Nombre" className="w-full bg-[#0f172a] text-white p-3 rounded-lg text-sm mb-3 border border-gray-700"/>
                <div className="flex gap-2">
                    <input value={editingId ? editForm.pin : newUser.pin} type="tel" maxLength={4} onChange={e => editingId ? setEditForm({...editForm, pin: e.target.value}) : setNewUser({...newUser, pin: e.target.value})} placeholder="PIN" className="flex-1 bg-[#0f172a] text-white p-3 rounded-lg text-sm border border-gray-700 text-center tracking-widest"/>
                    <select value={editingId ? editForm.role : newUser.role} onChange={e => editingId ? setEditForm({...editForm, role: e.target.value}) : setNewUser({...newUser, role: e.target.value})} className="bg-[#0f172a] text-white text-xs p-2 rounded-lg border border-gray-700"><option value="EMPLEADO">EMPLEADO</option><option value="ADMIN">ADMIN</option></select>
                    <button onClick={saveUser} disabled={isSubmitting} className="bg-green-600 text-white p-3 rounded-lg min-w-[50px] disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin"/> : editingId ? <Save size={20}/> : <Plus size={20}/>}</button>
                </div>
             </div>
             <div className="space-y-2">{appUsers.map(u => (<div key={u.id} className="bg-[#1e293b] p-3 rounded-xl flex justify-between items-center border border-gray-800"><span className="text-white text-sm">{u.name} <span className="text-gray-500">({u.role})</span></span><div className="flex gap-1"><button onClick={() => { setEditingId(u.id); setEditForm({ name: u.name, pin: u.pin, role: u.role }); }} disabled={isSubmitting} className="p-2 text-blue-400 bg-blue-900/20 rounded-lg"><Edit2 size={18}/></button><button onClick={() => delItem('app_users', u.id)} disabled={isSubmitting} className="p-2 text-red-400 bg-red-900/20 rounded-lg"><Trash2 size={18}/></button></div></div>))}</div>
          </div>
      )}

      {tab === 'SISTEMA' && (
           <div className="space-y-6">
               <div className="bg-[#1e293b] p-5 rounded-xl border border-gray-700 shadow-lg">
                   <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><ArrowRightLeft className="text-blue-400"/> TRANSFERENCIA</h3>
                   <div className="bg-[#0f172a] p-2 rounded-lg border border-gray-800 mb-4 flex items-center"><span className="text-gray-500 px-3 font-bold">S/</span><input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" className="bg-transparent text-white w-full outline-none text-lg font-bold"/></div>
                   <div className="grid grid-cols-2 gap-3"><button onClick={() => handleTransfer('E_A_Y')} disabled={isSubmitting} className="bg-blue-900/50 border border-blue-500/30 text-blue-200 py-3 rounded-lg text-xs font-bold hover:bg-blue-900 disabled:opacity-50">EFECTIVO ➡️ YAPE</button><button onClick={() => handleTransfer('Y_A_E')} disabled={isSubmitting} className="bg-purple-900/50 border border-purple-500/30 text-purple-200 py-3 rounded-lg text-xs font-bold hover:bg-purple-900 disabled:opacity-50">YAPE ➡️ EFECTIVO</button></div>
               </div>
               <div className="grid grid-cols-2 gap-4"><button onClick={() => handleOp('APERTURA')} disabled={isSubmitting} className="bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg flex flex-col items-center gap-1 disabled:opacity-50"><span className="text-lg">🔓</span> APERTURA</button><button onClick={() => handleOp('CIERRE')} disabled={isSubmitting} className="bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg flex flex-col items-center gap-1 disabled:opacity-50"><span className="text-lg">🔒</span> CERRAR CAJA</button><button onClick={() => handleOp('DIA_0')} disabled={isSubmitting} className="col-span-2 bg-gray-700 text-gray-300 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-gray-600 disabled:opacity-50"><ShieldAlert size={14}/> DECLARAR DÍA 0</button></div>
           </div>
      )}
    </div>
  );
}