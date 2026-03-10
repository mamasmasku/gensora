import { useState, useEffect, useCallback } from 'react';
import { Profile, getAuthToken } from '../lib/supabase';

interface Stats {
  totalUsers: number; proUsers: number; freeUsers: number;
  totalCreditsSold: number; totalCreditsUsed: number;
}

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'users' | 'add_user'>('users');

  // Kredit modal state
  const [creditModal, setCreditModal] = useState<{ user: Profile | null; amount: string; desc: string }>({ user: null, amount: '', desc: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Add user form
  const [newUser, setNewUser] = useState({ email: '', username: '', role: 'pro', credits: '50' });
  const [addResult, setAddResult] = useState<{ tempPassword?: string; message?: string; error?: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const token = await getAuthToken();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, [search, roleFilter]);

  const fetchStats = useCallback(async () => {
    const token = await getAuthToken();
    const res = await fetch('/api/admin/credits', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setStats(data);
  }, []);

  useEffect(() => { fetchUsers(); fetchStats(); }, [fetchUsers, fetchStats]);

  const handleAddCredits = async () => {
    if (!creditModal.user || !creditModal.amount) return;
    setActionLoading(true); setMsg('');
    const token = await getAuthToken();
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: creditModal.user.id, amount: parseInt(creditModal.amount), description: creditModal.desc }),
    });
    const data = await res.json();
    setMsg(res.ok ? `✅ ${data.message} Saldo baru: ${data.newBalance}` : `❌ ${data.error}`);
    if (res.ok) { fetchUsers(); setCreditModal({ user: null, amount: '', desc: '' }); }
    setActionLoading(false);
  };

  const handleToggleActive = async (user: Profile) => {
    const token = await getAuthToken();
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'toggle_active', userId: user.id }),
    });
    fetchUsers();
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    const token = await getAuthToken();
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'update_role', userId, role }),
    });
    fetchUsers();
  };

  const handleAddUser = async () => {
    setActionLoading(true); setAddResult(null);
    const token = await getAuthToken();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'create', email: newUser.email, username: newUser.username, role: newUser.role, credits: parseInt(newUser.credits) }),
    });
    const data = await res.json();
    setAddResult(data);
    if (res.ok) { fetchUsers(); setNewUser({ email: '', username: '', role: 'pro', credits: '50' }); }
    setActionLoading(false);
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = { admin: 'bg-red-900/60 text-red-300 border-red-700', pro: 'bg-purple-900/60 text-purple-300 border-purple-700', free: 'bg-gray-700/60 text-gray-400 border-gray-600' };
    return map[role] || map.free;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-zinc-200 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">🛠️ Admin Panel</h1>
            <p className="text-xs text-zinc-500">Manajemen user dan kredit ScriptMate</p>
          </div>
          <button onClick={onBack} className="text-sm bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-all">← Kembali ke App</button>
        </div>

        {msg && <div className="mb-4 bg-gray-800 border border-purple-700 rounded-lg px-4 py-2 text-sm">{msg}</div>}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total User', value: stats.totalUsers, color: 'text-white' },
              { label: 'Pro User', value: stats.proUsers, color: 'text-purple-400' },
              { label: 'Free User', value: stats.freeUsers, color: 'text-zinc-400' },
              { label: 'Kredit Terjual', value: stats.totalCreditsSold, color: 'text-green-400' },
              { label: 'Kredit Terpakai', value: stats.totalCreditsUsed, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800/60 border border-purple-800/50 rounded-xl px-4 py-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['users', 'add_user'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700/50 text-zinc-400 hover:bg-gray-700'}`}>
              {t === 'users' ? '👥 Daftar User' : '➕ Tambah User'}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <>
            {/* Search & Filter */}
            <div className="flex gap-3 mb-4">
              <input type="text" placeholder="Cari email / username..." value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
                <option value="">Semua Role</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={fetchUsers} className="px-4 py-2 bg-purple-700 rounded-lg text-sm hover:bg-purple-600 transition-all">Cari</button>
            </div>

            {/* User Table */}
            <div className="bg-gray-800/60 border border-purple-800/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-800/40 bg-gray-900/50">
                      {['User', 'Role', 'Kredit', 'Status', 'Bergabung', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-8 text-zinc-500">Memuat...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-zinc-500">Tidak ada user ditemukan.</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} className="border-b border-purple-800/20 hover:bg-gray-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-200">{u.username || '—'}</p>
                          <p className="text-xs text-zinc-500">{u.email || u.phone || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select value={u.role} onChange={e => handleUpdateRole(u.id, e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border bg-transparent cursor-pointer ${roleBadge(u.role)}`}>
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-yellow-400 font-bold">{u.credits}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(u.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => setCreditModal({ user: u, amount: '', desc: '' })}
                              className="text-xs bg-purple-700/60 hover:bg-purple-700 px-2.5 py-1.5 rounded-lg transition-all">
                              💰 Kredit
                            </button>
                            <button onClick={() => handleToggleActive(u)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg transition-all ${u.is_active ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400' : 'bg-green-900/40 hover:bg-green-900/60 text-green-400'}`}>
                              {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'add_user' && (
          <div className="bg-gray-800/60 border border-purple-800/40 rounded-xl p-6 max-w-md">
            <h3 className="font-bold text-yellow-400 mb-4">Tambah User Baru</h3>
            <div className="flex flex-col gap-3">
              <input type="email" placeholder="Email user" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                className="bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input type="text" placeholder="Username" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                className="bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none">
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="admin">Admin</option>
                </select>
                <input type="number" placeholder="Kredit awal" value={newUser.credits} onChange={e => setNewUser(p => ({ ...p, credits: e.target.value }))}
                  className="bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none" />
              </div>
              <button onClick={handleAddUser} disabled={actionLoading}
                className="bg-yellow-500 text-gray-900 font-bold py-3 rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-60">
                {actionLoading ? 'Membuat...' : '➕ Tambah User'}
              </button>
              {addResult && (
                <div className={`text-xs p-3 rounded-lg border ${addResult.error ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-green-900/20 border-green-700 text-green-300'}`}>
                  {addResult.error || addResult.message}
                  {addResult.tempPassword && (
                    <p className="mt-1 font-mono bg-gray-900/60 px-2 py-1 rounded mt-2">
                      Password sementara: <strong>{addResult.tempPassword}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credit Modal */}
      {creditModal.user && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-purple-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-yellow-400 mb-1">💰 Kelola Kredit</h3>
            <p className="text-xs text-zinc-400 mb-4">{creditModal.user.email} — saldo: <strong className="text-yellow-400">{creditModal.user.credits}</strong></p>
            <div className="flex flex-col gap-3">
              <input type="number" placeholder="Jumlah kredit (- untuk kurangi)" value={creditModal.amount}
                onChange={e => setCreditModal(p => ({ ...p, amount: e.target.value }))}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input type="text" placeholder="Keterangan (opsional)" value={creditModal.desc}
                onChange={e => setCreditModal(p => ({ ...p, desc: e.target.value }))}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={handleAddCredits} disabled={actionLoading}
                  className="flex-1 bg-yellow-500 text-gray-900 font-bold py-2.5 rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-60">
                  {actionLoading ? 'Proses...' : 'Simpan'}
                </button>
                <button onClick={() => setCreditModal({ user: null, amount: '', desc: '' })}
                  className="px-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all">Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
