'use strict';
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const crypto = require('crypto');
const L = require('./lib');
const { notifyOrder, email, telegram } = require('./notify');

const { ddb, HttpError, T } = L;
const s3 = new S3Client({});

const json = (status, body, extra) => ({
  statusCode: status,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}),
  body: JSON.stringify(body),
});

const parse = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (raw.length > 200000) throw new HttpError(413, 'Requête trop volumineuse.');
  try { return JSON.parse(raw); } catch (e) { throw new HttpError(400, 'JSON invalide.'); }
};

/* ---------------- PUBLIC ---------------- */

async function catalog() {
  const [cfg, products] = await Promise.all([L.getConfig(), L.scanAll(T.products())]);
  const pub = products.filter((p) => p.status === 'published')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const settings = {};
  L.PUBLIC_SETTINGS.forEach((k) => { settings[k] = cfg.settings[k]; });
  return json(200, { settings, categories: cfg.categories, pages: cfg.pages, products: pub });
}

function publicConfig() {
  return json(200, { region: process.env.AWS_REGION, clientId: process.env.USER_POOL_CLIENT_ID });
}

async function createOrder(event) {
  const b = parse(event);
  if (b.hp) return json(200, { ref: 'ESS-000000-0000', sub: 0, lines: [] }); // honeypot (robots)
  const key = String(b.key || '');
  if (!/^[\w-]{8,64}$/.test(key)) throw new HttpError(400, 'Commande invalide.');

  // Idempotence : si la même commande est renvoyée (double clic, réseau lent), on renvoie la première.
  const prev = await ddb.send(new GetCommand({ TableName: T.orders(), Key: { id: key } }));
  if (prev.Item) return json(200, { ref: prev.Item.ref, sub: prev.Item.sub, lines: prev.Item.lines });

  const name = L.str(b.name, 100, 3);
  const city = L.str(b.city, 80, 2);
  const address = L.str(b.address, 300);
  const intl = L.normPhone(b.phone);
  if (!intl) throw new HttpError(400, 'Numéro de téléphone marocain invalide.');
  const phone = '0' + intl.slice(3);
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 20) throw new HttpError(400, 'Panier invalide.');

  // Regroupe par parfum, vérifie prix et stock côté serveur (on ne fait jamais confiance au navigateur).
  const byProduct = new Map();
  for (const ln of b.lines) {
    const pid = String(ln.p || ''), vid = String(ln.v || ''), q = Math.floor(Number(ln.q));
    if (!pid || !vid || !(q >= 1 && q <= 20)) throw new HttpError(400, 'Panier invalide.');
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push({ vid, q });
  }
  const lines = [];
  const updates = [];
  for (const [pid, wanted] of byProduct) {
    const r = await ddb.send(new GetCommand({ TableName: T.products(), Key: { id: pid } }));
    const p = r.Item;
    if (!p || p.status !== 'published') throw new HttpError(409, 'Un article n’est plus disponible. Votre panier a été mis à jour.');
    const names = {}, vals = { ':pub': 'published' };
    const sets = [], conds = ['#st = :pub'];
    const seenV = new Set();
    wanted.forEach((w, n) => {
      if (seenV.has(w.vid)) throw new HttpError(400, 'Panier invalide.');
      seenV.add(w.vid);
      const idx = (p.variants || []).findIndex((v) => v.id === w.vid);
      const v = idx >= 0 ? p.variants[idx] : null;
      if (!v || !v.active) throw new HttpError(409, `${p.name} : cette option n’est plus disponible.`);
      if (Number(v.stock) < w.q) throw new HttpError(409, `${p.name} (${L.vlabel(v)}) : stock insuffisant (${Math.max(0, Number(v.stock))} disponible).`);
      sets.push(`variants[${idx}].#sk = variants[${idx}].#sk - :q${n}`);
      conds.push(`variants[${idx}].#vi = :id${n} AND variants[${idx}].#sk >= :q${n}`);
      vals[`:q${n}`] = w.q; vals[`:id${n}`] = w.vid;
      lines.push({ q: w.q, pid, vid: w.vid, name: p.name, brand: p.brand, fmt: L.vlabel(v), price: Number(v.price) });
    });
    names['#st'] = 'status'; names['#sk'] = 'stock'; names['#vi'] = 'id';
    updates.push({ Update: {
      TableName: T.products(), Key: { id: pid },
      UpdateExpression: 'SET ' + sets.join(', '),
      ConditionExpression: conds.join(' AND '),
      ExpressionAttributeNames: names, ExpressionAttributeValues: vals,
    } });
  }
  const sub = lines.reduce((a, l) => a + l.q * l.price, 0);
  const d = new Date();
  const ymd = String(d.getUTCFullYear()).slice(2) + ('0' + (d.getUTCMonth() + 1)).slice(-2) + ('0' + d.getUTCDate()).slice(-2);
  const ref = /^ESS-\d{6}-[a-z0-9]{4}$/.test(String(b.ref || '')) ? b.ref
    : 'ESS-' + ymd + '-' + crypto.randomBytes(3).toString('hex').slice(0, 4);
  const order = { id: key, ref, createdAt: d.toISOString(), status: 'new', name, phone, phoneIntl: intl, city, address, lines, sub };

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: updates.concat([{
      Put: { TableName: T.orders(), Item: order, ConditionExpression: 'attribute_not_exists(id)' },
    }]) }));
  } catch (e) {
    if (e.name === 'TransactionCanceledException') {
      throw new HttpError(409, 'Le stock vient de changer. Votre panier a été mis à jour, vérifiez-le puis validez à nouveau.');
    }
    throw e;
  }

  const cfg = await L.getConfig().catch(() => ({ settings: { brand: 'ESSOUFI' } }));
  const ownerWa = L.normPhone(cfg.settings.whatsapp);
  await notifyOrder(order, cfg.settings.brand, ownerWa).catch((e) => console.error('notify', e && e.message));
  return json(200, { ref, sub, lines: lines.map(({ q, name, brand, fmt, price }) => ({ q, name, brand, fmt, price })) });
}

