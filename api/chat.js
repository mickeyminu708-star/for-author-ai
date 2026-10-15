export const config = { maxDuration: 60 };

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

const SYSTEM =
  'You are For Author AI, a book-creation assistant for self-publishing authors ' +
  '(stories, journals, kids books, colouring books, self-help and more). ' +
  'Write in the language the user asks for. Be clear, warm and practical. ' +
  'Never claim to have live Amazon data; market numbers are estimates.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY Vercel mein set nahi hai' });

  const { prompt, history = [] } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt missing' });

  const contents = [
    ...history.slice(-12).map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || '') }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const start = Date.now();
  let lastErr = 'Sab Gemini models abhi busy hain.';

  for (let pass = 0; pass < 2; pass++) {
    for (const model of MODELS) {
      if (Date.now() - start > 48000) break;
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 14000);
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents,
              generationConfig: { maxOutputTokens: 8192, temperature: 0.9 }
            })
          }
        );
        clearTimeout(timer);
        const data = await r.json().catch(() => ({}));

        if (r.ok) {
          const text =
            data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
          if (text) return res.status(200).json({ text, model });
          lastErr = 'Is request ka jawab block hua. Topic thoda badal ke try karo.';
          continue;
        }

        lastErr = data.error?.message || `Error ${r.status}`;
        if (r.status === 400 && /API key/i.test(lastErr)) return res.status(400).json({ error: lastErr });
        if (r.status === 401 || r.status === 403) return res.status(r.status).json({ error: lastErr });
        await sleep(400);
      } catch (e) {
        lastErr = e.name === 'AbortError' ? 'Model ne der lagayi, agla try ho raha hai.' : String(e);
      }
    }
    await sleep(1500);
  }
  return res.status(503).json({ error: lastErr + ' 1-2 minute baad dobara try karo.' });
}
