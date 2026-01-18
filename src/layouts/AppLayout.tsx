import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Store, Wallet, Package, BarChart2, History, Settings } from 'lucide-react';
import { useStore } from '../context/DataContext';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useStore();

  const navItems = [
    { icon: Store, label: 'Ventas', path: '/' },
    { icon: Wallet, label: 'Caja', path: '/caja' },
    { icon: Package, label: 'Stock', path: '/stock' },
    { icon: BarChart2, label: 'KPIs', path: '/reportes' },
    { icon: History, label: 'Hist.', path: '/historial' },
    { icon: Settings, label: 'Admin', path: '/admin' },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans pb-28">
      {/* Header Sticky Glass */}
      <header className="px-5 py-4 flex justify-between items-center bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div>
           <div className="text-orange-500 text-[10px] font-black tracking-[0.2em]">SISTEMA POS</div>
           <h1 className="text-lg font-bold leading-none text-white tracking-tight">{config?.business_name || 'PIZZA SYSTEM'}</h1>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
      </header>

      {/* Contenido Principal */}
      <main className="p-4 max-w-lg mx-auto animate-fade-in">
        <Outlet />
      </main>

      {/* Navegación Inferior Flotante */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/5 pt-2 pb-6 px-2 z-50 flex justify-around shadow-2xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 w-16 ${
                isActive ? 'text-orange-400 -translate-y-2' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${isActive ? 'bg-orange-500/10' : 'bg-transparent'}`}>
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-bold ${isActive ? 'opacity-100' : 'opacity-0 h-0'}`}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  );
};

export default AppLayout;