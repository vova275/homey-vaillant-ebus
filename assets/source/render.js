'use strict';

// Renders the store images from boiler.svg with a headless Chrome/Edge.
//   node assets/source/render.js "C:/Program Files/Google/Chrome/Application/chrome.exe"

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const browser = process.argv[2];
const root = path.join(__dirname, '..', '..');
const boiler = fs.readFileSync(path.join(__dirname, 'boiler.svg'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vebus-img-'));

// app image: boiler on the brand gradient, with bus waves to a thermostat dial
function appHtml(w, h) {
  const s = h / 350;
  return `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 500 350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00a58d"/><stop offset="1" stop-color="#05506b"/>
    </linearGradient>
    <radialGradient id="dial" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe7ec"/>
    </radialGradient>
  </defs>
  <rect width="500" height="350" fill="url(#bg)"/>
  <circle cx="420" cy="40" r="140" fill="#ffffff" opacity="0.05"/>
  <circle cx="60" cy="330" r="110" fill="#ffffff" opacity="0.05"/>
  <g transform="translate(70 40) scale(1)">${boiler.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
  <g fill="none" stroke="#ffffff" stroke-linecap="round" opacity="0.85">
    <path d="M268 175 q14 -16 0 -32" stroke-width="5" opacity="0.5"/>
    <path d="M286 190 q26 -31 0 -62" stroke-width="5" opacity="0.7"/>
    <path d="M304 205 q38 -46 0 -92" stroke-width="5"/>
  </g>
  <circle cx="395" cy="160" r="62" fill="url(#dial)" stroke="#ffffff" stroke-width="3"/>
  <circle cx="395" cy="160" r="48" fill="none" stroke="#cfd9e0" stroke-width="8"/>
  <path d="M359 192 A48 48 0 1 1 431 192" fill="none" stroke="#00b39b" stroke-width="8" stroke-linecap="round" stroke-dasharray="210 400"/>
  <text x="395" y="171" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#24313b" text-anchor="middle">21°</text>
</svg></body></html>`;
}

// driver image: boiler alone on white
function driverHtml(w, h) {
  return `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#fff">
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-60 -20 320 310">${boiler.replace(/<svg[^>]*>|<\/svg>/g, '')}</svg>
</body></html>`;
}

function shot(html, w, h, out) {
  const f = path.join(tmp, `${w}x${h}.html`);
  fs.writeFileSync(f, html);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, `--screenshot=${out}`, `file:///${f.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  console.log('wrote', path.relative(root, out));
}

for (const [n, w, h] of [['small', 250, 175], ['large', 500, 350], ['xlarge', 1000, 700]]) {
  shot(appHtml(w, h), w, h, path.join(root, 'assets', 'images', `${n}.png`));
}
for (const [n, w] of [['small', 75], ['large', 500], ['xlarge', 1000]]) {
  shot(driverHtml(w, w), w, w, path.join(root, 'drivers', 'boiler', 'assets', 'images', `${n}.png`));
}
