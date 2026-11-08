// Draws assets for the profile README: a GTA-style HUD built from the GitHub contribution calendar.
// Usage: GITHUB_TOKEN=... node .github/hud/hud.mjs <login> <out-dir>   (add --sample for local previews)
// Writes gta-hud-dark.svg and gta-hud-light.svg in the brand palette.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const [login = 'byrishi', outDir = 'dist', flag] = process.argv.slice(2);

async function load() {
  if (flag === '--sample') {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const start = new Date(Date.UTC(2025, 10, 9));
    const weeks = [];
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * 864e5);
        const busy = w > 40 ? 0.75 : 0.45;
        days.push({ date: date.toISOString().slice(0, 10), contributionCount: rnd() < busy ? Math.floor(rnd() ** 2 * 18) + 1 : 0 });
      }
      weeks.push({ contributionDays: days });
    }
    return { weeks, repos: 6, followers: 40 };
  }
  const query = `query($login:String!){user(login:$login){
    contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}
    repositories(ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false){totalCount}
    followers{totalCount}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-hud' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  if (!json.data?.user) throw new Error(JSON.stringify(json.errors || json));
  const u = json.data.user;
  return { weeks: u.contributionsCollection.contributionCalendar.weeks, repos: u.repositories.totalCount, followers: u.followers.totalCount };
}

const { weeks, repos } = await load();
const days = weeks.flatMap((w) => w.contributionDays);
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const past = days.filter((d) => d.date <= today);
const total = past.reduce((a, d) => a + d.contributionCount, 0);
const last = (n) => past.slice(-n).reduce((a, d) => a + d.contributionCount, 0);
const week = last(7);
const active30 = past.slice(-30).filter((d) => d.contributionCount > 0).length;
let streak = 0;
{
  let i = past.length - 1;
  if (i >= 0 && past[i].contributionCount === 0) i--; // today can still be empty
  while (i >= 0 && past[i].contributionCount > 0) { streak++; i--; }
}
let best = 0, run = 0;
for (const d of past) { run = d.contributionCount > 0 ? run + 1 : 0; best = Math.max(best, run); }
const wanted = [0, 1, 5, 10, 20, 35].filter((t) => week >= t).length - 1;

// ── brand ────────────────────────────────────────────────────────────────────
// Night #0d0d0d · Paper #f6ede2 · Ink #edeae4 / #2b1218 · Plum #5a2333 · Lilac #c9b0e6 · Spark #fa5a00
const THEMES = {
  dark: {
    bg: '#0d0d0d', grid: '#262626', ink: '#edeae4', mute: '#9a958d', outline: '#0d0d0d',
    sky: ['#0d0d0d', '#1a0f14', '#2b1218', '#5a2333', '#8a3a3a'], haze: '#fa5a00',
    city: '#0d0d0d', win: '#edeae4', road: '#0d0d0d', lane: '#262626',
    panel: '#141414', panelLine: '#2a2a2a', cells: ['#262626', '#5a2333', '#8b5a8a', '#c9b0e6', '#fa5a00'],
    barDim: '#262626', starOff: '#2a2a2a', band: '#0d0d0d',
  },
  light: {
    bg: '#f6ede2', grid: '#ddcbbd', ink: '#2b1218', mute: '#6e4a52', outline: '#f6ede2',
    sky: ['#f6ede2', '#f3e2d6', '#ecc9c4', '#d9a7b8', '#c9b0e6'], haze: '#fa5a00',
    city: '#2b1218', win: '#f6ede2', road: '#efe2d4', lane: '#c9a99a',
    panel: '#2b1218', panelLine: '#5a2333', cells: ['#3d1c25', '#5a2333', '#8b5a8a', '#c9b0e6', '#fa5a00'],
    barDim: '#ddcbbd', starOff: '#ddcbbd', band: '#f6ede2',
  },
};
const SPARK = '#fa5a00', LILAC = '#c9b0e6', PLUM = '#5a2333';

// ── helpers ──────────────────────────────────────────────────────────────────
const W = 1200, H = 420, HORIZON = 318;
const fmt = (n) => n.toLocaleString('en-US');
const b64 = (f) => fs.readFileSync(path.join(here, f)).toString('base64');
const FONTS = `@font-face{font-family:IT;src:url(data:font/woff2;base64,${b64('intertight-800.woff2')}) format("woff2");font-weight:800}
@font-face{font-family:IT;src:url(data:font/woff2;base64,${b64('intertight-500.woff2')}) format("woff2");font-weight:500}
@font-face{font-family:JB;src:url(data:font/woff2;base64,${b64('jbmono-400.woff2')}) format("woff2")}
@font-face{font-family:GH;src:url(data:font/woff2;base64,${b64('gochi.woff2')}) format("woff2")}`;
const weekly = weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0));
const maxWeek = Math.max(1, ...weekly);
const recent = weeks.slice(-22);
const lvl = (c) => (c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4);
const now = new Date();
const stamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase()} · ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })} IST`;

