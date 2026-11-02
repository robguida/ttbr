// Pulls only the allowed totals out of a GoAccess HTML report for TTBR.
// Usage: node src/ops/analytics/extract.js <report.html> <outdir>
// Counts only exact /v/<slug>.gif tracking hits (GoAccess files them under
// static_requests or requests). Output holds no IPs, user agents, full referrer URLs or raw lines.
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

function extract(data) {
  const failures = [];
  const rows = (panel, fn) => {
    const items = (data[panel] && data[panel].data) || [];
    const out = [];
    for (const it of items) {
      try { const r = fn(it); if (r) out.push(r); } catch (e) { failures.push(panel + ': ' + e.message); }
    }
    return out;
  };
  const days = rows('visitors', it => {
    const d = String(it.data);
    if (!/^\d{8}$/.test(d)) throw new Error('bad day');
    return { day: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, visitors: num(it.visitors) };
  }).sort((a, b) => a.day.localeCompare(b.day));

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
    if (!isDomain(s) || s.endsWith('travelthebackroads.com')) return null;
    return { site: s, visitors: num(it.visitors) };
  }).sort((a, b) => b.visitors - a.visitors);

  const top = panel => rows(panel, it => ({ name: String(it.data), visitors: num(it.visitors) }))
    .sort((a, b) => b.visitors - a.visitors);

  return {
    days, pages, referrers, browsers: top('browsers'), os: top('os'),
    summary: { start: data.general && data.general.start_date, end: data.general && data.general.end_date, failures }
  };
}

module.exports = { extract, parseJsonData };

if (require.main === module) {
  const [, , src, out] = process.argv;
  if (!src || !out) { console.error('Usage: node extract.js <report.html> <outdir>'); process.exit(1); }
  const r = extract(parseJsonData(fs.readFileSync(src, 'utf8')));
  fs.mkdirSync(out, { recursive: true });
  const write = (n, v) => fs.writeFileSync(path.join(out, n), JSON.stringify(v));
  write('visits-by-day.json', r.days);
  write('top-pages.json', r.pages);
  write('referring-sites.json', r.referrers);
  write('browsers.json', r.browsers);
  write('operating-systems.json', r.os);
  write('summary.json', r.summary);
  console.log(JSON.stringify({ days: r.days.length, pages: r.pages.length, referrers: r.referrers.length, ...r.summary }));
}
