const json = (s, b) => ({ statusCode: s, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(b), }); const ok = (b)=>json(200,b), created=(b)=>json(201,b), bad=(m,s=400)=>json(s,{error:m});

exports.handler = async (event) => { // CORS preflight if (event.httpMethod === 'OPTIONS') { return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', }, body: '', }; }

const { getStore } = await import('@netlify/blobs'); const store = getStore('dtm-store');

const url = new URL(event.rawUrl); const route = url.searchParams.get('route') || ''; const name = url.searchParams.get('name') || '';

try { // ----- records (best times/attempts + custom set names/keys) ----- if (route === 'records') { if (event.httpMethod === 'GET') { const txt = await store.get('records.json', { type: 'text' }); return ok(txt ? JSON.parse(txt) : { best:{0:{},1:{},2:{}}, names:['Custom Set 1','Custom Set 2'], keys:[[],[]] }); } if (event.httpMethod === 'PUT') { const body = JSON.parse(event.body || '{}'); await store.set('records.json', JSON.stringify(body), { contentType: 'application/json' }); return ok({ ok:true }); } return bad('Method not allowed', 405); }

// ----------------------- ticker messages ------------------------ if (route === 'messages') { if (event.httpMethod === 'GET') { const txt = await store.get('messages.json', { type: 'text' }); return ok({ messages: txt ? JSON.parse(txt) : [] }); } if (event.httpMethod === 'PUT') { const { messages } = JSON.parse(event.body || '{}'); await store.set('messages.json', JSON.stringify(Array.isArray(messages)?messages:[]), { contentType: 'application/json' }); return ok({ ok:true }); } return bad('Method not allowed', 405); }

// --------------------------- audio ------------------------------ if (route === 'audio') { if (!name) return bad('Missing ?name=');

if (event.httpMethod === 'POST') { const buf = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8'); const ct = event.headers['content-type'] || 'application/octet-stream'; await store.set(name, buf, { contentType: ct }); return created({ key: name }); }

if (event.httpMethod === 'GET') { const arr = await store.get(name, { type: 'arrayBuffer' }); if (!arr) return bad('Not found', 404); return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', }, body: Buffer.from(arr).toString('base64'), isBase64Encoded: true, }; }

if (event.httpMethod === 'DELETE') { await store.delete(name); return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }; }

return bad('Method not allowed', 405); }

return bad('Unknown route', 404); } catch (e) { console.error(e); return bad(e.message || 'Server error', 500); } };