/* ---------------- ADMIN ---------------- */

async function adminProducts() {
  const items = await L.scanAll(T.products());
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return json(200, { products: items });
}

async function saveProduct(event, id) {
  const body = parse(event);
  let existing = null;
  if (id) {
    const r = await ddb.send(new GetCommand({ TableName: T.products(), Key: { id } }));
    existing = r.Item;
    if (!existing) throw new HttpError(404, 'Produit introuvable.');
  }
  const p = L.cleanProduct(body, existing);
  const all = await L.scanAll(T.products());
  if (all.some((x) => x.slug === p.slug && x.id !== p.id)) throw new HttpError(400, 'Un autre produit utilise déjà cette adresse (slug).');
  await ddb.send(new PutCommand(existing
    ? { TableName: T.products(), Item: p }
    : { TableName: T.products(), Item: p, ConditionExpression: 'attribute_not_exists(id)' }));
  return json(200, { product: p });
}

async function deleteProduct(id) {
  await ddb.send(new DeleteCommand({ TableName: T.products(), Key: { id } }));
  return json(200, { ok: true });
}

async function setStock(event) {
  const b = parse(event);
  const stock = Math.floor(Number(b.stock));
  if (!(stock >= 0 && stock <= 100000)) throw new HttpError(400, 'Stock invalide.');
  const r = await ddb.send(new GetCommand({ TableName: T.products(), Key: { id: String(b.productId || '') } }));
  if (!r.Item) throw new HttpError(404, 'Produit introuvable.');
  const idx = (r.Item.variants || []).findIndex((v) => v.id === b.variantId);
  if (idx < 0) throw new HttpError(404, 'Option introuvable.');
  await ddb.send(new UpdateCommand({
    TableName: T.products(), Key: { id: r.Item.id },
    UpdateExpression: `SET variants[${idx}].#sk = :s`,
    ConditionExpression: `variants[${idx}].#vi = :v`,
    ExpressionAttributeNames: { '#sk': 'stock', '#vi': 'id' },
    ExpressionAttributeValues: { ':s': stock, ':v': b.variantId },
  }));
  return json(200, { ok: true, stock });
}

