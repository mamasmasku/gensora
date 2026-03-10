import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  credits: number;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    credits: 0,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setState(prev => ({
        ...prev,
        profile: data as Profile,
        credits: data.credits,
      }));
    }
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!state.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', state.user.id)
      .single();
    if (data) {
      setState(prev => ({ ...prev, credits: data.credits }));
    }
  }, [state.user]);

  useEffect(() => {
    // ── Ambil session awal ────────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({
          ...prev,
          user: session.user,
          session,
          loading: false,
        }));
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    // ── Listen perubahan auth (normal flow) ───────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false,
          }));
          fetchProfile(session.user.id);
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            credits: 0,
          });
        }
      }
    );

    // ── Listen localStorage event dari tab baru ───────────
    // Ketika user login di tab /login (tab baru),
    // Supabase menulis session ke localStorage dengan key 'scriptmate-auth'.
    // Browser otomatis trigger event 'storage' di semua tab/iframe
    // yang sama origin (yourapp.vercel.app).
    // Kita tangkap event ini untuk refresh session di iframe.
    const handleStorageChange = async (e: StorageEvent) => {
      // Hanya proses perubahan key session Supabase kita
      if (!e.key || !e.key.includes('scriptmate-auth')) return;

      if (e.newValue && !e.oldValue) {
        // Session baru muncul → user baru login dari tab lain
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false,
          }));
          fetchProfile(session.user.id);
        }
      } else if (!e.newValue && e.oldValue) {
        // Session dihapus → user logout dari tab lain
        setState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          credits: 0,
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = state.profile?.role === 'admin';
  const isPro   = state.profile?.role === 'pro' || state.profile?.role === 'admin';
  const isFree  = state.profile?.role === 'free';

  return {
    ...state,
    signOut,
    fetchProfile,
    refreshCredits,
    isAdmin,
    isPro,
    isFree,
  };
}
