import { useState } from 'react';
import { supabase, CREDIT_PACKAGES, getAuthToken } from '../lib/supabase';

interface Props {
  onClose: () => void;
  onSuccess: (newCredits: number) => void;
  currentCredits: number;
}

declare global { interface Window { snap: any; } }

export default function BuyCreditsModal({ onClose, onSuccess, currentCredits }: Props) {
  const [selected, setSelected] = useState<string>('popular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBuy = async () => {
    setLoading(true); setError('');
    const token = await getAuthToken();
    if (!token) { setError('Sesi tidak valid.'); setLoading(false); return; }

    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat transaksi');

      if (!window.snap) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          const isProd = import.meta.env.VITE_MIDTRANS_ENV === 'production';
          script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
          script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY);
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Gagal memuat Midtrans'));
          document.head.appendChild(script);
        });
      }

      window.snap.pay(data.snapToken, {
        onSuccess: async () => {
          await new Promise(r => setTimeout(r, 2000));
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
            onSuccess(profile?.credits ?? currentCredits);
          }
          onClose();
        },
        onPending: () => { alert('Pembayaran pending. Kredit akan ditambah setelah konfirmasi.'); onClose(); },
        onError: () => setError('Pembayaran gagal. Coba lagi.'),
      });
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-gray-800 border border-purple-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-yellow-400">💎 Beli Kredit</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">✕</button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Kredit saat ini: <span className="text-yellow-400 font-bold">{currentCredits}</span></p>
        <div className="flex flex-col gap-3 mb-5">
          {CREDIT_PACKAGES.map(pkg => (
            <button key={pkg.id} onClick={() => setSelected(pkg.id)}
              className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${selected === pkg.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'}`}>
              {pkg.badge && <span className="absolute -top-2.5 right-3 text-xs bg-yellow-500 text-gray-900 font-bold px-2 py-0.5 rounded-full">{pkg.badge}</span>}
              <div className="text-left">
                <p className="font-bold text-white text-sm">{pkg.label}</p>
                <p className="text-xs text-zinc-400">~{pkg.credits} generate</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-yellow-400">Rp {pkg.price.toLocaleString('id-ID')}</p>
                <p className="text-xs text-zinc-500">Rp {Math.round(pkg.price / pkg.credits).toLocaleString('id-ID')}/kredit</p>
              </div>
            </button>
          ))}
        </div>
        <div className="bg-gray-900/60 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-zinc-400 mb-2 font-medium">Metode pembayaran:</p>
          <div className="flex flex-wrap gap-1.5">
            {['GoPay','OVO','DANA','ShopeePay','QRIS','BCA','BNI','BRI','Mandiri'].map(m => (
              <span key={m} className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-zinc-400">{m}</span>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <button onClick={handleBuy} disabled={loading}
          className="w-full bg-gradient-to-r from-yellow-500 to-purple-600 text-white font-bold py-3.5 rounded-xl hover:from-yellow-400 hover:to-purple-500 transition-all disabled:opacity-60 text-sm">
          {loading ? '⏳ Memproses...' : `💳 Bayar — Rp ${(CREDIT_PACKAGES.find(p => p.id === selected)?.price || 0).toLocaleString('id-ID')}`}
        </button>
        <p className="text-xs text-center text-zinc-600 mt-3">Diproses oleh Midtrans. Aman & terenkripsi.</p>
      </div>
    </div>
  );
}
