import { type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // 1. IMPORTAMOS AuthProvider
import { StoreProvider } from './context/DataContext';

// Importamos las páginas
import Login from './pages/Login';
import Caja from './pages/Caja';
import Historial from './pages/Historial';
import Ventas from './pages/Ventas'; 

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>; 
};

const Navbar = () => {
    const { user, logout, canAccess } = useAuth();
    const location = useLocation();
    
    if (location.pathname === '/') return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-2 flex justify-around items-center z-50 pb-safe">
            {(user?.role === 'ADMIN' || canAccess('VENTAS')) && (
                <a href="/ventas" className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${location.pathname === '/ventas' ? 'text-red-500 bg-red-500/10' : 'text-slate-400'}`}>
                    <span>🍕</span> VENTAS
                </a>
            )}
            
            {(user?.role === 'ADMIN' || canAccess('CAJA')) && (
                <a href="/caja" className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${location.pathname === '/caja' ? 'text-green-500 bg-green-500/10' : 'text-slate-400'}`}>
                    <span>💰</span> CAJA
                </a>
            )}

            {(user?.role === 'ADMIN' || canAccess('HISTORIAL')) && (
                <a href="/historial" className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold ${location.pathname === '/historial' ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400'}`}>
                    <span>📅</span> HISTORIAL
                </a>
            )}

            <button onClick={logout} className="p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white">
                <span>🚪</span> SALIR
            </button>
        </nav>
    );
};

export default function App() {
  return (
    // 2. AGREGAMOS EL AuthProvider AQUÍ ENVOLVIENDO TODO
    <AuthProvider>
      <StoreProvider>
        <div className="min-h-screen bg-[#0f172a] text-white font-sans">
          <Navbar />
          
          <Routes>
            <Route path="/" element={<Login />} />
            
            <Route path="/ventas" element={
              <ProtectedRoute>
                <Ventas />
              </ProtectedRoute>
            } />
            
            <Route path="/caja" element={
              <ProtectedRoute>
                <Caja />
              </ProtectedRoute>
            } />
            
            <Route path="/historial" element={
              <ProtectedRoute>
                <Historial />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </StoreProvider>
    </AuthProvider>
  );
}