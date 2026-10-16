export const config = { maxDuration: 60 };

// Gemini image models, ek ke baad ek. Naam Google badal sakta hai, isliye list mein kai rakhe hain.
const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt missing' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ fallback: true, reason: 'GEMINI_API_KEY missing' });

  let last = '';
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
          })
        }
      );
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const parts = d.candidates?.[0]?.content?.parts || [];
        const part = parts.find((p) => p.inlineData || p.inline_data);
        const inl = part && (part.inlineData || part.inline_data);
        if (inl?.data) {
          return res.status(200).json({
            mime: inl.mimeType || inl.mime_type || 'image/png',
            data: inl.data,
            model
          });
        }
        last = 'Model ne image nahi di';
        continue;
      }
      last = d.error?.message || `Error ${r.status}`;
      // Key galat ho to aage try karna bekaar hai
      if (r.status === 401 || r.status === 403) break;
    } catch (e) {
      last = String(e);
    }
  }
  // Fallback: client Pollinations se banayega
  return res.status(200).json({ fallback: true, reason: last });
}
