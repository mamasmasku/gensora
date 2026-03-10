import { createClient } from '@supabase/supabase-js';
import midtransClient from 'midtrans-client';

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiClient = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_ENV === 'production',
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
    });

    const statusResponse = await apiClient.transaction.notification(req.body);
    const { order_id, transaction_status, fraud_status, payment_type } = statusResponse;

    const { data: order } = await supabaseAdmin
      .from('payment_orders').select('*').eq('order_id', order_id).single();

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    if (order.status === 'paid') return res.status(200).json({ message: 'Already processed.' });

    let newStatus = order.status;

    if (transaction_status === 'capture' && fraud_status === 'accept') newStatus = 'paid';
    else if (transaction_status === 'settlement') newStatus = 'paid';
    else if (['cancel', 'deny', 'expire'].includes(transaction_status)) newStatus = transaction_status as any;

    await supabaseAdmin.from('payment_orders').update({
      status: newStatus, payment_type, updated_at: new Date().toISOString(),
    }).eq('order_id', order_id);

    if (newStatus === 'paid') {
      const { data: newCredits } = await supabaseAdmin
        .rpc('add_credit', { p_user_id: order.user_id, p_amount: order.credits });

      await supabaseAdmin.from('credit_transactions').insert({
        user_id: order.user_id, amount: order.credits, type: 'purchase',
        description: `Beli paket ${order.package_name}`, order_id: order_id,
        balance_after: newCredits ?? 0,
      });

      // Upgrade user ke Pro jika belum
      await supabaseAdmin.from('profiles')
        .update({ role: 'pro' }).eq('id', order.user_id).eq('role', 'free');
    }

    return res.status(200).json({ message: 'OK' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
