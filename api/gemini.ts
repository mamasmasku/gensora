import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client — pakai SERVICE ROLE KEY (bukan anon key)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userPrompt,
    systemInstruction,
    temperature = 0.8,
    useSearch = false,
    apiKey, // dari free user
  } = req.body;

  if (!userPrompt || !systemInstruction) {
    return res.status(400).json({ error: 'userPrompt dan systemInstruction wajib diisi' });
  }

  // ── Cek auth token dari header ─────────────────────────────
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  let userId: string | null = null;
  let isProUser = false;
  let currentCredits = 0;

  if (token) {
    // Verifikasi token Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      userId = user.id;

      // Ambil profile untuk cek role & kredit
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, credits')
        .eq('id', userId)
        .single();

      if (profile) {
        isProUser = profile.role === 'pro' || profile.role === 'admin';
        currentCredits = profile.credits;
      }
    }
  }

  // ── Tentukan API key yang dipakai ──────────────────────────
  // Pro user → pakai server key
  // Free user → pakai apiKey dari body
  const geminiKey = isProUser
    ? process.env.GEMINI_API_KEY!
    : apiKey;

  if (!geminiKey) {
    return res.status(401).json({
      error: 'API Key diperlukan. Pro user otomatis, Free user input sendiri.'
    });
  }

  // ── Pro user: cek kredit minimal 1 sebelum generate ───────
  if (isProUser && currentCredits < 1) {
    return res.status(402).json({ error: 'KREDIT_HABIS' });
  }

  try {
    const client = new OpenAI({
      apiKey: geminiKey,
      baseURL: 'https://litellm.koboi2026.biz.id/v1',
    });

    const response = await client.chat.completions.create({
      model: 'gemini-2.5-flash',
      temperature,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content || '';

    // ── Hitung jumlah segmen di output ─────────────────────
    // Pola: "▶ SEGMEN 1", "▶ SEGMEN 2", dst
    const segmentMatches = text.match(/▶ SEGMEN \d+/g) || [];
    const segmentCount = segmentMatches.length;
    const creditsToDeduct = Math.max(segmentCount, 1); // minimal 1 kredit

    // ── Potong kredit untuk Pro user ───────────────────────
    let newCredits = currentCredits;
    if (isProUser && userId && segmentCount > 0) {

      // Cek kredit cukup untuk semua segmen
      if (currentCredits < creditsToDeduct) {
        return res.status(402).json({
          error: 'KREDIT_HABIS',
          needed: creditsToDeduct,
          current: currentCredits,
        });
      }

      // Kurangi kredit
      const { data: updated } = await supabase
        .from('profiles')
        .update({ credits: currentCredits - creditsToDeduct })
        .eq('id', userId)
        .select('credits')
        .single();

      if (updated) {
        newCredits = updated.credits;
      }

      // Catat transaksi ke tabel credit_transactions
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -creditsToDeduct,
        type: 'usage',
        description: `Generate ${segmentCount} segmen prompt`,
        balance_after: newCredits,
      });
    }

    return res.status(200).json({
      text,
      credits: isProUser ? newCredits : null,      // kirim balik sisa kredit
      segments_used: segmentCount,                  // info berapa segmen
      credits_used: isProUser ? creditsToDeduct : 0,
    });

  } catch (error: any) {
    console.error('LiteLLM error:', error);
    return res.status(500).json({
      error: error.message || 'Terjadi kesalahan pada server'
    });
  }
}