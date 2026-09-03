export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Supabase environment is not configured' });
  const endpoint = `${url}/rest/v1/chat_global_settings?id=eq.1`;
  const headers = { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' };

  if (req.method === 'GET') {
    const r = await fetch(endpoint, { headers });
    if (!r.ok) return res.status(r.status).json({ error:'Could not load background' });
    const rows = await r.json();
    return res.status(200).json(rows[0] || { url:'' });
  }

  if (req.method === 'POST') {
    const { url: imageUrl } = req.body || {};
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.length > 2000) return res.status(400).json({error:'Invalid URL'});
    const r = await fetch(`${url}/rest/v1/chat_global_settings`, {
      method:'POST', headers:{...headers, Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({id:1,url:imageUrl,updated_at:new Date().toISOString()})
    });
    if (!r.ok) return res.status(r.status).json({error:'Could not save background'});
    return res.status(200).json({url:imageUrl});
  }

  if (req.method === 'DELETE') {
    const r = await fetch(endpoint, {method:'DELETE',headers});
    if (!r.ok) return res.status(r.status).json({error:'Could not clear background'});
    return res.status(200).json({ok:true});
  }
  res.setHeader('Allow','GET,POST,DELETE');
  return res.status(405).end();
}
