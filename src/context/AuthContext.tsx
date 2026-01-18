import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../supabase';

interface User {
  id: string;
  name: string;
  role: string;
  pin: string;
}

interface AuthContextType {
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Intentar recuperar sesión al recargar página
  useEffect(() => {
    const savedUser = localStorage.getItem('pizza_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    try {
      // Validamos el PIN contra la tabla de usuarios real de Supabase
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('pin', pin)
        .eq('is_active', true) // Solo usuarios activos
        .single();

      if (error || !data) {
        return false;
      }

      // Login exitoso
      setUser(data);
      localStorage.setItem('pizza_user', JSON.stringify(data));
      return true;
    } catch (err) {
      console.error("Error login:", err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pizza_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};