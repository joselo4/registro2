import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../supabase';
import { getPeruDate } from '../utils';

export interface Transaction {
  id?: string;
  created_at?: string;
  amount: number;
  type: 'INGRESO' | 'GASTO' | 'TRANSFERENCIA' | 'APERTURA' | 'CIERRE' | 'DIA_0';
  category?: string;
  method: 'EFECTIVO' | 'YAPE' | 'MIXTO';
  method_details?: { efectivo: number; yape: number };
  description?: string;
  user_name?: string;
  user_id?: string;
  transaction_date?: string; 
  status?: 'ACTIVO' | 'ANULADO'; 
  justification?: string;
}

export interface Product { id: string; name: string; price: number; color: string; is_active?: boolean; }
export interface StockItem { id: string; name: string; priority: string; is_active?: boolean; }
export interface AppUser { id: string; name: string; pin: string; role: string; }
export interface AppConfig { id?: string; business_name: string; telegram_token?: string; telegram_chat_id?: string; }

interface StoreContextType {
  transactions: Transaction[];
  products: Product[];
  stockItems: StockItem[];
  appUsers: AppUser[];
  config: AppConfig;
  addTransaction: (t: Transaction) => Promise<boolean>;
  updateConfig: (newConfig: AppConfig) => Promise<boolean>;
  refreshData: () => Promise<void>;
  getBalance: () => { efectivo: number; yape: number };
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [config, setConfig] = useState<AppConfig>({ business_name: 'PIZZA SYSTEM' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // 1. Configuración (Single)
    const { data: confData } = await supabase.from('app_config').select('*').single();
    if (confData) setConfig(confData);

    // 2. Datos ordenados
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true).order('name', { ascending: true });
    if (prodData) setProducts(prodData);

    const { data: stockData } = await supabase.from('stock_items').select('*').eq('is_active', true).order('name', { ascending: true });
    if (stockData) setStockItems(stockData);

    const { data: userData } = await supabase.from('app_users').select('*').order('name', { ascending: true });
    if (userData) setAppUsers(userData);

    const { data: transData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (transData) setTransactions(transData as Transaction[]);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const subscription = supabase.channel('public:db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const getBalance = () => {
    let efectivo = 0;
    let yape = 0;
    transactions.forEach(t => {
      if (t.status === 'ANULADO') return;
      const amt = Number(t.amount);
      if (t.type === 'INGRESO') {
        if (t.method === 'EFECTIVO') efectivo += amt;
        else if (t.method === 'YAPE') yape += amt;
        else if (t.method === 'MIXTO' && t.method_details) {
          efectivo += t.method_details.efectivo;
          yape += t.method_details.yape;
        }
      } else if (t.type === 'GASTO') {
         if (t.method === 'EFECTIVO') efectivo -= amt;
         else yape -= amt;
      } else if (t.type === 'TRANSFERENCIA') {
          if (t.category === 'EFECTIVO_A_YAPE') { efectivo -= amt; yape += amt; }
          if (t.category === 'YAPE_A_EFECTIVO') { yape -= amt; efectivo += amt; }
      }
    });
    return { efectivo, yape };
  };

  const addTransaction = async (t: Transaction): Promise<boolean> => {
    const finalTransaction = {
        ...t,
        transaction_date: t.transaction_date || getPeruDate(),
        status: t.status || 'ACTIVO'
    };
    const { error } = await supabase.from('transactions').insert([finalTransaction]);
    if (error) { console.error(error); return false; }
    await fetchData(); 
    return true;
  };

  const updateConfig = async (newConfig: AppConfig): Promise<boolean> => {
      let error;
      const payload = {
          business_name: newConfig.business_name,
          telegram_token: newConfig.telegram_token,
          telegram_chat_id: newConfig.telegram_chat_id
      };

      if (newConfig.id) {
          const res = await supabase.from('app_config').update(payload).eq('id', newConfig.id);
          error = res.error;
      } else {
          const { data: existing } = await supabase.from('app_config').select('id').limit(1).single();
          if (existing) {
              const res = await supabase.from('app_config').update(payload).eq('id', existing.id);
              error = res.error;
          } else {
              const res = await supabase.from('app_config').insert([payload]);
              error = res.error;
          }
      }

      if (error) {
          console.error("Error guardando config:", error.message);
          return false;
      }
      
      await fetchData();
      return true;
  };

  return (
    <StoreContext.Provider value={{ transactions, products, stockItems, appUsers, config, addTransaction, updateConfig, refreshData: fetchData, getBalance, loading }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};