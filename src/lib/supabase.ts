import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storageKey: 'scriptmate-auth',        // key unik di localStorage
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',                     // penting untuk iframe + tab baru
  },
});

// ── Types ────────────────────────────────────────────────────
export type UserRole = 'free' | 'pro' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  role: UserRole;
  credits: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'purchase' | 'admin_add' | 'usage' | 'refund';
  description: string | null;
  order_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  order_id: string;
  package_name: string;
  amount_idr: number;
  credits: number;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancel';
  snap_token: string | null;
  snap_url: string | null;
  payment_type: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helper: ambil session token untuk API calls ───────────────
export async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Login Google — buka di tab baru (untuk iframe Blogger) ───
export function signInWithGoogleNewTab(): void {
  const loginUrl = `${window.location.origin}/login`;
  window.open(loginUrl, '_blank', 'noopener,noreferrer');
}

// ── Paket Kredit ─────────────────────────────────────────────
export const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 30,  price: 15000,  label: '30 Kredit',  badge: null },
  { id: 'popular', name: 'Popular', credits: 100, price: 45000,  label: '100 Kredit', badge: 'Terlaris' },
  { id: 'pro',     name: 'Pro',     credits: 300, price: 120000, label: '300 Kredit', badge: 'Hemat 20%' },
] as const;
