import { useStore } from '../context/DataContext';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reportes() {
  const { transactions } = useStore();
  const activeTransactions = transactions.filter(t => t.status !== 'ANULADO');

  // 1. Calcular Ventas del Turno Actual (Desde el último CIERRE)
  const lastCloseIndex = activeTransactions.findIndex(t => t.type === 'CIERRE');
  // Si no hay cierre, tomamos todas. Si hay, tomamos las que están ANTES del cierre (índice menor porque están ordenadas por fecha DESC)
  const currentShiftTransactions = lastCloseIndex === -1 ? activeTransactions : activeTransactions.slice(0, lastCloseIndex);
  
  const currentShiftSales = currentShiftTransactions
    .filter(t => t.type === 'INGRESO')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  // 2. Producto Top (De todo el historial activo)
  const productCount: Record<string, number> = {};
  activeTransactions.filter(t => t.type === 'INGRESO').forEach(t => {
      const name = t.category || 'Varios';
      productCount[name] = (productCount[name] || 0) + 1;
  });
  const topProduct = Object.entries(productCount).sort((a,b) => b[1] - a[1])[0];

  // 3. Datos Gráfico
  const pieData = Object.entries(productCount).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 pb-20">
       <div className="bg-[#1e293b] p-4 rounded-lg border border-gray-700 relative overflow-hidden">
          <div className="text-[10px] text-gray-400 uppercase">VENTAS TURNO ACTUAL (Sin Cierre)</div>
          <div className="text-3xl font-black text-white mt-1">S/ {currentShiftSales.toFixed(2)}</div>
          <div className="text-[10px] text-green-500 mt-2">Desde último cierre registrado</div>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1e293b] p-3 rounded-lg border border-gray-700">
             <div className="text-[10px] text-gray-400">PRODUCTO TOP</div>
             <div className="text-lg font-bold text-white truncate">{topProduct ? topProduct[0] : '-'}</div>
             <div className="text-[10px] text-gray-500">{topProduct ? `${topProduct[1]} ventas` : ''}</div>
          </div>
          <div className="bg-[#1e293b] p-3 rounded-lg border border-gray-700">
             <div className="text-[10px] text-gray-400">TOTAL TRANSACCIONES</div>
             <div className="text-xl font-bold text-white">{transactions.length}</div>
          </div>
       </div>

       <div className="bg-[#1e293b] p-4 rounded-lg border border-gray-700 h-64">
          <div className="text-xs font-bold text-white mb-2">🍕 Mix de Ventas</div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{backgroundColor: '#1e293b', border:'none'}}/>
            </PieChart>
          </ResponsiveContainer>
       </div>
    </div>
  );
}