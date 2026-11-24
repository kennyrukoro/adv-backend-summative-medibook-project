'use strict';
const fsp = require('fs/promises');
const path = require('path');
const config = require('../config');
const { clinicNow } = require('../utils/time');

// Locale files and their BCP-47 tags. Anything else falls back to English.
const SUPPORTED = { en: 'en-GB', fr: 'fr-FR' };
const DEFAULT_LANG = 'en';

const cache = new Map();

function resolveLang(raw) {
  const lang = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(SUPPORTED, lang) ? lang : DEFAULT_LANG;
}

async function loadLocale(lang) {
  if (!cache.has(lang)) {
    const file = path.join(config.localesDir, `${lang}.json`);
    cache.set(lang, JSON.parse(await fsp.readFile(file, 'utf8')));
  }
  return cache.get(lang);
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * GET /feedback?lang=fr
 * Renders the page from locales/<lang>.json. Today's date comes from the clinic clock and
 * is formatted for the active locale with Intl.DateTimeFormat.
 */
async function show(req, res) {
  const lang = resolveLang(req.query.lang);
  const t = await loadLocale(lang);
  const locale = SUPPORTED[lang];

  const todayClinic = new Date(Date.now() + config.clinicOffsetMinutes * 60000);
  const today = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full', timeZone: 'UTC',
  }).format(todayClinic);

  const questions = t.questions.map((q, i) => `
      <div class="question">
        <label for="q${i + 1}">${i + 1}. ${esc(q)}</label>
        <textarea id="q${i + 1}" name="q${i + 1}" rows="5"></textarea>
      </div>`).join('');

  const switcher = Object.keys(SUPPORTED)
    .map((code) => (code === lang
      ? `<strong>${esc(code.toUpperCase())}</strong>`
      : `<a href="/feedback?lang=${esc(code)}">${esc(code.toUpperCase())}</a>`))
    .join(' | ');

  const html = `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t.pageTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; }
    .question { margin-bottom: 1.25rem; }
    label { display: block; font-weight: 600; margin-bottom: .35rem; }
    textarea { width: 100%; box-sizing: border-box; padding: .5rem; font: inherit; }
    .meta { color: #475569; font-size: .9rem; }
    button { padding: .6rem 1.2rem; font: inherit; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(t.pageTitle)}</h1>
    <p class="meta">${esc(t.dateLabel)}: <time datetime="${esc(todayClinic.toISOString().slice(0, 10))}">${esc(today)}</time>
      &middot; ${esc(t.languageLabel)}: ${switcher}</p>
  </header>
  <p>${esc(t.instructions)}</p>
  <form>${questions}
    <button type="button">${esc(t.submit)}</button>
  </form>
  <p class="meta">${esc(t.notice)}</p>
</body>
</html>`;

  res.type('html').send(html);
}

module.exports = { show, resolveLang };
