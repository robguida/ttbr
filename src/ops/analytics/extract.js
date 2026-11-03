// Pulls only the allowed totals out of GoAccess HTML reports for TTBR.
// Usage: node src/ops/analytics/extract.js <report.html> <outdir> [readers.html] [appjs.html]
// Counts only exact /v/<slug>.gif tracking hits (GoAccess files them under
// static_requests or requests). Output holds no IPs, user agents, full referrer URLs or raw lines.
// The readers report (ping lines only) and the app.js report (visitors who got app.js with a 200)
// are optional; if not given, the sibling files ttbr-readers-<date>.html / ttbr-appjs-<date>.html
// next to the main report are used when they exist.
const fs = require('fs');
const path = require('path');

const PAGES = {
  home: 'Home', blog: 'Blog', 'tsa-precheck': 'TSA PreCheck: Less Unpacking, More Sanity',
  purpose: 'Travel with a Purpose', destinations: 'Destinations', albania: 'Albania',
  'longwood-gardens': 'Longwood Gardens: My Happy Place, in Every Season',
  epcot: 'EPCOT: Where Our Appetite for Travel May Have Begun',
  norway: 'Norway: fjords, Oslo, Bergen, and Nigardsbreen', gallery: 'Gallery', about: 'About',
  contact: 'Contact', credits: 'Photo credits', 'ten-suitcases': 'Ten suitcases and a new beginning',
  'not-found': 'Page not found'
};

// Pings (/v/<slug>.gif) went live on this day; earlier days use the app.js backfill.
const PING_START = '2026-11-02';
const OWN_FILES = [/^\/favicon\.ico$/, /^\/robots\.txt$/, /^\/sitemap[A-Za-z0-9._-]*$/, /^\/apple-touch-icon[A-Za-z0-9._-]*$/];
// Real asset types only; anything else under our folders (.env, .php, .pem ...) is a probe.
const ASSET_EXT = /\.(ico|txt|xml|png|jpe?g|webp|gif|svg|css|js|json|webmanifest|html|woff2?)$/i;
// Anything matching this is never kept (also the final backstop in assertNoLeaks).
const LEAK = /\b\d{1,3}(\.\d{1,3}){3}\b|:\/\/|<|\.pem|wp-login/i;
const leaky = s => LEAK.test(String(s));
const SAFE_PATH = /^\/[A-Za-z0-9._\/-]{1,120}$/;
const HAS_IP = /(^|[^0-9])\d{1,3}(\.\d{1,3}){3}([^0-9]|$)/;
const OWN_HOSTS = /(^|\.)travelthebackroads\.com$/;
const SEARCH = [/^(www\.)?google\.[a-z.]+$/, /^com\.google\.android\.googlequicksearchbox$/, /^(www\.)?bing\.com$/,
  /^(www\.)?duckduckgo\.com$/, /^([a-z]+\.)?yahoo\.[a-z.]+$/, /^(www\.)?ecosia\.org$/, /^search\.brave\.com$/,
  /^(www\.)?baidu\.com$/, /^(www\.)?yandex\.[a-z.]+$/, /^(www\.)?startpage\.com$/];
