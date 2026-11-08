// Draws assets for the profile README: a GTA-style HUD built from the GitHub contribution calendar.
// Usage: GITHUB_TOKEN=... node .github/hud/hud.mjs <login> <out.svg>   (or --sample for local previews)
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const [login = 'byrishi', out = 'dist/gta-hud.svg', flag] = process.argv.slice(2);

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
const today = new Date().toISOString().slice(0, 10);
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

// ── helpers ──────────────────────────────────────────────────────────────────
const W = 1200, H = 420, HORIZON = 318;
const fmt = (n) => n.toLocaleString('en-US');
const font = fs.readFileSync(path.join(here, 'anton.woff2')).toString('base64');
let s = 1;
const hash = () => ((s = (s * 48271) % 2147483647) / 2147483647);
const T = (x, y, txt, size, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${txt}</text>`;

// ── skyline: one tower per week, height = that week's contributions ─────────
const weekly = weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0));
const maxWeek = Math.max(1, ...weekly);
const bw = W / weekly.length;
let towers = '', windows = '', flick = '';
weekly.forEach((c, i) => {
  const h = 26 + Math.round((c / maxWeek) * 150) + Math.round(hash() * 14);
  const x = i * bw, y = HORIZON - h;
  towers += `<rect x="${x.toFixed(1)}" y="${y}" width="${(bw + 0.6).toFixed(1)}" height="${h}"/>`;
  if (hash() < 0.25) towers += `<rect x="${(x + bw * 0.4).toFixed(1)}" y="${y - 10}" width="1.4" height="10"/>`;
  const density = 0.12 + (c / maxWeek) * 0.6;
  for (let wy = y + 6; wy < HORIZON - 6; wy += 7) {
    for (let wx = x + 4; wx < x + bw - 5; wx += 6) {
      if (hash() < density) {
        const r = `<rect x="${wx.toFixed(1)}" y="${wy}" width="2.4" height="3"/>`;
        if (hash() < 0.04) flick += r.replace('/>', ` style="animation-delay:-${(hash() * 6).toFixed(1)}s"/>`);
        else windows += r;
      }
    }
  }
});
const palm = (x, h, k = 1) => `<g transform="translate(${x} ${HORIZON + 2}) scale(${k})"><path d="M0 0 C2 -${h * 0.4} 6 -${h * 0.8} 4 -${h}" stroke="#08060c" stroke-width="4" fill="none"/>
<g transform="translate(4 -${h})" fill="#08060c"><path d="M0 0 C-12 -10 -30 -6 -40 6 C-26 -2 -12 -2 0 0Z"/><path d="M0 0 C10 -12 30 -10 40 4 C26 -4 12 -4 0 0Z"/><path d="M0 0 C-6 -14 -2 -28 8 -34 C2 -22 2 -12 0 0Z"/><path d="M0 0 C-14 2 -26 14 -28 28 C-18 16 -10 8 0 0Z"/><path d="M0 0 C14 2 26 14 28 28 C18 16 10 8 0 0Z"/></g></g>`;

// ── radar: the last 22 weeks as city blocks ────────────────────────────────
const RX = 34, RY = 222, RW = 300, RH = 132;
const recent = weeks.slice(-22);
const lvl = (c) => (c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4);
const tone = ['#3b4743', '#4f7a55', '#5f9c5d', '#7cc56b', '#f0c33c'];
let blocks = '', bestCell = null, bestCount = -1;
recent.forEach((w, wi) => w.contributionDays.forEach((d, di) => {
  const x = wi * 15, y = di * 15;
  blocks += `<rect x="${x}" y="${y}" width="12" height="12" rx="1.5" fill="${tone[lvl(d.contributionCount)]}"/>`;
  if (d.contributionCount >= bestCount) { bestCount = d.contributionCount; bestCell = [x + 6, y + 6]; }
}));
const gridW = recent.length * 15, gridH = 7 * 15;

// ── money odometer ──────────────────────────────────────────────────────────
const money = fmt(total);
const MX = 1164, MY = 118, MS = 58, DIGIT = 30, COMMA = 13;
let mx = MX, odo = '';
const chars = ('$' + money).split('');
const widths = chars.map((c) => (c === ',' ? COMMA : c === '$' ? 28 : DIGIT));
const fullW = widths.reduce((a, b) => a + b, 0);
mx = MX - fullW;
chars.forEach((c, i) => {
  const cx = mx + widths[i] / 2;
  if (/\d/.test(c)) {
    const n = Number(c);
    const col = Array.from({ length: 10 }, (_, k) => T(cx, MY + k * MS * 1.05, k, MS, 'text-anchor="middle"')).join('');
    odo += `<g class="odo" style="--to:${(-n * MS * 1.05).toFixed(1)}px;animation-delay:${(0.2 + i * 0.12).toFixed(2)}s">${col}</g>`;
  } else odo += T(cx, MY, c, MS, 'text-anchor="middle"');
  mx += widths[i];
});

// ── wanted stars ────────────────────────────────────────────────────────────
const star = (cx, cy, r) => {
  const p = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
};
let stars = '';
for (let k = 0; k < 5; k++) {
  const cx = 1150 - (4 - k) * 36;
  const on = k < wanted;
  stars += `<polygon points="${star(cx, 42, 15)}" class="${on ? 'star on' : 'star'}" style="animation-delay:${(k * 0.08).toFixed(2)}s"/>`;
}

const bar = (x, y, w, frac, color, dim) => `<rect x="${x}" y="${y}" width="${w}" height="9" fill="${dim}"/><rect x="${x}" y="${y}" width="${Math.max(2, w * Math.min(1, frac)).toFixed(1)}" height="9" fill="${color}" class="fill"/>`;
const stamp = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>
@font-face{font-family:Hud;src:url(data:font/woff2;base64,${font}) format("woff2")}
text{font-family:Hud,Impact,"Arial Narrow",sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-linejoin:round}
.odo{animation:odo 1.6s cubic-bezier(.2,.9,.25,1) both}
@keyframes odo{from{transform:translateY(${(-9 * MS * 1.05).toFixed(1)}px)}to{transform:translateY(var(--to))}}
.star{fill:rgba(0,0,0,.35);stroke:rgba(255,255,255,.35);stroke-width:1.5}
.star.on{fill:#fff;stroke:#000;stroke-width:2.5;animation:flash 1s steps(1) infinite}
@keyframes flash{50%{fill:#7aa2ff}}
.flick{animation:flick 6s steps(1) infinite}@keyframes flick{0%,40%{opacity:1}41%,60%{opacity:0}61%{opacity:1}}
.car{animation:drive linear infinite}@keyframes drive{from{transform:translateX(-60px)}to{transform:translateX(1260px)}}
.carL{animation:driveL linear infinite}@keyframes driveL{from{transform:translateX(1260px)}to{transform:translateX(-60px)}}
.me{transform-box:fill-box;transform-origin:center;animation:me 1.6s ease-in-out infinite}@keyframes me{50%{transform:scale(1.25)}}
.blip{transform-box:fill-box;transform-origin:center;animation:blip 2s ease-out infinite}@keyframes blip{from{transform:scale(1);opacity:.9}to{transform:scale(3.4);opacity:0}}
.fill{transform-box:fill-box;transform-origin:left;animation:grow 1.4s cubic-bezier(.2,.9,.25,1) .6s both}@keyframes grow{from{transform:scaleX(0)}}
.mp{opacity:0;animation:mp 14s ease infinite 1.8s}
@keyframes mp{0%{opacity:0;transform:scale(1.15)}4%{opacity:1;transform:none}30%{opacity:1}36%,100%{opacity:0}}
.mp g{transform-box:fill-box;transform-origin:center}
.delta{opacity:0;animation:delta 14s ease infinite 2.6s}@keyframes delta{0%{opacity:0;transform:translateY(8px)}4%,26%{opacity:1;transform:none}32%,100%{opacity:0}}
.sun{animation:sun 8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes sun{50%{transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.mp,.delta{opacity:1}}
</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0d0b1e"/><stop offset=".35" stop-color="#3b1f4f"/><stop offset=".62" stop-color="#b3445a"/><stop offset=".8" stop-color="#f08a4b"/><stop offset="1" stop-color="#ffc56b"/></linearGradient>
<radialGradient id="sunG"><stop offset="0" stop-color="#fff4c9"/><stop offset=".55" stop-color="#ffb259"/><stop offset="1" stop-color="#ff6a4a" stop-opacity="0"/></radialGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5a" stop-opacity="0"/><stop offset="1" stop-color="#ff9a5a" stop-opacity=".35"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
<linearGradient id="band" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".2" stop-color="#000" stop-opacity=".62"/><stop offset=".8" stop-color="#000" stop-opacity=".62"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<clipPath id="radar"><rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" rx="6"/></clipPath>
<clipPath id="money"><rect x="600" y="${MY - MS + 2}" width="600" height="${MS + 6}"/></clipPath>
</defs>

<rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>
<circle class="sun" cx="610" cy="${HORIZON - 30}" r="150" fill="url(#sunG)"/>
<circle cx="610" cy="${HORIZON - 30}" r="54" fill="#fff1c4" opacity=".92"/>
<rect y="${HORIZON - 120}" width="${W}" height="120" fill="url(#haze)"/>
<g fill="#140d1f">${towers}</g>
<g fill="#ffcf6e" opacity=".75">${windows}<g class="flick">${flick}</g></g>
${palm(150, 120, 1)}${palm(196, 92, 0.85)}${palm(905, 132, 1.05)}${palm(1068, 104, 0.9)}
<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="#0b0810"/>
<rect y="${HORIZON + 26}" width="${W}" height="2" fill="#2a1d2f"/>
<g>${Array.from({ length: 7 }, (_, i) => `<rect class="car" x="0" y="${HORIZON + 22}" width="16" height="2.6" rx="1.3" fill="#ff3b30" style="animation-duration:${(7 + i * 1.3).toFixed(1)}s;animation-delay:-${(i * 2.1).toFixed(1)}s"/>`).join('')}
${Array.from({ length: 7 }, (_, i) => `<rect class="carL" x="0" y="${HORIZON + 30}" width="16" height="2.6" rx="1.3" fill="#fff3c2" style="animation-duration:${(6 + i * 1.1).toFixed(1)}s;animation-delay:-${(i * 1.7).toFixed(1)}s"/>`).join('')}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>

<!-- radar -->
<rect x="${RX - 3}" y="${RY - 3}" width="${RW + 6}" height="${RH + 6}" rx="8" fill="#000" opacity=".75"/>
<g clip-path="url(#radar)">
<rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" fill="#26312d"/>
<rect x="${RX}" y="${RY + RH - 34}" width="${RW}" height="40" fill="#2f4a5c" opacity=".8"/>
<g transform="translate(${RX + RW / 2} ${RY + RH / 2 + 6}) scale(1 .62) rotate(-28) translate(${-gridW / 2} ${-gridH / 2})">
${blocks}
<circle class="blip" cx="${bestCell[0]}" cy="${bestCell[1]}" r="6" fill="none" stroke="#f0c33c" stroke-width="2"/>
<circle cx="${bestCell[0]}" cy="${bestCell[1]}" r="5" fill="#f0c33c" stroke="#000" stroke-width="1.5"/>
</g>
<path class="me" d="M${RX + RW / 2} ${RY + RH / 2 - 9} l7 17 -7 -4 -7 4z" fill="#fff" stroke="#000" stroke-width="1.5"/>
</g>
<circle cx="${RX + RW / 2}" cy="${RY - 1}" r="9" fill="#000" stroke="#fff" stroke-width="1"/>
${T(RX + RW / 2, RY + 4, 'N', 13, 'text-anchor="middle" stroke-width="0"')}
${bar(RX, RY + RH + 9, RW * 0.5 - 3, streak / 30, '#5cb85c', '#1f3b22')}
${bar(RX + RW * 0.5 + 3, RY + RH + 9, RW * 0.25 - 6, active30 / 30, '#4a8fd6', '#1a2e44')}
${bar(RX + RW * 0.75, RY + RH + 9, RW * 0.25, best / 60, '#e8c33a', '#3d3412')}
${T(RX, RY + RH + 36, `STREAK ${streak}D`, 14, 'stroke-width="3" opacity=".9"')}
${T(RX + RW * 0.5 + 3, RY + RH + 36, `ACTIVE ${active30}/30`, 14, 'stroke-width="3" opacity=".9"')}
${T(RX + RW, RY + RH + 36, `BEST ${best}D`, 14, 'text-anchor="end" stroke-width="3" opacity=".9"')}

<!-- wanted + money -->
${stars}
<g clip-path="url(#money)" style="stroke-width:5">${odo}</g>
<g class="delta">${T(MX, MY + 38, `+$${fmt(week)}`, 30, 'text-anchor="end" fill="#72e06a" style="fill:#72e06a" stroke-width="5"')}</g>
${T(MX, MY + 64, `${repos} OPEN REPOS · @${login.toUpperCase()}`, 15, 'text-anchor="end" stroke-width="3" opacity=".85"')}
${T(MX, H - 22, `AHMEDABAD · ${stamp}`, 14, 'text-anchor="end" stroke-width="3" opacity=".7"')}

<!-- mission passed -->
<g class="mp">
<rect x="250" y="150" width="700" height="96" fill="url(#band)"/>
<g>${T(600, 210, 'MISSION PASSED', 62, 'text-anchor="middle" letter-spacing="1" style="fill:#f5c242" stroke-width="7"')}</g>
${T(600, 238, `${fmt(total)} CONTRIBUTIONS THIS YEAR  ·  STREAK ${streak} DAYS`, 17, 'text-anchor="middle" stroke-width="4"')}
</g>
</svg>`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(`wrote ${out}: total=${total} week=${week} wanted=${wanted} streak=${streak} best=${best} active30=${active30}`);
