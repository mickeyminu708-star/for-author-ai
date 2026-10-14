

export const config = { maxDuration: 60 };

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash'
];

const SYSTEM =
  'You are For Author AI, a helpful book-writing assistant for self-publishing authors. ' +
  'Write in the language the user asks for. Be clear, warm and practical.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt missing' });

    let lastMsg = 'Busy hai, thodi der baad try karo.';

    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            })
          }
        );
        const data = await r.json();

        if (r.ok) {
          const text =
            data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
          return res.status(200).json({ text });
        }

        lastMsg = data.error?.message || lastMsg;
        const busy =
          [429, 500, 503, 504].includes(r.status) || /demand|overload|unavailable/i.test(lastMsg);
        if (!busy) return res.status(r.status).json({ error: lastMsg });
        await sleep(1200);
      }
    }
    return res.status(503).json({ error: 'Abhi sab models busy hain. 1-2 minute baad dobara try karo.' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
