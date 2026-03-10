import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userPrompt, systemInstruction, temperature = 0.8, useSearch = false } = req.body;

  if (!userPrompt || !systemInstruction) {
    return res.status(400).json({ error: 'userPrompt dan systemInstruction wajib diisi' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // @ts-ignore
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature,
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini error:', error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server' });
  }
}
