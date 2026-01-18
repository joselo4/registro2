import { useState } from 'react';
import { useStore } from '../context/DataContext';
import { AlertTriangle, Send, CheckSquare, Square } from 'lucide-react';

export default function Stock() {
  const { stockItems } = useStore();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const WHATSAPP_NUMBER = "51989466466"; 

  const toggleItem = (name: string) => {
    if (selectedItems.includes(name)) {
        setSelectedItems(selectedItems.filter(i => i !== name));
    } else {
        setSelectedItems([...selectedItems, name]);
    }
  };

  const sendList = () => {
    if (selectedItems.length === 0) return alert("Selecciona al menos un ítem");
    
    const listText = selectedItems.map(i => `• ${i}`).join('\n');
    const text = `⚠️ *PEDIDO DE STOCK*\n\nSe necesita urgente:\n${listText}`;
    
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
    setSelectedItems([]);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="border border-orange-500 bg-[#1e293b] p-5 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
        
        <div className="flex items-center gap-2 text-orange-500 font-bold mb-4 relative z-10">
            <div className="bg-orange-500/20 p-2 rounded-lg"><AlertTriangle size={24}/></div>
            <span className="text-lg">Generar Pedido</span>
        </div>
        
        {stockItems.length === 0 ? (
            <div className="text-center text-gray-500 py-10 italic border border-dashed border-gray-700 rounded-lg">
                No hay ítems configurados. <br/> Ve a Admin {'>'} Stock para agregar.
            </div>
        ) : (
            <div className="grid grid-cols-2 gap-3 mb-6">
                {stockItems.map(item => {
                    const isSelected = selectedItems.includes(item.name);
                    return (
                        <button 
                            key={item.id}
                            onClick={() => toggleItem(item.name)}
                            className={`border relative p-3 rounded-xl flex flex-col justify-between items-start h-20 transition-all ${isSelected ? 'border-orange-500 bg-orange-900/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : 'border-gray-700 bg-[#0f172a] hover:bg-[#2d3748]'}`}
                        >
                            <div className={`font-bold text-sm leading-tight text-left ${isSelected ? 'text-orange-400' : 'text-white'}`}>{item.name}</div>
                            
                            <div className="w-full flex justify-between items-end mt-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${item.priority === 'URGENTE' ? 'bg-red-900 text-red-200' : 'bg-gray-700 text-gray-400'}`}>
                                    {item.priority}
                                </span>
                                {isSelected ? <CheckSquare size={16} className="text-orange-500"/> : <Square size={16} className="text-gray-600"/>}
                            </div>
                        </button>
                    )
                })}
            </div>
        )}

        <button 
            onClick={sendList}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all shadow-xl ${selectedItems.length > 0 ? 'bg-green-600 text-white shadow-green-900/50 active:scale-95' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
            disabled={selectedItems.length === 0}
         >
            <Send size={20}/> {selectedItems.length > 0 ? `Enviar (${selectedItems.length})` : 'Selecciona Ítems'}
         </button>
      </div>
    </div>
  );
}