'use strict';
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const defaults = require('./defaults.json');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const T = {
  products: () => process.env.PRODUCTS_TABLE,
  orders: () => process.env.ORDERS_TABLE,
  config: () => process.env.CONFIG_TABLE,
};

const str = (v, max, min = 0) => {
  const s = String(v == null ? '' : v).trim();
  if (s.length > max) throw new HttpError(400, 'Un champ est trop long.');
  if (s.length < min) throw new HttpError(400, 'Un champ obligatoire est manquant.');
  return s;
};

const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Numéro marocain -> 212XXXXXXXXX (sans +) ou null
const normPhone = (s) => {
  const t = String(s || '').replace(/[\s.\-()]/g, '');
  const m = t.match(/^(?:\+212|00212|212|0)([5-7]\d{8})$/);
  return m ? '212' + m[1] : null;
};

const fmtMAD = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n) || 0) + ' DH';
const vlabel = (v) => String(v.label || 'Standard');

const PUBLIC_SETTINGS = ['brand', 'whatsapp', 'phone', 'email', 'address', 'hours', 'footer', 'lowStock'];

async function getConfig() {
  const { GetCommand } = require('@aws-sdk/lib-dynamodb');
  const r = await ddb.send(new GetCommand({ TableName: T.config(), Key: { id: 'site' } }));
  const c = r.Item || {};
  return {
    settings: Object.assign({}, defaults.settings, c.settings || {}),
    categories: c.categories || defaults.categories,
    pages: Object.assign({}, defaults.pages, c.pages || {}),
  };
}

async function scanAll(table) {
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
  let items = [], key;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey: key }));
    items = items.concat(r.Items || []);
    key = r.LastEvaluatedKey;
  } while (key);
  return items;
}

const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Nettoie et valide un parfum envoyé par l'admin. `existing` = produit actuel en base (ou null).
function cleanProduct(input, existing) {
  const p = input || {};
  const name = str(p.name, 120, 1);
  const brand = str(p.brand, 80, 1);
  const slug = slugify(p.slug || name);
  if (!slug) throw new HttpError(400, 'Adresse (slug) invalide.');
  const status = ['draft', 'published', 'archived'].includes(p.status) ? p.status : 'draft';
  const old = {};
  ((existing && existing.variants) || []).forEach((v) => { old[v.id] = v; });
  if (!Array.isArray(p.variants) || p.variants.length > 20) throw new HttpError(400, 'Options invalides.');
  const seen = new Set();
  const variants = p.variants.map((v) => {
    const label = str(v.label || 'Standard', 40, 1);
    const price = Number(v.price);
    if (!(price >= 0 && price <= 10000000) || v.price === '' || v.price == null) throw new HttpError(400, 'Prix invalide.');
    let id = String(v.id || '');
    if (!/^[\w-]{3,40}$/.test(id) || seen.has(id)) id = newId('v');
    seen.add(id);
    // Le stock d'un format existant ne se modifie que par l'onglet Stock (évite d'écraser une vente en cours).
    const stock = old[id] ? old[id].stock : Math.max(0, Math.floor(Number(v.stock) || 0));
    return { id, label, price, sku: str(v.sku, 40), stock, active: v.active !== false };
  });
  if (status === 'published' && !variants.some((v) => v.active)) {
    throw new HttpError(400, 'Un produit publié doit avoir au moins une option active.');
  }
  const images = (Array.isArray(p.images) ? p.images : []).slice(0, 8).map((im) => {
    const src = String(im && im.src || '');
    if (!/^\/img\/[\w.-]{3,80}$/.test(src)) throw new HttpError(400, 'Image invalide.');
    return { src, alt: str(im.alt, 160) };
  });
  return {
    id: existing ? existing.id : (/^[\w-]{3,40}$/.test(String(p.id || '')) ? p.id : newId('p')),
    name, brand, slug,
    desc: str(p.desc, 4000),
    notes: str(p.notes, 2000),
    status,
    featured: !!p.featured,
    isNew: !!p.isNew,
    seoTitle: str(p.seoTitle, 120),
    seoDesc: str(p.seoDesc, 300),
    cats: (Array.isArray(p.cats) ? p.cats : []).slice(0, 10).map((c) => str(c, 40)),
    images, variants,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

function cleanConfig(c) {
  c = c || {};
  const s = c.settings || {};
  const wa = String(s.whatsapp || '').trim();
  if (wa && !normPhone(wa)) throw new HttpError(400, 'Numéro WhatsApp invalide. Exemple : 06 12 34 56 78 ou +212 612 345 678.');
  const settings = {
    brand: str(s.brand, 60, 1), whatsapp: wa, phone: str(s.phone, 40), email: str(s.email, 120),
    address: str(s.address, 200), hours: str(s.hours, 120), footer: str(s.footer, 200),
    lowStock: Math.max(0, Math.min(100, Math.floor(Number(s.lowStock) || 0))),
  };
  const categories = (Array.isArray(c.categories) ? c.categories : []).slice(0, 30).map((x) => ({
    id: /^[\w-]{1,40}$/.test(String(x.id || '')) ? x.id : newId('c'),
    name: str(x.name, 60, 1), active: x.active !== false,
  }));
  const pg = c.pages || {};
  const pages = { livraison: str(pg.livraison, 20000), terms: str(pg.terms, 20000), privacy: str(pg.privacy, 20000) };
  return { settings, categories, pages };
}

module.exports = { ddb, HttpError, T, str, slugify, normPhone, fmtMAD, vlabel, PUBLIC_SETTINGS, getConfig, scanAll, newId, cleanProduct, cleanConfig };
