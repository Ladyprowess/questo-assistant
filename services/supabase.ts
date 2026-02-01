
import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || localStorage.getItem('QUESO_SUPABASE_URL') || '';
  const key = process.env.SUPABASE_ANON_KEY || localStorage.getItem('QUESO_SUPABASE_KEY') || '';
  return { url, key };
};

const config = getSupabaseConfig();

export const isSupabaseConfigured = !!(config.url && config.key);

export const supabase = isSupabaseConfigured 
  ? createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }) 
  : null as any;

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('QUESO_SUPABASE_URL', url);
  localStorage.setItem('QUESO_SUPABASE_KEY', key);
  window.location.reload();
};

export const testSupabaseConnection = async () => {
  if (!supabase) return { success: false, error: 'Client not initialized' };
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
