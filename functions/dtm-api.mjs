// netlify/functions/dtm-api.mjs
import { getStore } from '@netlify/blobs';

/**
 * Routes:
 *   GET  ?route=messages           -> { messages: string[] }
 *   PUT  ?route=messages           -> body { messages: string[] }
 *
 *   GET  ?route=records            -> { best: {...}, names:[s1,s2], keys:[[],[]] }
 *   PUT  ?route=records            -> same shape as GET
 *
 *   GET  ?route=audio&name=KEY     -> streams audio blob
 *   POST ?route=audio&name=KEY     -> uploads binary body as audio
 *   DELETE ?route=audio&name=KEY   -> deletes audio blob
 *
 *   GET  ?route=audio&list=1       -> { keys: [ ... ] }  // optional helper
 */

export async function handler(event) {
  try {
    const { httpMethod, queryStringParameters } = event;
    const route = (queryStringParameters?.route || '').toLowerCase();

    // Two stores: JSON state and audio blobs
    const dataStore = getStore('dtm-state');  // JSON docs
    const audioStore = getStore('dtm-audio'); // binary blobs

    if (route === 'messages') {
      if (httpMethod === 'GET') {
        const raw = await dataStore.get('messages.json', { type: 'json' });
        return json(200, { messages: Array.isArray(raw?.messages) ? raw.messages : [] });
      }
      if (httpMethod === 'PUT') {
        const body = safeJSON(event.body);
        const messages = Array.isArray(body?.messages) ? body.messages.slice(0, 1000) : [];
        await dataStore.set('messages.json', { messages });
        return json(200, { ok: true, count: messages.length });
      }
      return json(405, { error: 'Method not allowed' });
    }

    if (route === 'records') {
      if (httpMethod === 'GET') {
        const raw = await dataStore.get('records.json', { type: 'json' });
        return json(200, raw || { best: defaultBest(), names: ['Custom Set 1','Custom Set 2'], keys: [[],[]] });
      }
      if (httpMethod === 'PUT') {
        const body = safeJSON(event.body) || {};
        const best  = body.best  || defaultBest();
        const names = Array.isArray(body.names) && body.names.length===2 ? body.names : ['Custom Set 1','Custom Set 2'];
        const keys  = Array.isArray(body.keys)  && body.keys.length===2  ? body.keys  : [[],[]];
        await dataStore.set('records.json', { best, names, keys });
        return json(200, { ok: true });
      }
      return json(405, { error: 'Method not allowed' });
    }

    if (route === 'audio') {
      // List keys (optional helper)
      if (httpMethod === 'GET' && queryStringParameters?.list) {
        const listing = await audioStore.list();
        const keys = (listing?.objects || []).map(o => o.key);
        return json(200, { keys });
      }

      const name = queryStringParameters?.name;
      if (!name) return json(400, { error: 'Missing name' });

      if (httpMethod === 'GET') {
        // Stream audio out
        const blob = await audioStore.get(name, { type: 'blob' });
        if (!blob) return json(404, { error: 'Not found' });
        return {
          statusCode: 200,
          headers: {
            'Content-Type': guessMime(name),
            'Cache-Control': 'public, max-age=31536000, immutable'
          },
          body: Buffer.from(await blob.arrayBuffer()).toString('base64'),
          isBase64Encoded: true
        };
      }

      if (httpMethod === 'POST') {
        const contentType = event.headers['content-type'] || 'application/octet-stream';
        if (!event.isBase64Encoded) {
          // Netlify sends binary as base64 to functions; if not, still handle
        }
        const buff = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body || '', 'binary');
        await audioStore.set(name, buff, { contentType });
        return json(200, { ok: true, name });
      }

      if (httpMethod === 'DELETE') {
        await audioStore.delete(name);
        return json(200, { ok: true, name });
      }

      return json(405, { error: 'Method not allowed' });
    }

    return json(404, { error: 'Unknown route' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Server error', detail: String(err?.message || err) });
  }
}

function json(code, payload){
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}
function safeJSON(s){
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}
function defaultBest(){
  return {
    0:{ time:null, attempts:null },
    1:{ time:null, attempts:null },
    2:{ time:null, attempts:null }
  };
}
function guessMime(name=''){
  const ext = name.split('.').pop().toLowerCase();
  if (ext==='mp3') return 'audio/mpeg';
  if (ext==='wav') return 'audio/wav';
  if (ext==='ogg') return 'audio/ogg';
  if (ext==='m4a') return 'audio/mp4';
  if (ext==='flac')return 'audio/flac';
  return 'application/octet-stream';
}
