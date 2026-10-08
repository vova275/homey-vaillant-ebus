'use strict';

// Read-only sweep of BAI registers (b509 0d LL HH) to find undocumented values.
//   node tools/scan-registers.js ebusd 127.0.0.1 8888 out.json
//   node tools/scan-registers.js --diff a.json b.json
// Only reads; never sends 0e (write).

const fs = require('fs');
const EbusdTransport = require('../lib/transport-ebusd');

const RANGES = [[0x0000, 0x00FF], [0x0300, 0x03FF], [0x0400, 0x04FF]];

function hints(hex) {
  const b = Buffer.from(hex, 'hex');
  const h = [];
  if (b.length >= 1) h.push(`UCH=${b[0]}`, `D1C=${b[0] / 2}`);
  if (b.length >= 2) h.push(`D2C=${b.readInt16LE(0) / 16}`);
  return h.join(' ');
}

async function scan(host, port, out) {
  const t = new EbusdTransport({ host, port: Number(port) || 8888, timeout: 5000 });
  const res = {};
  let n = 0;
  for (const [a, z] of RANGES) {
    for (let id = a; id <= z; id++) {
      try {
        const d = await t.request(0x08, 0xB509, [0x0D, id & 0xFF, id >> 8]);
        if (d.length) res[id.toString(16).padStart(4, '0')] = Buffer.from(d).toString('hex');
      } catch (err) {
        if (!/ERR: (no answer|invalid|element)/.test(err.message)) res[`err_${id.toString(16)}`] = err.message;
      }
      if (++n % 64 === 0) console.log(`${n} read, ${Object.keys(res).length} answered`);
    }
  }
  t.close();
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(`done: ${Object.keys(res).length} registers -> ${out}`);
}

function diff(fa, fb) {
  const a = JSON.parse(fs.readFileSync(fa));
  const b = JSON.parse(fs.readFileSync(fb));
  for (const k of Object.keys({ ...a, ...b }).sort()) {
    if (a[k] !== b[k]) console.log(`${k}: ${a[k]} (${hints(a[k] || '')}) -> ${b[k]} (${hints(b[k] || '')})`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--diff') diff(args[1], args[2]);
else scan(args[1] || '127.0.0.1', args[2], args[3] || 'registers.json').catch((e) => { console.error(e); process.exit(1); });
