const crypto = require('crypto');

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1ni4NmSBjKhDVrQ-36LOQvyRtrfNVE4ElD1pFqtC02dI';
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
const RANGE = `${SHEET_NAME}!A:J`;
const HEADER = ['message_id','channel','username','message','created_at','device_id','type','image','files_json','edited'];

let cachedToken = null;
let cachedTokenExpires = 0;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function base64url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) throw new Error('Google service-account environment variables are not configured.');

  if (cachedToken && Date.now() < cachedTokenExpires) return cachedToken;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Could not get Google access token.');
  cachedToken = data.access_token;
  cachedTokenExpires = Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
  return cachedToken;
}

async function sheetsFetch(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data.error?.message || `Google Sheets API returned ${response.status}.`);
  return data;
}

function cleanMessage(m) {
  return {
    id: String(m.id || '').slice(0, 200),
    channel: String(m.channel || 'public').slice(0, 100),
    username: String(m.username || '').slice(0, 24),
    message: String(m.message || '').slice(0, 20000),
    created_at: m.created_at || new Date().toISOString(),
    device_id: String(m.device_id || '').slice(0, 200),
    type: m.game_message ? 'game' : (m.image ? 'image' : (Array.isArray(m.files) && m.files.length ? 'file' : 'message')),
    image: typeof m.image === 'string' && m.image.startsWith('http') ? m.image.slice(0, 2000) : '',
    files_json: JSON.stringify(Array.isArray(m.files) ? m.files.map(f => ({ name: f?.name || '', type: f?.type || '', size: f?.size || 0, audio: !!f?.audio })) : []).slice(0, 5000),
    edited: !!m.edited
  };
}

async function getRows() {
  const data = await sheetsFetch(`/values/${encodeURIComponent(RANGE)}`);
  return data.values || [];
}

async function ensureHeader(rows) {
  if (rows.length) return;
  await sheetsFetch(`/values/${encodeURIComponent(`${SHEET_NAME}!A1:J1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ range: `${SHEET_NAME}!A1:J1`, majorDimension: 'ROWS', values: [HEADER] })
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const rows = await getRows();
    await ensureHeader(rows);

    if (req.method === 'GET') {
      const messages = rows.slice(1).map(row => ({
        id: row[0] || '', channel: row[1] || 'public', username: row[2] || '', message: row[3] || '',
        created_at: row[4] || '', device_id: row[5] || '', type: row[6] || 'message',
        image: row[7] || null, files: (() => { try { return JSON.parse(row[8] || '[]'); } catch { return []; } })(),
        edited: row[9] === 'true'
      })).filter(m => m.id && m.channel === 'public');
      return json(res, 200, { success: true, messages });
    }

    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [req.body?.message || req.body];
    const existing = new Set(rows.slice(1).map(r => r[0]).filter(Boolean));
    const fresh = incoming.map(cleanMessage).filter(m => m.id && m.username && (!existing.has(m.id)));
    if (!fresh.length) return json(res, 200, { success: true, saved: 0, skipped: incoming.length });

    await sheetsFetch(`/values/${encodeURIComponent(RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: fresh.map(m => HEADER.map(k => m[k])) })
    });
    return json(res, 200, { success: true, saved: fresh.length, skipped: incoming.length - fresh.length });
  } catch (error) {
    console.error('Google Sheets sync error:', error);
    return json(res, 500, { error: error.message || 'Google Sheets sync failed.' });
  }
}
