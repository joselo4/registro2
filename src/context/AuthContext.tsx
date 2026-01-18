import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../supabase';

interface User {
  id: string;
  name: string;
  role: string;
  pin: string;
  is_active?: boolean;
  allowed_modules?: string[]; // Nueva propiedad
}

interface AuthContextType {
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  canAccess: (module: string) => boolean; // Nueva función helper
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('pizza_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('pin', pin)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) return false;

      // Aseguramos que allowed_modules sea un array
      const userData = {
          ...data,
          allowed_modules: data.allowed_modules || []
      };

      setUser(userData);
      localStorage.setItem('pizza_user', JSON.stringify(userData));
      return true;
    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pizza_user');
  };

  // Función para verificar permisos fácilmente en cualquier parte
  const canAccess = (module: string) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true; // Admin ve todo
      return user.allowed_modules?.includes(module) || false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};