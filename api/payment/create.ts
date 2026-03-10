import { createClient } from '@supabase/supabase-js';
import midtransClient from 'midtrans-client';

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const PACKAGES: Record<string, { name: string; credits: number; price: number }> = {
  starter: { name: 'Starter',  credits: 30,  price: 15000  },
  popular: { name: 'Popular',  credits: 100, price: 45000  },
  pro:     { name: 'Pro',      credits: 300, price: 120000 },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi.' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Sesi tidak valid.' });

  const { packageId } = req.body;
  const pkg = PACKAGES[packageId];
  if (!pkg) return res.status(400).json({ error: 'Paket tidak valid.' });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('email, username').eq('id', user.id).single();

  const orderId = `SCM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_ENV === 'production',
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
  });

  try {
    const snapToken = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: pkg.price },
      item_details: [{ id: packageId, price: pkg.price, quantity: 1, name: `ScriptMate - ${pkg.name} (${pkg.credits} Kredit)` }],
      customer_details: { email: profile?.email || user.email || '', first_name: profile?.username || 'User' },
    });

    await supabaseAdmin.from('payment_orders').insert({
      user_id: user.id, order_id: orderId, package_name: pkg.name,
      amount_idr: pkg.price, credits: pkg.credits, status: 'pending',
      snap_token: snapToken.token, snap_url: snapToken.redirect_url,
    });

    return res.status(200).json({ snapToken: snapToken.token, orderId, package: pkg });
  } catch (err: any) {
    console.error('Midtrans error:', err);
    return res.status(500).json({ error: 'Gagal membuat transaksi.' });
  }
}
