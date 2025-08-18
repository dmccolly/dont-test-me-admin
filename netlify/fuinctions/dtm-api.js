// netlify/functions/dtm-api.js
// Persistence + audio upload/stream/delete using Netlify Blobs.
// Works with the single-file index.html I gave you.

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
const ok = (body, extra = {}) => ({
  statusCode: 200,
  headers: { 'Access-Control-Allow-Origin': '*', ...extra },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const created = (body) => ({
  statusCode: 201,
  headers: { 'Access-Control-Allow-Origin': '*', ...jsonHeaders },
  body: JSON.stringify(body || { ok: true }),
});
const noContent = () => ({
  statusCode: 204,
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' },
  body: '',
});
const bad = (msg, code = 400) => ({
  statusCode: code,
  headers: { 'Access-Control-Allow-Origin': '*', ...jsonHeaders },
  body: JSON.stringify({ error: msg }),
});

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  const { getStore } = await import('@netlify/blobs');
  // One logical store for everything (Netlify creates it automatically)
  const store = getStore('dtm-store');

  const url = new URL(event.rawUrl || `http://x${event.path}${event.queryString ? '?' + event.queryString : ''}`);
  const route = url.searchParams.get('route') || '';
  const name = url.searchParams.get('name') || '';

  try {
    // ---------- records (best times/attempts, custom set names & keys) ----------
    if (route === 'records') {
      if (event.httpMethod === 'GET') {
        const txt = await store.get('records.json', { type: 'text' });
        if (!txt) return ok({ best: {0:{},1:{},2:{}}, names: ['Custom Set 1','Custom Set 2'], keys: [[],[]] });
        return ok(JSON.parse(txt));
      }
      if (event.httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        await store.set('records.json', JSON.stringify(body), { contentType: 'application/json' });
        return ok({ ok: true });
      }
      return bad('Method not allowed', 405);
    }

    // ---------- messages (ticker list) ----------
    if (route === 'messages') {
      if (event.httpMethod === 'GET') {
        const txt = await store.get('messages.json', { type: 'text' });
        const messages = txt ? JSON.parse(txt) : [];
        return ok({ messages });
      }
      if (event.httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const messages = Array.isArray(body.messages) ? body.messages : [];
        await store.set('messages.json', JSON.stringify(messages), { contentType: 'application/json' });
        return ok({ count: messages.length });
      }
      return bad('Method not allowed', 405);
    }

    // ---------- audio (upload/stream/delete) ----------
    if (route === 'audio') {
      if (!name) return bad('Missing ?name=');

      if (event.httpMethod === 'POST') {
        // Body is raw bytes; keep original content-type if present
        const buf = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
        const ct = event.headers['content-type'] || 'application/octet-stream';
        await store.set(name, buf, { contentType: ct });
        return created({ key: name });
      }

      if (event.httpMethod === 'GET') {
        const arr = await store.get(name, { type: 'arrayBuffer' });
        if (!arr) return bad('Not found', 404);
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': event.headers['content-type'] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          body: Buffer.from(arr),
          isBase64Encoded: true, // Netlify will base64-encode Buffers for us
        };
      }

      if (event.httpMethod === 'DELETE') {
        await store.delete(name);
        return noContent();
      }

      return bad('Method not allowed', 405);
    }

    return bad('Unknown route', 404);
  } catch (err) {
    console.error(err);
    return bad(err.message || 'Server error', 500);
  }
};
