'use strict';
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { fmtMAD } = require('./lib');

const ses = new SESv2Client({});
const env = (k) => (process.env[k] || '').trim();

function orderMessage(order, brand) {
  const L = order.lines.map((l) => `- ${l.q} x ${l.name} (${l.fmt}) : ${fmtMAD(l.q * l.price)}`).join('\n');
  const client = 'https://wa.me/' + String(order.phoneIntl || '') + '?text=' + encodeURIComponent(
    `Bonjour ${order.name}, c'est ${brand}. Nous avons bien reçu votre commande ${order.ref}. `
    + 'Pouvons-nous confirmer la livraison ?');
  const text = [
    `Nouvelle commande ${order.ref}`,
    '',
    `Client : ${order.name}`,
    `Téléphone : ${order.phone}`,
    `Ville : ${order.city}`,
    order.address ? `Adresse : ${order.address}` : null,
    '',
    L,
    '',
    `Total articles : ${fmtMAD(order.sub)}`,
    'Livraison : à confirmer avec le client. Paiement à la livraison.',
    '',
    'Répondre au client sur WhatsApp :',
    client,
  ].filter((x) => x !== null).join('\n');
  return { text, subject: `Nouvelle commande ${order.ref} - ${order.name} (${order.city}) - ${fmtMAD(order.sub)}`, client };
}

async function email(subject, text) {
  const to = env('OWNER_EMAIL'), from = env('SENDER_EMAIL') || to;
  if (!to) return;
  await ses.send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' } } } },
  }));
}

async function telegram(text) {
  const token = env('TELEGRAM_BOT_TOKEN'), chat = env('TELEGRAM_CHAT_ID');
  if (!token || !chat) return;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error('telegram ' + r.status);
}

// WhatsApp Business Cloud API (Meta). Les messages envoyés en premier doivent utiliser un modèle (template) approuvé.
async function whatsappTemplate(to, template, params) {
  const token = env('WA_TOKEN'), phoneId = env('WA_PHONE_ID');
  if (!token || !phoneId || !template || !to) return;
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: template, language: { code: env('WA_LANG') || 'fr' },
        components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t).slice(0, 200) })) }] },
    }),
  });
  if (!r.ok) throw new Error('whatsapp ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// Ne doit jamais empêcher l'enregistrement d'une commande : chaque canal échoue séparément.
async function notifyOrder(order, brand, ownerWhatsapp) {
  const m = orderMessage(order, brand);
  const jobs = [
    email(m.subject, m.text),
    telegram(m.subject + '\n\n' + m.text),
    whatsappTemplate(ownerWhatsapp, env('WA_TEMPLATE_OWNER'), [order.ref, order.name, order.phone, order.city, fmtMAD(order.sub)]),
    whatsappTemplate(order.phoneIntl, env('WA_TEMPLATE_CLIENT'), [order.name, order.ref]),
  ];
  const res = await Promise.allSettled(jobs);
  res.forEach((r, i) => { if (r.status === 'rejected') console.error('notify channel', i, 'failed:', r.reason && r.reason.message); });
  return res.map((r) => r.status);
}

module.exports = { notifyOrder, orderMessage, email, telegram };
