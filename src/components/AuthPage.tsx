import { useState, useEffect } from 'react';
import { supabase, signInWithGoogleNewTab } from '../lib/supabase';

type Tab = 'login' | 'register';
type LoginMethod = 'email' | 'phone';

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [waitingGoogleLogin, setWaitingGoogleLogin] = useState(false);

  // ── Deteksi login dari tab baru via localStorage event ──────
  // Ketika tab /login berhasil login, Supabase update localStorage.
  // Event 'storage' otomatis terpicu di tab/iframe lain yang sama origin.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Cek apakah yang berubah adalah session Supabase
      if (e.key && e.key.includes('scriptmate-auth')) {
        if (e.newValue) {
          // Session baru muncul → login berhasil dari tab lain
          // Muat ulang session di tab ini
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              // onAuthStateChange di useAuth.ts akan otomatis handle sisanya
              // Tapi kita perlu trigger page refresh agar AppWrapper re-render
              window.location.reload();
            }
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Login Google → buka tab baru ────────────────────────────
  const handleGoogleLogin = () => {
    setWaitingGoogleLogin(true);
    setError('');
    signInWithGoogleNewTab();
    // Tampilkan pesan tunggu
    // Storage event akan handle sisanya otomatis
  };

  const handleEmailSubmit = async () => {
    if (!email || !password) return setError('Email dan password wajib diisi.');
    const emailLower = email.toLowerCase();
    if (
      !emailLower.includes('@gmail.com') &&
      !emailLower.includes('@yahoo.com') &&
      !emailLower.includes('@yahoo.co.id')
    ) {
      return setError('Saat ini hanya Gmail dan Yahoo yang didukung.');
    }
    setLoading(true);
    setError('');

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? 'Email atau password salah.'
            : error.message
        );
      }
    } else {
      if (!username || username.length < 3) {
        setLoading(false);
        return setError('Username minimal 3 karakter.');
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: username } },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Akun dibuat! Cek email untuk verifikasi, lalu login.');
        setTab('login');
      }
    }
    setLoading(false);
  };

  const handlePhoneOtp = async () => {
    if (!phone || phone.length < 10) return setError('Masukkan nomor HP yang valid.');
    const formatted = phone.startsWith('0')
      ? '+62' + phone.slice(1)
      : phone.startsWith('62')
      ? '+' + phone
      : phone;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
      setSuccess(`Kode OTP dikirim ke ${formatted}`);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) return setError('Masukkan kode OTP.');
    const formatted = phone.startsWith('0')
      ? '+62' + phone.slice(1)
      : phone.startsWith('62')
      ? '+' + phone
      : phone;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms',
    });
    if (error) setError('Kode OTP salah atau kedaluwarsa.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-500">
            ScriptMate
          </h1>
          <p className="text-purple-300 text-sm mt-1">
            AI Generator Skrip & Prompt Video TikTok GO
          </p>
        </div>

        <div className="bg-gray-800/70 border border-purple-700/60 rounded-2xl p-6 backdrop-blur-sm">

          {/* Status menunggu Google login dari tab baru */}
          {waitingGoogleLogin && (
            <div className="flex flex-col items-center gap-4 py-6 mb-4 bg-blue-900/20 border border-blue-700/50 rounded-xl">
              <div className="flex gap-2">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
              <div className="text-center">
                <p className="text-blue-300 font-semibold text-sm">Tab login Google sudah dibuka</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Selesaikan login di tab baru tersebut.<br />
                  Halaman ini akan otomatis update setelah login berhasil.
                </p>
              </div>
              <button
                onClick={() => setWaitingGoogleLogin(false)}
                className="text-xs text-zinc-600 hover:text-zinc-400 underline"
              >
                Batal
              </button>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-900/60 rounded-lg p-1 mb-6">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); setWaitingGoogleLogin(false); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                  tab === t ? 'bg-yellow-500 text-gray-900' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>

          {/* Google OAuth — buka tab baru */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading || waitingGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-100 transition-all disabled:opacity-60 mb-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {tab === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
            <span className="text-xs text-gray-500 ml-1">(tab baru)</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-xs text-zinc-600">atau</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          {/* Method toggle */}
          <div className="flex gap-2 mb-4">
            {(['email', 'phone'] as LoginMethod[]).map(m => (
              <button
                key={m}
                onClick={() => { setMethod(m); setStep('form'); setError(''); setSuccess(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  method === m
                    ? 'bg-purple-700/60 border-purple-400 text-white'
                    : 'border-gray-700 text-zinc-500 hover:border-gray-600'
                }`}
              >
                {m === 'email' ? '✉️ Email' : '📱 Nomor HP'}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg px-3 py-2 text-xs text-red-300 mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-600/50 rounded-lg px-3 py-2 text-xs text-green-300 mb-4">
              {success}
            </div>
          )}

          {/* Form Email */}
          {method === 'email' ? (
            <div className="flex flex-col gap-3">
              {tab === 'register' && (
                <input
                  type="text"
                  placeholder="Username (min 3 karakter)"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
              <input
                type="email"
                placeholder="Gmail atau Yahoo kamu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-yellow-400 hover:to-purple-500 transition-all disabled:opacity-60"
              >
                {loading ? 'Memproses...' : tab === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            </div>
          ) : (
            /* Form Phone */
            <div className="flex flex-col gap-3">
              {step === 'form' ? (
                <>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">+62</span>
                    <input
                      type="tel"
                      placeholder="8xx xxxx xxxx"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-gray-900/70 border border-gray-700 rounded-lg pl-12 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-xs text-zinc-600">Kode OTP akan dikirim via SMS ke nomor HP kamu.</p>
                  <button
                    onClick={handlePhoneOtp}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-yellow-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-yellow-400 hover:to-purple-500 transition-all disabled:opacity-60"
                  >
                    {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Masukkan 6 digit kode OTP"
                    value={otp}
                    maxLength={6}
                    onChange={e => setOtp(e.target.value)}
                    className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center tracking-widest text-lg"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-yellow-500 to-purple-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60"
                  >
                    {loading ? 'Memverifikasi...' : '✓ Verifikasi OTP'}
                  </button>
                  <button
                    onClick={() => setStep('form')}
                    className="text-xs text-zinc-500 hover:text-zinc-300 text-center"
                  >
                    ← Ganti nomor
                  </button>
                </>
              )}
            </div>
          )}

          {/* Info gratis */}
          <div className="mt-5 bg-gray-900/50 border border-gray-700/50 rounded-lg px-4 py-3">
            <p className="text-xs text-zinc-500 leading-relaxed">
              <span className="text-yellow-400 font-semibold">Gratis:</span> Daftar & langsung pakai Mode Bebas dengan API Key Gemini kamu sendiri.{' '}
              <span className="text-purple-400 font-semibold">Pro:</span> Akses semua mode dengan kredit — tidak perlu API Key sendiri.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
