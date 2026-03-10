import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function verifyAdmin(token: string) {
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

export default async function handler(req: any, res: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi.' });

  const admin = await verifyAdmin(token);
  if (!admin) return res.status(403).json({ error: 'Akses ditolak. Admin only.' });

  // GET: list semua users
  if (req.method === 'GET') {
    const { search, role, page = 1, limit = 20 } = req.query;
    let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });

    if (search) query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    if (role) query = query.eq('role', role);

    const from = (Number(page) - 1) * Number(limit);
    query = query.order('created_at', { ascending: false }).range(from, from + Number(limit) - 1);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: data, total: count });
  }

  // POST: tambah user baru atau update role
  if (req.method === 'POST') {
    const { action, userId, email, role, credits, username } = req.body;

    if (action === 'create') {
      // Buat user baru via Supabase Admin
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { name: username || email.split('@')[0] },
      });
      if (error) return res.status(400).json({ error: error.message });

      // Update profile
      await supabaseAdmin.from('profiles').update({
        role: role || 'free', credits: credits || 0, username: username || null,
      }).eq('id', newUser.user.id);

      return res.status(200).json({ 
        user: newUser.user, 
        tempPassword,
        message: 'User dibuat. Kirimkan password sementara ke user.' 
      });
    }

    if (action === 'update_role') {
      await supabaseAdmin.from('profiles').update({ role }).eq('id', userId);
      return res.status(200).json({ message: 'Role diperbarui.' });
    }

    if (action === 'toggle_active') {
      const { data: current } = await supabaseAdmin.from('profiles').select('is_active').eq('id', userId).single();
      await supabaseAdmin.from('profiles').update({ is_active: !current?.is_active }).eq('id', userId);
      return res.status(200).json({ message: 'Status diperbarui.' });
    }

    return res.status(400).json({ error: 'Action tidak valid.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
