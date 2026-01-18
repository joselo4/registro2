// src/context/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';

// Definimos tipos básicos para que no falle
export interface Transaction {
  id?: string;
  created_at?: string;
  amount: number;
  type: 'INGRESO' | 'GASTO';
  category: string;
  method: 'EFECTIVO' | 'YAPE' | 'MIXTO';
  method_details?: { efectivo: number; yape: number };
  description?: string;
  user_name?: string;
  user_id?: string; // Compatibilidad
}

export interface Product {
  id: string;
  name: string;
  price: number;
  color: string;
}

interface StoreContextType {
  transactions: Transaction[];
  products: Product[];
  addTransaction: (t: Transaction) => Promise<void>;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = async () => {
    setLoading(true);
    // Intentar cargar productos
    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) setProducts(prodData);

    // Intentar cargar transacciones
    const { data: transData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (transData) setTransactions(transData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
    // Suscripción básica a cambios
    const sub = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
        setTransactions((prev) => [payload.new as Transaction, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const addTransaction = async (t: Transaction) => {
    // Optimistic UI update (opcional)
    const { error } = await supabase.from('transactions').insert([t]);
    if (error) console.error('Error guardando:', error);
  };

  return (
    <StoreContext.Provider value={{ transactions, products, addTransaction, loading }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};