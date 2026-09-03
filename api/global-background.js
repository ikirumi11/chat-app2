export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !key) {
    return res.status(500).json({ error: 'Supabase environment is not configured' });
  }

  const endpoint = `${supabaseUrl}/rest/v1/chat_global_settings?id=eq.1`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(endpoint, { headers });
      if (!r.ok) return res.status(r.status).json({ error: 'Could not load background' });
      const rows = await r.json();
      return res.status(200).json(rows[0] || { url: '' });
    }

    if (req.method === 'POST') {
      const { url: imageUrl } = req.body || {};

      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.length > 2000000) {
        return res.status(400).json({ error: 'Invalid background image or URL' });
      }

      let finalUrl = imageUrl.trim();

      // Uploaded files arrive from the browser as a compressed data URL.
      // Store them in Supabase Storage and save the resulting public URL.
      if (finalUrl.startsWith('data:image/')) {
        const match = finalUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
        if (!match) {
          return res.status(400).json({ error: 'Unsupported uploaded image format' });
        }

        const contentType = match[1];
        const base64 = match[2];
        const binary = Buffer.from(base64, 'base64');

        if (!binary.length || binary.length > 2 * 1024 * 1024) {
          return res.status(400).json({ error: 'Uploaded image is too large' });
        }

        const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        const path = `global-background/background-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
        const bucket = 'global-background';

        // Create the public bucket if it does not exist yet.
        const bucketCheck = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });

        if (!bucketCheck.ok) {
          const createBucket = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: bucket, name: bucket, public: true })
          });

          // 409 means another request created it between our check and create.
          if (!createBucket.ok && createBucket.status !== 409) {
            return res.status(502).json({ error: 'Could not create Supabase background storage bucket' });
          }
        }

        const upload = await fetch(
          `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
          {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': contentType,
              'x-upsert': 'true',
              'cache-control': '3600'
            },
            body: binary
          }
        );

        if (!upload.ok) {
          const details = await upload.text().catch(() => '');
          console.error('Supabase Storage upload failed:', details);
          return res.status(502).json({ error: 'Could not upload background image to Supabase Storage' });
        }

        finalUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
      } else {
        // URL mode: only store normal HTTP(S) image URLs. We do not fetch them server-side.
        let parsed;
        try {
          parsed = new URL(finalUrl);
        } catch (e) {
          return res.status(400).json({ error: 'Enter a valid image URL' });
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return res.status(400).json({ error: 'Image URL must use http:// or https://' });
        }
      }

      const r = await fetch(`${supabaseUrl}/rest/v1/chat_global_settings`, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          id: 1,
          url: finalUrl,
          updated_at: new Date().toISOString()
        })
      });

      if (!r.ok) {
        const details = await r.text().catch(() => '');
        console.error('Could not save background setting:', details);
        return res.status(r.status).json({ error: 'Could not save background' });
      }

      return res.status(200).json({ url: finalUrl });
    }

    if (req.method === 'DELETE') {
      const r = await fetch(endpoint, { method: 'DELETE', headers });
      if (!r.ok) return res.status(r.status).json({ error: 'Could not clear background' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).end();
  } catch (error) {
    console.error('Global background API error:', error);
    return res.status(500).json({ error: 'Global background server error' });
  }
}
