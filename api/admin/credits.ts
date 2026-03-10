import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function verifyAdmin(token: string) {
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: p } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return p?.role === 'admin' ? user : null;
}

export default async function handler(req: any, res: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi.' });
  const admin = await verifyAdmin(token);
  if (!admin) return res.status(403).json({ error: 'Admin only.' });

  if (req.method === 'POST') {
    const { userId, amount, description } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'userId dan amount wajib.' });

    const { data: newCredits, error } = await supabaseAdmin
      .rpc(amount > 0 ? 'add_credit' : 'deduct_credit', {
        p_user_id: userId, p_amount: Math.abs(amount),
      });
    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: userId, amount, type: 'admin_add',
      description: description || `Kredit ditambahkan oleh admin`, balance_after: newCredits ?? 0,
    });

    // Auto upgrade ke Pro jika dapat kredit dan masih free
    if (amount > 0) {
      await supabaseAdmin.from('profiles').update({ role: 'pro' }).eq('id', userId).eq('role', 'free');
    }

    return res.status(200).json({ message: 'Kredit diperbarui.', newBalance: newCredits });
  }

  // GET: ambil statistik
  if (req.method === 'GET') {
    const [usersResult, transResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('role', { count: 'exact' }),
      supabaseAdmin.from('credit_transactions').select('amount, type'),
    ]);

    const users = usersResult.data || [];
    const trans = transResult.data || [];

    const stats = {
      totalUsers: users.length,
      proUsers: users.filter(u => u.role === 'pro' || u.role === 'admin').length,
      freeUsers: users.filter(u => u.role === 'free').length,
      totalCreditsSold: trans.filter(t => t.type === 'purchase').reduce((s, t) => s + t.amount, 0),
      totalCreditsUsed: Math.abs(trans.filter(t => t.type === 'usage').reduce((s, t) => s + t.amount, 0)),
    };

    return res.status(200).json(stats);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
