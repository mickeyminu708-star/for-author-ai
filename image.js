export const config = { maxDuration: 60 };

// Google se poochhta hai ki is key par kaun se image-generation models hain, phir unhi ko try karta hai.
async function listImageModels(key) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `ListModels ${r.status}`);
  return (d.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /image/i.test(n))
    // Flash wale pehle (free quota aksar inhi ka hota hai), phir baaki
    .sort((a, b) => (/flash/i.test(b) ? 1 : 0) - (/flash/i.test(a) ? 1 : 0) || b.localeCompare(a));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt missing' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ fallback: true, reason: 'GEMINI_API_KEY missing' });

  let models;
  try {
    models = await listImageModels(key);
  } catch (e) {
    return res.status(200).json({ fallback: true, reason: 'Model list nahi aayi: ' + String(e.message || e) });
  }
  if (!models.length) {
    return res.status(200).json({ fallback: true, reason: 'Is key par koi image model available nahi' });
  }

  const errs = [];
  for (const model of models.slice(0, 6)) {
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
          return res.status(200).json({ mime: inl.mimeType || inl.mime_type || 'image/png', data: inl.data, model });
        }
        errs.push(`${model}: image nahi di`);
        continue;
      }
      errs.push(`${model}: ${(d.error?.message || r.status).slice(0, 80)}`);
      if (r.status === 401 || r.status === 403) break;
    } catch (e) {
      errs.push(`${model}: ${String(e)}`);
    }
  }
  const found = models.join(', ');
  return res.status(200).json({ fallback: true, reason: `Models: ${found} | ${errs.join(' || ')}` });
}