const SOCIAL = [['Facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$/], ['Instagram', /(^|\.)instagram\.com$/],
  ['X / Twitter', /^(t\.co|(www\.)?(twitter|x)\.com)$/], ['YouTube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['LinkedIn', /(^|\.)(linkedin\.com|lnkd\.in)$/], ['Pinterest', /(^|\.)pinterest\.[a-z.]+$/], ['Reddit', /(^|\.)reddit\.com$/]];
// Android-style app ids (com.example.app) look like domains but are apps.
const APP_STYLE = /^(com|org|net)\.[a-z0-9_]+\.[a-z0-9_.]+$/;

function parseJsonData(html) {
  const start = html.indexOf('var json_data=');
  if (start < 0) throw new Error('json_data not found');
  const i = html.indexOf('{', start);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error('json_data not closed');
  return JSON.parse(html.slice(i, end));
}

const num = v => (v && typeof v === 'object' ? v.count : v) || 0;
const pageForPath = p => {
  const m = /^\/v\/([a-z0-9-]+)\.gif$/.exec(p);
  return m && Object.prototype.hasOwnProperty.call(PAGES, m[1]) ? PAGES[m[1]] : null;
};
const isDomain = s => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s);
const dayOf = d => {
  d = String(d);
  if (!/^\d{8}$/.test(d)) throw new Error('bad day');
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
};

// {day: visitors} from a report's visitors panel; bad items are skipped.
function dayCounts(data) {
  const out = {};
  for (const it of (data && data.visitors && data.visitors.data) || []) {
    try { out[dayOf(it.data)] = num(it.visitors); } catch (e) { /* skip bad item */ }
  }
  return out;
}

function ownDirs() {
  try {
    return fs.readdirSync(path.join(__dirname, '..', '..'), { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'ops').map(e => e.name);
  } catch (e) { return ['articles', 'assets', 'v']; }
}

function extract(data, extra = {}) {
  const failures = [];
  const rows = (panel, fn) => {
    const items = (data[panel] && data[panel].data) || [];
    const out = [];
    for (const it of items) {
      try { const r = fn(it); if (r) out.push(r); } catch (e) { failures.push(panel + ': ' + e.message); }
    }
    return out;
  };
  const days = rows('visitors', it => ({ day: dayOf(it.data), visitors: num(it.visitors) }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const visitorDays = days.reduce((n, d) => n + d.visitors, 0);

  const totals = {};
  for (const panel of ['static_requests', 'requests']) {
    rows(panel, it => {
      const name = pageForPath(String(it.data).split('?')[0]);
      if (!name) return null;
      totals[name] = totals[name] || { page: name, visitors: 0, views: 0 };
      totals[name].visitors += num(it.visitors);
      totals[name].views += num(it.hits);
      return true;
    });
  }
  const pages = Object.values(totals).sort((a, b) => b.views - a.views);

  const referrers = rows('referring_sites', it => {
    const s = String(it.data).toLowerCase();
    if (!isDomain(s) || leaky(s) || s.endsWith('travelthebackroads.com')) return null;
    return { site: s, visitors: num(it.visitors) };
  }).sort((a, b) => b.visitors - a.visitors);

  // Sources: grouped; Facebook variants and google.* merged; non-domain referrers (apps) become one
  // "Other app" row (raw string never kept); a remainder row makes the list add up to visitor-days.
  const merged = {};
  const add = (group, source, v) => {
    const k = group + '|' + source;
    merged[k] = merged[k] || { group, source, visitors: 0 };
    merged[k].visitors += v;
  };
  let otherApp = 0;
  rows('referring_sites', it => {
    const s = String(it.data).toLowerCase();
    const v = num(it.visitors);
    if (OWN_HOSTS.test(s)) return null;
    const search = SEARCH.some(re => re.test(s));
    if (!isDomain(s) || leaky(s) || (APP_STYLE.test(s) && !search)) { otherApp += v; return null; }
    if (search) { add('Search', /google/.test(s) ? 'Google' : s.replace(/^www\./, ''), v); return null; }
    const soc = SOCIAL.find(([, re]) => re.test(s));
    if (soc) add('Social', soc[0], v);
    else add('Other sites', s.replace(/^www\./, ''), v);
    return null;
  });
  const sources = Object.values(merged).sort((a, b) => b.visitors - a.visitors);
  if (otherApp) sources.push({ group: 'Other sites', source: 'Other app', visitors: otherApp });
  const referred = sources.reduce((n, r) => n + r.visitors, 0);
  sources.push({ group: 'No source shown', source: 'No source shown (direct / bookmark / app)', visitors: Math.max(0, visitorDays - referred) });

  // Missing files: our own files by path; every other 404 collapses into one "bot probes" count.
  const dirs = ownDirs();
  const missing = {};
  let botProbes = 0;
  rows('not_found', it => {
    const p = String(it.data).split('?')[0];
    const hits = num(it.hits);
    const ours = SAFE_PATH.test(p) && ASSET_EXT.test(p) && !leaky(p) && !HAS_IP.test(p) && !p.includes('..') &&
      (OWN_FILES.some(re => re.test(p)) || dirs.some(d => p.startsWith('/' + d + '/')));
    if (ours) missing[p] = (missing[p] || 0) + hits; else botProbes += hits;
    return true;
  });
  const notFound = Object.entries(missing).map(([p, hits]) => ({ path: p, hits, kind: 'file' })).sort((a, b) => b.hits - a.hits);
  notFound.push({ path: 'Robot probes (all other missing files)', hits: botProbes, kind: 'probes' });

  // Readers: pings per day from PING_START; earlier days backfilled from "got app.js with a 200".
  // Each day has a low and a high. A day with no data (its report is missing) is null, never 0.
  const ping = dayCounts(extra.readers), appjs = dayCounts(extra.appjs);
  const allDays = [...new Set([...days.map(d => d.day), ...Object.keys(ping), ...Object.keys(appjs)])].sort();
  const readersByDay = allDays.map(day => {
    if (day < PING_START) {
      if (!extra.appjs) return { day, low: null, high: null, source: 'none' };
      const n = appjs[day] || 0;
      return { day, low: n, high: n, source: 'backfill' };
    }
    if (!extra.readers) return { day, low: null, high: null, source: 'none' };
    const low = ping[day] || 0;
    return { day, low, high: extra.appjs ? Math.max(low, appjs[day] || 0) : low, source: 'ping' };
  });
  const haveReaders = !!(extra.readers || extra.appjs);
  const sum = k => readersByDay.reduce((n, r) => n + (r[k] || 0), 0);
  const low = sum('low'), high = sum('high');
  const window = days.length ? { from: days[0].day, to: days[days.length - 1].day } : null;

  const top = panel => rows(panel, it => (leaky(it.data) ? null : { name: String(it.data), visitors: num(it.visitors) }))
    .sort((a, b) => b.visitors - a.visitors);

  return {
    days, pages, referrers, sources, notFound, readersByDay, browsers: top('browsers'), os: top('os'),
    summary: {
      start: data.general && data.general.start_date, end: data.general && data.general.end_date, failures,
      visitorDays, window, readers: haveReaders ? { low, high } : null
    }
  };
}

// Every output must be free of IPs, tags and URLs; throws before anything is written.
function assertNoLeaks(files) {
  const all = Object.values(files).map(v => JSON.stringify(v)).join('');
  if (LEAK.test(all)) throw new Error('output failed the leak check');
}

module.exports = { extract, parseJsonData, assertNoLeaks };

if (require.main === module) {
  const [, , src, out, readersArg, appjsArg] = process.argv;
  if (!src || !out) { console.error('Usage: node extract.js <report.html> <outdir> [readers.html] [appjs.html]'); process.exit(1); }
  const extraFailures = [];
  // An extra report that is missing, unreadable or corrupt never stops the main outputs.
  const optional = (arg, kind) => {
    try {
      const f = arg || path.join(path.dirname(src), path.basename(src).replace('-visits-', '-' + kind + '-'));
      return f !== src && fs.existsSync(f) ? parseJsonData(fs.readFileSync(f, 'utf8')) : null;
    } catch (e) { extraFailures.push(kind + ' report could not be read'); return null; }
  };
  const r = extract(parseJsonData(fs.readFileSync(src, 'utf8')), { readers: optional(readersArg, 'readers'), appjs: optional(appjsArg, 'appjs') });
  r.summary.failures.push(...extraFailures);
  const files = {
    'visits-by-day.json': r.days, 'top-pages.json': r.pages, 'referring-sites.json': r.referrers,
    'browsers.json': r.browsers, 'operating-systems.json': r.os, 'summary.json': r.summary,
    'readers-by-day.json': r.readersByDay, 'sources.json': r.sources, 'not-found.json': r.notFound
  };
  assertNoLeaks(files);
  fs.mkdirSync(out, { recursive: true });
  for (const [n, v] of Object.entries(files)) fs.writeFileSync(path.join(out, n), JSON.stringify(v));
  console.log(JSON.stringify({ days: r.days.length, pages: r.pages.length, referrers: r.referrers.length, readers: r.summary.readers, start: r.summary.start, end: r.summary.end }));
}
