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
    // Naye models pehle
    .sort((a, b) => b.localeCompare(a));
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

  let last = '';
  for (const model of models.slice(0, 4)) {
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
        last = `${model}: image nahi di`;
        continue;
      }
      last = `${model}: ${d.error?.message || r.status}`;
      if (r.status === 401 || r.status === 403) break;
    } catch (e) {
      last = `${model}: ${String(e)}`;
    }
  }
  return res.status(200).json({ fallback: true, reason: last || 'Image models fail hue' });
}
