import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    localStorage.getItem('QUESO_SUPABASE_URL') ||
    '';

  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('QUESO_SUPABASE_KEY') ||
    '';

  return { url, key };
};

const config = getSupabaseConfig();

export const isSupabaseConfigured = !!(config.url && config.key);

export const supabase = isSupabaseConfigured
  ? createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (null as any);

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('QUESO_SUPABASE_URL', url);
  localStorage.setItem('QUESO_SUPABASE_KEY', key);
  window.location.reload();
};