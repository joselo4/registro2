import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/DataContext';

// Importamos TODAS las páginas
import Login from './pages/Login';
import Ventas from './pages/Ventas';
import Caja from './pages/Caja';
import Stock from './pages/Stock';      // Nuevo
import Reportes from './pages/Reportes'; // Nuevo
import Historial from './pages/Historial';
import Admin from './pages/Admin';      // Nuevo

// Iconos para el menú
import { Pizza, Coins, Package, BarChart3, Calendar, Shield, LogOut } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>; 
};

const Navbar = () => {
    const { logout, canAccess } = useAuth(); 
    const location = useLocation();
    
    if (location.pathname === '/') return null;

    // Helper para clases de botones activos
    const getNavClass = (path: string, color: string) => `
        min-w-[64px] p-2 rounded-xl flex flex-col items-center gap-1 text-[9px] font-bold transition-all
        ${location.pathname === path ? `${color} bg-white/5` : 'text-slate-400 hover:text-white'}
    `;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-2 z-50 pb-safe">
            {/* Contenedor con scroll horizontal para que quepan todos los módulos */}
            <div className="flex justify-between items-center overflow-x-auto gap-1 px-1 no-scrollbar">
                
                {canAccess('VENTAS') && (
                    <a href="/ventas" className={getNavClass('/ventas', 'text-red-500')}>
                        <Pizza size={20} /> VENTAS
                    </a>
                )}
                
                {canAccess('CAJA') && (
                    <a href="/caja" className={getNavClass('/caja', 'text-green-500')}>
                        <Coins size={20} /> CAJA
                    </a>
                )}

                {canAccess('STOCK') && (
                    <a href="/stock" className={getNavClass('/stock', 'text-orange-500')}>
                        <Package size={20} /> STOCK
                    </a>
                )}

                {canAccess('REPORTES') && (
                    <a href="/reportes" className={getNavClass('/reportes', 'text-purple-500')}>
                        <BarChart3 size={20} /> REPORTES
                    </a>
                )}

                {canAccess('HISTORIAL') && (
                    <a href="/historial" className={getNavClass('/historial', 'text-blue-500')}>
                        <Calendar size={20} /> HISTORIAL
                    </a>
                )}

                {canAccess('ADMIN') && (
                    <a href="/admin" className={getNavClass('/admin', 'text-yellow-500')}>
                        <Shield size={20} /> ADMIN
                    </a>
                )}

                <button onClick={logout} className="min-w-[60px] p-2 rounded-xl flex flex-col items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-red-400">
                    <LogOut size={20} /> SALIR
                </button>
            </div>
        </nav>
    );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <div className="min-h-screen bg-[#0f172a] text-white font-sans">
            <Navbar />
            
            <Routes>
              <Route path="/" element={<Login />} />
              
              <Route path="/ventas" element={ <ProtectedRoute><Ventas /></ProtectedRoute> } />
              <Route path="/caja" element={ <ProtectedRoute><Caja /></ProtectedRoute> } />
              <Route path="/stock" element={ <ProtectedRoute><Stock /></ProtectedRoute> } />
              <Route path="/reportes" element={ <ProtectedRoute><Reportes /></ProtectedRoute> } />
              <Route path="/historial" element={ <ProtectedRoute><Historial /></ProtectedRoute> } />
              <Route path="/admin" element={ <ProtectedRoute><Admin /></ProtectedRoute> } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}