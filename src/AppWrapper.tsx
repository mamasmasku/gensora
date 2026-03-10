/**
 * AppWrapper.tsx
 * 
 * Komponen pembungkus yang menangani:
 * 1. Auth state (login / loading / authenticated)
 * 2. Routing sederhana (main app / admin panel)
 * 3. Mengirimkan auth context ke App
 * 
 * CARA PAKAI:
 * Di main.tsx / index.tsx, ganti <App /> dengan <AppWrapper />
 * 
 * import AppWrapper from './AppWrapper';
 * root.render(<AppWrapper />);
 */

import { useState } from 'react';
import AuthPage from './components/AuthPage';
import AdminPage from './components/AdminPage';
import App from './App';
import { useAuth } from './hooks/useAuth';

export default function AppWrapper() {
  const auth = useAuth();
  const [page, setPage] = useState<'app' | 'admin'>('app');

  // Loading spinner saat cek sesi
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
          <p className="text-zinc-400 text-sm">Memuat ScriptMate...</p>
        </div>
      </div>
    );
  }

  // Belum login → halaman auth
  if (!auth.user) return <AuthPage />;

  // Admin panel
  if (page === 'admin' && auth.isAdmin) {
    return <AdminPage onBack={() => setPage('app')} />;
  }

  // Main app dengan auth props
  return (
    <App
      authUser={auth.user}
      authProfile={auth.profile}
      authCredits={auth.credits}
      isProUser={auth.isPro}
      isAdminUser={auth.isAdmin}
      onSignOut={auth.signOut}
      onGoAdmin={() => setPage('admin')}
      onCreditsUpdate={(newCredits) => {
        // Update credits di state — useAuth akan refresh sendiri
        // tapi kita juga update langsung agar UI responsif
        auth.refreshCredits();
      }}
    />
  );
}
