import React from 'react'; // <--- IMPORTANTE
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/DataContext';
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import Ventas from './pages/Ventas';
import Caja from './pages/Caja';
import Historial from './pages/Historial';
import Reportes from './pages/Reportes';
import Admin from './pages/Admin';
import Stock from './pages/Stock';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Ventas />} />
              <Route path="caja" element={<Caja />} />
              <Route path="stock" element={<Stock />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="historial" element={<Historial />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;