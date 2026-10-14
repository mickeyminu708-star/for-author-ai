export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY set nahi hai.' });
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt khali hai.' });
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are For Author AI, a writing assistant used only for book creation: stories, journals, kids books, self-help, colouring book ideas, titles, blurbs, KDP keywords. Reply in the language the user asks for.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'AI error (shayad aaj ki free limit khatam).' });
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