async function uploadUrl(event) {
  const b = parse(event);
  const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = types[b.contentType];
  if (!ext) throw new HttpError(400, 'Format refusé : JPG, PNG ou WebP.');
  const file = crypto.randomBytes(10).toString('hex') + '.' + ext;
  const Key = 'img/' + file;
  const post = await createPresignedPost(s3, {
    Bucket: process.env.IMAGES_BUCKET, Key,
    Conditions: [['content-length-range', 1, 4 * 1024 * 1024], ['eq', '$Content-Type', b.contentType],
      ['eq', '$Cache-Control', 'public, max-age=31536000, immutable']],
    Fields: { 'Content-Type': b.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    Expires: 300,
  });
  return json(200, { url: post.url, fields: post.fields, path: '/img/' + file });
}

async function adminOrders() {
  const items = await L.scanAll(T.orders());
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json(200, { orders: items.slice(0, 500) });
}

async function setOrderStatus(event, id) {
  const b = parse(event);
  const status = b.status;
  if (!['new', 'confirmed', 'delivered', 'cancelled'].includes(status)) throw new HttpError(400, 'Statut invalide.');
  const r = await ddb.send(new GetCommand({ TableName: T.orders(), Key: { id } }));
  const o = r.Item;
  if (!o) throw new HttpError(404, 'Commande introuvable.');
  if (o.status === status) return json(200, { order: o });
  if (o.status === 'cancelled') throw new HttpError(400, 'Une commande annulée ne peut plus changer de statut.');
  try {
    await ddb.send(new UpdateCommand({
      TableName: T.orders(), Key: { id },
      UpdateExpression: 'SET #s = :s, updatedAt = :t',
      ConditionExpression: '#s = :old',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':old': o.status, ':t': new Date().toISOString() },
    }));
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'La commande a changé, rechargez la liste.');
    throw e;
  }
  if (status === 'cancelled') {
    for (const ln of o.lines) { // remet le stock
      const pr = await ddb.send(new GetCommand({ TableName: T.products(), Key: { id: ln.pid } }));
      const idx = pr.Item ? (pr.Item.variants || []).findIndex((v) => v.id === ln.vid) : -1;
      if (idx < 0) continue;
      await ddb.send(new UpdateCommand({
        TableName: T.products(), Key: { id: ln.pid },
        UpdateExpression: `SET variants[${idx}].#sk = variants[${idx}].#sk + :q`,
        ConditionExpression: `variants[${idx}].#vi = :v`,
        ExpressionAttributeNames: { '#sk': 'stock', '#vi': 'id' },
        ExpressionAttributeValues: { ':q': ln.q, ':v': ln.vid },
      })).catch((e) => console.error('restock', e.message));
    }
  }
  return json(200, { order: Object.assign({}, o, { status }) });
}

async function getAdminConfig() {
  return json(200, await L.getConfig());
}

async function putAdminConfig(event) {
  const c = L.cleanConfig(parse(event));
  await ddb.send(new PutCommand({ TableName: T.config(), Item: Object.assign({ id: 'site', updatedAt: Date.now() }, c) }));
  return json(200, c);
}

async function testNotify() {
  const cfg = await L.getConfig();
  const msg = `Test de notification ${cfg.settings.brand} : si vous lisez ceci, les commandes vous parviendront ici.`;
  const res = await Promise.allSettled([email('Test de notification ' + cfg.settings.brand, msg), telegram(msg)]);
  return json(200, {
    email: res[0].status === 'fulfilled' ? 'ok' : String(res[0].reason && res[0].reason.message),
    telegram: res[1].status === 'fulfilled' ? 'ok' : String(res[1].reason && res[1].reason.message),
  });
}

/* ---------------- ROUTER ---------------- */

exports.handler = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath.replace(/\/+$/, '') || '/';
  try {
    if (method === 'GET' && path === '/api/config') return publicConfig();
    if (method === 'GET' && path === '/api/catalog') return await catalog();
    if (method === 'POST' && path === '/api/orders') return await createOrder(event);

    if (path.startsWith('/api/admin/')) {
      // Double sécurité : l'authorizer JWT bloque déjà les appels sans connexion.
      const claims = event.requestContext.authorizer && event.requestContext.authorizer.jwt;
      if (!claims) throw new HttpError(401, 'Connexion requise.');
      const seg = path.split('/').slice(3); // après /api/admin
      const [a, id] = seg;
      if (a === 'products' && !id && method === 'GET') return await adminProducts();
      if (a === 'products' && !id && method === 'POST') return await saveProduct(event, null);
      if (a === 'products' && id && method === 'PUT') return await saveProduct(event, id);
      if (a === 'products' && id && method === 'DELETE') return await deleteProduct(id);
      if (a === 'stock' && method === 'PATCH') return await setStock(event);
      if (a === 'upload-url' && method === 'POST') return await uploadUrl(event);
      if (a === 'orders' && !id && method === 'GET') return await adminOrders();
      if (a === 'orders' && id && method === 'PATCH') return await setOrderStatus(event, id);
      if (a === 'config' && method === 'GET') return await getAdminConfig();
      if (a === 'config' && method === 'PUT') return await putAdminConfig(event);
      if (a === 'test-notify' && method === 'POST') return await testNotify();
    }
    return json(404, { message: 'Introuvable.' });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { message: e.message });
    console.error(e);
    return json(500, { message: 'Erreur serveur. Réessayez dans un instant.' });
  }
};