function draw(t) {
  let s = 1;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const txt = (x, y, body, cls, extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${body}</text>`;

  // dot grid, like the banner
  let grid = '';
  for (let y = 5; y < H; y += 10) for (let x = 5; x < W; x += 10) grid += `<circle cx="${x}" cy="${y}" r="1.1"/>`;

  // sun as a dot-matrix disc
  let sun = '';
  const SX = 610, SY = HORIZON - 118, SR = 78;
  for (let y = SY - SR; y <= SY + SR; y += 8) for (let x = SX - SR; x <= SX + SR; x += 8) {
    const d = Math.hypot(x - SX, y - SY);
    if (d <= SR && y < HORIZON) sun += `<circle cx="${x}" cy="${y}" r="${(3.2 - (d / SR) * 1.2).toFixed(2)}"/>`;
  }

  // skyline: one tower per week, height = that week's contributions; windows are dots
  const bw = W / weekly.length;
  let towers = '', wins = '', sparks = '';
  weekly.forEach((c, i) => {
    const x = i * bw;
    let h = 22 + Math.round((c / maxWeek) * 112) + Math.round(rnd() * 12);
    if (x > 840) h = Math.min(h, 80); // keep the cash/text corner clear
    const y = HORIZON - h;
    towers += `<rect x="${x.toFixed(1)}" y="${y}" width="${(bw + 0.6).toFixed(1)}" height="${h}"/>`;
    if (rnd() < 0.25) towers += `<rect x="${(x + bw * 0.4).toFixed(1)}" y="${y - 10}" width="1.4" height="10"/>`;
    const density = 0.1 + (c / maxWeek) * 0.55;
    for (let wy = y + 7; wy < HORIZON - 6; wy += 8) for (let wx = x + 5; wx < x + bw - 4; wx += 6) {
      if (rnd() < density) {
        const dot = `<circle cx="${wx.toFixed(1)}" cy="${wy}" r="1.2"`;
        if (rnd() < 0.05) sparks += `${dot} style="animation-delay:-${(rnd() * 6).toFixed(1)}s"/>`;
        else wins += `${dot}/>`;
      }
    }
  });
  const palm = (x, h, k = 1) => `<g transform="translate(${x} ${HORIZON + 2}) scale(${k})"><path d="M0 0 C2 -${h * 0.4} 6 -${h * 0.8} 4 -${h}" stroke="${t.city}" stroke-width="4" fill="none" stroke-linecap="round"/>
<g transform="translate(4 -${h})" fill="${t.city}"><path d="M0 0 C-12 -10 -30 -6 -40 6 C-26 -2 -12 -2 0 0Z"/><path d="M0 0 C10 -12 30 -10 40 4 C26 -4 12 -4 0 0Z"/><path d="M0 0 C-6 -14 -2 -28 8 -34 C2 -22 2 -12 0 0Z"/><path d="M0 0 C-14 2 -26 14 -28 28 C-18 16 -10 8 0 0Z"/><path d="M0 0 C14 2 26 14 28 28 C18 16 10 8 0 0Z"/></g></g>`;

  // minimap: last 22 weeks as blocks
  const RX = 34, RY = 216, RW = 300, RH = 132;
  let blocks = '', bestCell = [0, 0], bestCount = -1;
  recent.forEach((w, wi) => w.contributionDays.forEach((d, di) => {
    const x = wi * 15, y = di * 15;
    blocks += `<rect x="${x}" y="${y}" width="12" height="12" rx="2" fill="${t.cells[lvl(d.contributionCount)]}"/>`;
    if (d.contributionCount >= bestCount) { bestCount = d.contributionCount; bestCell = [x + 6, y + 6]; }
  }));
  const gridW = recent.length * 15, gridH = 7 * 15;

  // cash odometer
  const MX = 1164, MY = 118, MS = 60, LH = MS * 1.1, DIGIT = 36, COMMA = 14, DOLLAR = 34;
  const RATE = 100; // $ per contribution
  const chars = ('$' + fmt(total * RATE)).split('');
  const widths = chars.map((c) => (c === ',' ? COMMA : c === '$' ? DOLLAR : DIGIT));
  let mx = MX - widths.reduce((a, b) => a + b, 0), odo = '';
  chars.forEach((c, i) => {
    const cx = mx + widths[i] / 2;
    if (/\d/.test(c)) {
      const n = Number(c);
      const col = Array.from({ length: 10 }, (_, k) => txt(cx, (MY + k * LH).toFixed(1), k, 'cash', 'text-anchor="middle"')).join('');
      odo += `<g class="odo" style="--to:${(-n * LH).toFixed(1)}px;animation-delay:${(0.2 + i * 0.12).toFixed(2)}s">${col}</g>`;
    } else odo += txt(cx, MY, c, c === '$' ? 'cash dollar' : 'cash', 'text-anchor="middle"');
    mx += widths[i];
  });

  // wanted stars
  const star = (cx, cy, r) => Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  let stars = '';
  for (let k = 0; k < 5; k++) stars += `<polygon points="${star(1150 - (4 - k) * 36, 42, 15)}" class="${k < wanted ? 'star on' : 'star'}" style="animation-delay:${(k * 0.08).toFixed(2)}s"/>`;

  const bar = (x, y, w, frac, color) => `<rect x="${x}" y="${y}" width="${w}" height="8" rx="4" fill="${t.barDim}"/><rect x="${x}" y="${y}" width="${Math.max(8, w * Math.min(1, frac)).toFixed(1)}" height="8" rx="4" fill="${color}" class="fill"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>
${FONTS}
text{fill:${t.ink}}
.cash{font-family:IT;font-weight:800;font-size:${MS}px;letter-spacing:-2px}
.dollar{fill:${SPARK}}
.mono{font-family:JB;font-size:12px;letter-spacing:.3px;fill:${t.ink};paint-order:stroke;stroke:${t.bg};stroke-width:4px;stroke-linejoin:round}
.mute{fill:${t.mute}}
.hand{font-family:GH;font-size:21px;fill:${SPARK};paint-order:stroke;stroke:${t.bg};stroke-width:5px;stroke-linejoin:round}
.mp{font-family:IT;font-weight:800;font-size:64px;letter-spacing:-2.5px;fill:${SPARK}}
.sub{font-family:JB;font-size:14px;letter-spacing:1px;fill:${t.ink}}
.delta{font-family:IT;font-weight:800;font-size:30px;letter-spacing:-1px;fill:${LILAC};paint-order:stroke;stroke:${t.bg};stroke-width:5px;stroke-linejoin:round}
.odo{animation:odo 1.6s cubic-bezier(.2,.9,.25,1) both}
@keyframes odo{from{transform:translateY(${(-9 * LH).toFixed(1)}px)}to{transform:translateY(var(--to))}}
.star{fill:${t.starOff}}
.star.on{fill:${t.ink};animation:flash 1s steps(1) infinite}
@keyframes flash{50%{fill:${SPARK}}}
.grid{fill:${t.grid}}
.sun circle{fill:${SPARK}}
.sun{animation:sun 6s ease-in-out infinite}@keyframes sun{50%{opacity:.75}}
.win{fill:${t.win};opacity:.55}
.spk{fill:${SPARK};animation:flick 6s steps(1) infinite}@keyframes flick{0%,40%{opacity:1}41%,60%{opacity:.15}61%{opacity:1}}
.car{animation:drive linear infinite}@keyframes drive{from{transform:translateX(-60px)}to{transform:translateX(1260px)}}
.carL{animation:driveL linear infinite}@keyframes driveL{from{transform:translateX(1260px)}to{transform:translateX(-60px)}}
.me{transform-box:fill-box;transform-origin:center;animation:me 1.6s ease-in-out infinite}@keyframes me{50%{transform:scale(1.25)}}
.blip{transform-box:fill-box;transform-origin:center;animation:blip 2s ease-out infinite}@keyframes blip{from{transform:scale(1);opacity:.9}to{transform:scale(3.4);opacity:0}}
.fill{transform-box:fill-box;transform-origin:left;animation:grow 1.4s cubic-bezier(.2,.9,.25,1) .6s both}@keyframes grow{from{transform:scaleX(0)}}
.pass{opacity:0;animation:pass 14s ease infinite 1.8s}
@keyframes pass{0%{opacity:0;transform:translateY(10px)}4%{opacity:1;transform:none}30%{opacity:1}36%,100%{opacity:0}}
.dl{opacity:0;animation:dl 14s ease infinite 2.6s}@keyframes dl{0%{opacity:0;transform:translateY(8px)}4%,26%{opacity:1;transform:none}32%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.pass,.dl{opacity:1}}
</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${t.sky.map((c, i) => `<stop offset="${(i / (t.sky.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.haze}" stop-opacity="0"/><stop offset="1" stop-color="${t.haze}" stop-opacity=".28"/></linearGradient>
<linearGradient id="band" x1="0" x2="1"><stop offset="0" stop-color="${t.band}" stop-opacity="0"/><stop offset=".2" stop-color="${t.band}" stop-opacity=".9"/><stop offset=".8" stop-color="${t.band}" stop-opacity=".9"/><stop offset="1" stop-color="${t.band}" stop-opacity="0"/></linearGradient>
<clipPath id="map"><rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" rx="14"/></clipPath>
<clipPath id="cash"><rect x="600" y="${MY - MS + 2}" width="600" height="${MS + 8}"/></clipPath>
<clipPath id="skyclip"><rect width="${W}" height="${HORIZON}"/></clipPath>
</defs>

<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>
<g class="grid" opacity=".55">${grid}</g>
<g class="sun" clip-path="url(#skyclip)">${sun}</g>
<rect y="${HORIZON - 120}" width="${W}" height="120" fill="url(#haze)"/>
<g fill="${t.city}">${towers}</g>
<g class="win">${wins}</g><g class="spk">${sparks}</g>
${palm(150, 120, 1)}${palm(196, 92, 0.85)}${palm(1010, 70, 0.8)}${palm(1120, 58, 0.7)}
<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="${t.road}"/>
<g fill="${t.lane}">${Array.from({ length: 60 }, (_, i) => `<circle cx="${i * 20 + 10}" cy="${HORIZON + 26}" r="1.4"/>`).join('')}</g>
<g>${Array.from({ length: 7 }, (_, i) => `<rect class="car" x="0" y="${HORIZON + 19}" width="14" height="3" rx="1.5" fill="${SPARK}" style="animation-duration:${(7 + i * 1.3).toFixed(1)}s;animation-delay:-${(i * 2.1).toFixed(1)}s"/>`).join('')}
${Array.from({ length: 7 }, (_, i) => `<rect class="carL" x="0" y="${HORIZON + 31}" width="14" height="3" rx="1.5" fill="${LILAC}" style="animation-duration:${(6 + i * 1.1).toFixed(1)}s;animation-delay:-${(i * 1.7).toFixed(1)}s"/>`).join('')}</g>

<!-- minimap -->
<rect x="${RX - 3}" y="${RY - 3}" width="${RW + 6}" height="${RH + 6}" rx="17" fill="${t.panel}" stroke="${t.panelLine}"/>
<g clip-path="url(#map)">
<rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" fill="${t.panel}"/>
<g transform="translate(${RX + RW / 2} ${RY + RH / 2 + 6}) scale(1 .62) rotate(-28) translate(${-gridW / 2} ${-gridH / 2})">
${blocks}
<circle class="blip" cx="${bestCell[0]}" cy="${bestCell[1]}" r="6" fill="none" stroke="${SPARK}" stroke-width="2"/>
<circle cx="${bestCell[0]}" cy="${bestCell[1]}" r="5" fill="${SPARK}"/>
</g>
<path class="me" d="M${RX + RW / 2} ${RY + RH / 2 - 9} l7 17 -7 -4 -7 4z" fill="#edeae4" stroke="#0d0d0d" stroke-width="1.5"/>
</g>
${bar(RX, RY + RH + 12, 96, streak / 30, SPARK)}
${bar(RX + 102, RY + RH + 12, 96, active30 / 30, LILAC)}
${bar(RX + 204, RY + RH + 12, 96, best / 60, t.ink)}
${txt(RX, RY + RH + 38, `STREAK ${streak}D`, 'mono')}
${txt(RX + 102, RY + RH + 38, `ACTIVE ${active30}/30`, 'mono')}
${txt(RX + 204, RY + RH + 38, `BEST ${best}D`, 'mono')}

<!-- wanted + cash -->
${stars}
<g clip-path="url(#cash)">${odo}</g>
<g class="dl">${txt(MX, MY + 40, `+$${fmt(week * RATE)}`, 'delta', 'text-anchor="end"')}</g>
${txt(MX, MY + 70, 'contributions this year, paid in cash', 'hand', 'text-anchor="end"')}
${txt(MX, MY + 94, `${repos} OPEN REPOS · @${login.toUpperCase()}`, 'mono', 'text-anchor="end"')}
${txt(MX, H - 22, `ANKLESHWAR · ${stamp}`, 'mono mute', 'text-anchor="end"')}

<!-- mission passed -->
<g class="pass">
<rect x="330" y="146" width="540" height="104" fill="url(#band)"/>
${txt(600, 208, 'mission passed.', 'mp', 'text-anchor="middle"')}
${txt(600, 236, `${fmt(total)} CONTRIBUTIONS THIS YEAR · STREAK ${streak} DAY${streak === 1 ? '' : 'S'}`, 'sub', 'text-anchor="middle"')}
</g>
</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, t] of Object.entries(THEMES)) fs.writeFileSync(path.join(outDir, `gta-hud-${name}.svg`), draw(t));
console.log(`wrote ${outDir}: total=${total} week=${week} wanted=${wanted} streak=${streak} best=${best} active30=${active30}`);
